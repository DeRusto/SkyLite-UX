import { consola } from "consola";
import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const integrationId = getRouterParam(event, "id");

    if (!integrationId) {
      throw createError({
        statusCode: 400,
        message: "Integration ID is required",
      });
    }

    await prisma.$transaction([
      // First, nullify calendar linkage for all users using this integration
      prisma.user.updateMany({
        where: { calendarIntegrationId: integrationId },
        data: {
          calendarIntegrationId: null,
          calendarId: null,
          calendarService: null,
        },
      }),
      // Then delete the integration
      prisma.integration.delete({
        where: { id: integrationId },
      }),
    ]);

    return { success: true };
  }
  catch (error: any) {
    if (error.statusCode) {
      throw error;
    }
    consola.error("Failed to delete integration:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to delete integration",
    });
  }
});
