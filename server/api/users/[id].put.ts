import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  const id = event.context.params?.id;
  if (!id) {
    throw createError({ statusCode: 400, message: "User ID is required" });
  }
  const body = await readBody(event);

  if (!body || typeof body !== "object") {
    throw createError({ statusCode: 400, message: "Invalid request body" });
  }

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      throw createError({
        statusCode: 400,
        message: "Name must be a non-empty string",
      });
    }
  }

  if (body.email) {
    if (
      typeof body.email !== "string"
      || !/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(body.email)
    ) {
      throw createError({ statusCode: 400, message: "Invalid email format" });
    }
  }

  try {
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          name: body.name,
          email: body.email && body.email.trim() ? body.email.trim() : null,
          avatar: body.avatar || null,
          color: body.color || null,
          role: body.role ?? undefined,
          todoOrder: body.todoOrder ?? undefined,
        },
      }),
      ...(body.name
        ? [
            prisma.todoColumn.updateMany({
              where: { userId: id },
              data: { name: body.name },
            }),
          ]
        : []),
    ]);
    return updatedUser;
  }
  catch (error: any) {
    if (error.statusCode)
      throw error;
    console.error("Failed to update user:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to update user",
    });
  }
});
