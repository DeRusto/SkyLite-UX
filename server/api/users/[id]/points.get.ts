import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  const userId = getRouterParam(event, "id");

  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: "User ID is required",
    });
  }

  // Check if user exists and fetch points
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      points: true,
    },
  });

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: "User not found",
    });
  }

  // Get or create user points
  let userPoints = user.points;

  if (!userPoints) {
    userPoints = await prisma.userPoints.create({
      data: { userId },
    });
  }

  return {
    ...userPoints,
    userName: user.name,
  };
});
