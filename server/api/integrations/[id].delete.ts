import { consola } from "consola";

import prisma from "~/lib/prisma";

import { syncManager } from "../../plugins/02.syncManager";

export default defineEventHandler(async (event) => {
  try {
    const integrationId = getRouterParam(event, "id");

    if (!integrationId) {
      throw createError({
        statusCode: 400,
        message: "Integration ID is required",
      });
    }

    consola.debug(`Integrations Delete: Clearing sync for integration ${integrationId} before deletion`);
    syncManager.clearIntegrationSync(integrationId);

    await prisma.$transaction([
      // First, nullify calendar linkage for all users using this integration (fork addition)
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

    consola.debug(`Integrations Delete: Successfully deleted integration ${integrationId}`);
    return { success: true };
  }
  catch (error: any) {
    if (error?.statusCode) {
      throw error;
    }
    consola.error("Failed to delete integration:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to delete integration",
    });
  }
});
