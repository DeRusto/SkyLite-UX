import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    if (!body || typeof body !== "object") {
      throw createError({
        statusCode: 400,
        message: "Invalid request body",
      });
    }

    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      throw createError({
        statusCode: 400,
        message: "Name is required",
      });
    }

    if (
      body.email
      && (typeof body.email !== "string"
        || !/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(body.email))
    ) {
      throw createError({
        statusCode: 400,
        message: "Invalid email format",
      });
    }

    const maxOrder = await prisma.todoColumn.aggregate({
      _max: {
        order: true,
      },
    });

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: body.name.trim(),
          email: body.email && body.email.trim() ? body.email.trim() : null,
          avatar: body.avatar || null,
          color: body.color || null,
          role: body.role === "PARENT" ? "PARENT" : "CHILD",
        },
      });

      const todoColumn = await tx.todoColumn.create({
        data: {
          name: user.name,
          userId: user.id,
          isDefault: true,
          order: (maxOrder._max?.order || 0) + 1,
        },
      });

      return { user, todoColumn };
    });

    return result.user;
  }
  catch (error: any) {
    if (error.statusCode)
      throw error;
    console.error("Failed to create user:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to create user",
    });
  }
});
