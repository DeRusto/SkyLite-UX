import { z } from "zod";

import prisma from "~/lib/prisma";

const reorderSchema = z.object({
  listIds: z.array(z.string().cuid()).max(1000),
});

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { listIds } = await reorderSchema.parseAsync(body);

    await prisma.$transaction(
      listIds.map((id: string, index: number) =>
        prisma.shoppingList.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );

    return { success: true };
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to reorder shopping list: ${error}`,
    });
  }
});
