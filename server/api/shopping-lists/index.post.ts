import prisma from "~/lib/prisma";

import { createServerError, validateRequired } from "../../utils/apiErrors";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    validateRequired(body, ["name"]);

    const shoppingList = await prisma.shoppingList.create({
      data: {
        name: body.name,
        items: {
          create: body.items || [],
        },
      },
      include: {
        items: true,
        _count: {
          select: { items: true },
        },
      },
    });

    return shoppingList;
  }
  catch (error: unknown) {
    if (isError(error)) {
      throw error;
    }
    throw createServerError("create shopping list", error);
  }
});
