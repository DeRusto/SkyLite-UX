import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const limitParam = query.limit ? Number.parseInt(String(query.limit), 10) : 50;
    const offsetParam = query.offset ? Number.parseInt(String(query.offset), 10) : 0;

    // Ensure valid numbers and reasonable limits
    // Default to 50 if invalid or < 1. Max limit 100.
    const limit = (Number.isNaN(limitParam) || limitParam < 1) ? 50 : Math.min(limitParam, 100);
    // Default to 0 if invalid or < 0.
    const offset = (Number.isNaN(offsetParam) || offsetParam < 0) ? 0 : offsetParam;

    const shoppingLists = await prisma.shoppingList.findMany({
      take: limit,
      skip: offset,
      include: {
        items: {
          orderBy: [
            { order: "asc" },
            { checked: "asc" },
          ],
        },
        _count: {
          select: { items: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return shoppingLists;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to fetch shopping list: ${error}`,
    });
  }
});
