import { consola } from "consola";

import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  const id = event.context.params?.id;
  if (!id) {
    throw createError({ statusCode: 400, message: "User ID is required" });
  }
  const body = await readBody(event);

  // Calendar linkage fields must be updated together
  const calendarId = body.calendarId;
  const integrationId = body.calendarIntegrationId;
  const calendarService = body.calendarService;

  // Check if any of the fields are provided (not undefined)
  const isProvided = body.calendarId !== undefined || body.calendarIntegrationId !== undefined || body.calendarService !== undefined;

  if (isProvided) {
    // If any are provided, ensure they are either all null (unlinking) or all non-null (linking)
    const allNull = calendarId == null && integrationId == null && calendarService == null;
    const allNonNull = calendarId != null && integrationId != null && calendarService != null;

    if (!(allNull || allNonNull)) {
      throw createError({
        statusCode: 400,
        message: "calendarId, calendarIntegrationId, and calendarService must be provided together as either all null or all non-null",
      });
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
          pin: body.pin ? await hashPin(body.pin) : undefined,
          todoOrder: body.todoOrder ?? undefined,
          calendarId: body.calendarId !== undefined ? body.calendarId : undefined,
          calendarIntegrationId: body.calendarIntegrationId !== undefined ? body.calendarIntegrationId : undefined,
          calendarService: body.calendarService !== undefined ? body.calendarService : undefined,
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
  catch (error) {
    consola.error("Failed to update user:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to update user",
    });
  }
});
