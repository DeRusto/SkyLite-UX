import { GoogleCalendarServerService } from "~~/server/integrations/google-calendar/client";
import { defineEventHandler } from "h3";
import prisma from "~/lib/prisma";

export default defineEventHandler(async (_event) => {
  try {
    const integrations = await prisma.integration.findMany({
      where: {
        type: "calendar",
        enabled: true,
      },
    });

    const allCalendars = [];

    for (const integration of integrations) {
      if (integration.service === "google-calendar") {
        try {
          if (integration.accessToken && integration.refreshToken) {
            const service = new GoogleCalendarServerService(
              integration.id,
              integration.accessToken,
              integration.refreshToken,
              integration.tokenExpiry,
              integration.settings as any || {},
            );
            await service.initialize();
            const calendars = await service.listCalendars();

            allCalendars.push(...calendars.map(cal => ({
              id: cal.id,
              summary: cal.summary,
              integrationId: integration.id,
              integrationName: integration.name,
              service: integration.service,
              color: cal.backgroundColor,
            })));
          }
        } catch (err) {
          console.error(`Failed to fetch calendars for integration ${integration.id}:`, err);
        }
      } else if (integration.service === "iCal") {
        // For iCal, the integration itself is the calendar
        allCalendars.push({
          id: integration.id, // Use integration ID as calendar ID for iCal
          summary: integration.name,
          integrationId: integration.id,
          integrationName: integration.name,
          service: integration.service,
          color: (integration.settings as any)?.eventColor || "#06b6d4",
        });
      }
    }

    return { calendars: allCalendars };
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to fetch calendars: ${error}`,
    });
  }
});
