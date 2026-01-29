import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const userId = getRouterParam(event, "id");

    if (!userId) {
      throw createError({
        statusCode: 400,
        message: "User ID is required",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        todoColumn: {
          include: {
            todos: true,
          },
        },
      },
    });

    if (!existingUser) {
      throw createError({
        statusCode: 404,
        message: "User not found",
      });
    }

    await prisma.$transaction(async (tx) => {
      if (existingUser.todoColumn && existingUser.todoColumn.todos.length > 0) {
        await tx.todo.deleteMany({
          where: { todoColumnId: existingUser.todoColumn.id },
        });
      }

      if (existingUser.todoColumn) {
        await tx.todoColumn.delete({
          where: { id: existingUser.todoColumn.id },
        });
      }

      await tx.user.delete({
        where: { id: userId },
      });
    });

    return { success: true };
  }
  catch (error: any) {
    if (error.statusCode)
      throw error;
    console.error("Failed to delete user:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to delete user",
    });
  }
});
