import { Prisma } from "@prisma/client";

import prisma from "~/lib/prisma";

import type { ICalEvent } from "../../integrations/iCal/types";

import { calculateNextDueDate } from "../../utils/rrule";

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id");
    const body = await readBody(event);

    if (!id) {
      throw createError({
        statusCode: 400,
        message: "Todo ID is required",
      });
    }

    const currentTodo = await prisma.todo.findUnique({
      where: { id },
    });

    if (!currentTodo) {
      throw createError({
        statusCode: 404,
        message: "Todo not found",
      });
    }

    let rrule: ICalEvent["rrule"] | null = null;
    if (body.rrule !== undefined) {
      rrule = body.rrule as ICalEvent["rrule"] | null;
    }
    else if (currentTodo.rrule) {
      rrule = currentTodo.rrule as ICalEvent["rrule"];
    }

    const recurringGroupId = rrule
      ? currentTodo.recurringGroupId || crypto.randomUUID()
      : null;

    // Completing a recurring todo creates its next occurrence. Claim the
    // completion and create the successor in one transaction so two devices
    // completing the same todo cannot both create one, and a failed successor
    // write does not leave the todo completed without a next occurrence.
    const todo = await prisma.$transaction(async (tx) => {
      let completedNow = false;
      if (body.completed && !currentTodo.completed) {
        const claim = await tx.todo.updateMany({
          where: { id, completed: false },
          data: { completed: true },
        });
        completedNow = claim.count === 1;
      }

      const updated = await tx.todo.update({
        where: { id },
        data: {
          title: body.title,
          description: body.description,
          completed: body.completed,
          priority: body.priority,
          dueDate:
            body.dueDate !== undefined
              ? body.dueDate
                ? new Date(body.dueDate)
                : null
              : currentTodo.dueDate,
          todoColumnId: body.todoColumnId,
          order: body.order,
          rrule: rrule ?? Prisma.JsonNull,
          recurringGroupId,
        },
        include: {
          todoColumn: {
            select: {
              id: true,
              name: true,
              order: true,
              isDefault: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                },
              },
            },
          },
        },
      });

      if (
        completedNow
        && updated.recurringGroupId
        && updated.rrule
      ) {
        const todoRrule = updated.rrule as ICalEvent["rrule"];

        const firstTodo = await tx.todo.findFirst({
          where: {
            recurringGroupId: updated.recurringGroupId,
          },
          orderBy: {
            createdAt: "asc",
          },
        });

        if (!firstTodo || !firstTodo.dueDate) {
          throw createError({
            statusCode: 500,
            message: "Failed to find original DTSTART for recurring todo",
          });
        }

        const originalDTSTART = new Date(firstTodo.dueDate);
        originalDTSTART.setHours(0, 0, 0, 0);

        const referenceDate = body.clientDate ? new Date(body.clientDate) : null;
        if (referenceDate) {
          referenceDate.setHours(0, 0, 0, 0);
        }

        const nextDueDate = calculateNextDueDate(
          todoRrule,
          originalDTSTART,
          updated.dueDate,
          referenceDate,
        );

        if (nextDueDate !== null) {
          const maxOrder = await tx.todo.aggregate({
            where: {
              todoColumnId: updated.todoColumnId || null,
              completed: false,
            },
            _max: {
              order: true,
            },
          });

          await tx.todo.create({
            data: {
              title: updated.title,
              description: updated.description,
              priority: updated.priority,
              dueDate: nextDueDate,
              todoColumnId: updated.todoColumnId,
              order: (maxOrder._max.order || 0) + 1,
              recurringGroupId: updated.recurringGroupId,
              rrule: updated.rrule,
              completed: false,
            },
          });
        }
      }

      return updated;
    });

    return todo;
  }
  catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: `Failed to update todo: ${error}`,
    });
  }
});
