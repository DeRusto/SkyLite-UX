import { z } from "zod";

import prisma from "~/lib/prisma";

const reorderSchema = z.object({
  itemIds: z.array(z.string().cuid()).max(1000),
});

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { itemIds } = await reorderSchema.parseAsync(body);

    const updatePromises = itemIds.map((id: string, index: number) =>
      prisma.shoppingListItem.update({
        where: { id },
        data: { order: index },
      }),
    );

    await Promise.all(updatePromises);

    return { success: true };
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to reorder shopping list item: ${error}`,
    });
  }
});
