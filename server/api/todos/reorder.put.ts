import { z } from "zod";

import prisma from "~/lib/prisma";

const reorderSchema = z.object({
  todoIds: z.array(z.string().cuid()).max(1000),
});

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { todoIds } = await reorderSchema.parseAsync(body);

    const updatePromises = todoIds.map((id: string, index: number) =>
      prisma.todo.update({
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
      message: `Failed to reorder todo: ${error}`,
    });
  }
});
