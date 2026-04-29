import prisma from "~/lib/prisma";

import { createServerError, validateRequired } from "../../utils/apiErrors";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    validateRequired(body, ["name"]);

    const maxOrder = await prisma.todoColumn.aggregate({
      _max: {
        order: true,
      },
    });

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: body.name,
          email: body.email && body.email.trim() ? body.email.trim() : null,
          avatar: body.avatar || null,
          color: body.color || null,
          role: body.role === "ADULT" ? "ADULT" : "CHILD",
          pin: body.pin ? await hashPin(body.pin) : null,
          calendarId: body.calendarId || null,
          calendarIntegrationId: body.calendarIntegrationId || null,
          calendarService: body.calendarService || null,
          defaultPage: body.defaultPage || "/calendar",
        },
      });

      const todoColumn = await tx.todoColumn.create({
        data: {
          name: user.name,
          userId: user.id,
          isDefault: true,
          order: ((maxOrder._max?.order) || 0) + 1,
        },
      });

      return { user, todoColumn };
    });

    return result.user;
  }
  catch (error: unknown) {
    if (isError(error)) {
      throw error;
    }
    throw createServerError("create user", error);
  }
});
