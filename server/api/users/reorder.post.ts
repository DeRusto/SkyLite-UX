import { z } from "zod";

import prisma from "~/lib/prisma";

const reorderSchema = z.object({
  userIds: z.array(z.string().cuid()).max(1000),
});

export default defineEventHandler(async (event) => {
  try {
    const { userIds } = await reorderSchema.parseAsync(await readBody(event));

    const updates = userIds.map((userId, index) => {
      return prisma.user.update({
        where: { id: userId },
        data: { todoOrder: index },
      });
    });

    await prisma.$transaction(updates);

    return { success: true };
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to reorder users: ${error}`,
    });
  }
});
