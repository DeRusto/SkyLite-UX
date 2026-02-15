import { subDays } from "date-fns";

import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const todoColumnId = query.todoColumnId as string | undefined;
    const history = query.history === "true";

    const where: any = {};

    if (todoColumnId) {
      where.todoColumnId = todoColumnId;
    }

    if (!history) {
      const sevenDaysAgo = subDays(new Date(), 7);
      where.OR = [
        { completed: false },
        {
          completed: true,
          updatedAt: {
            gte: sevenDaysAgo,
          },
        },
      ];
    }

    const todos = await prisma.todo.findMany({
      where,
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
      orderBy: [
        { todoColumnId: "asc" },
        { completed: "asc" },
        { order: "asc" },
      ],
    });

    return todos;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to fetch todo: ${error}`,
    });
  }
});
