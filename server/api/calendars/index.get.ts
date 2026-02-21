import type { GoogleCalendarSettings } from "~~/server/integrations/google-calendar/types";

import { GoogleCalendarServerService } from "~~/server/integrations/google-calendar/client";
import { consola } from "consola";

import type { AvailableCalendar } from "~/types/calendar";

import prisma from "~/lib/prisma";

export default defineEventHandler(async (_event) => {
  try {
    const integrations = await prisma.integration.findMany({
      where: {
        type: "calendar",
        enabled: true,
      },
    });

    const results = await Promise.allSettled(integrations.map(async (integration) => {
      if (integration.service === "google-calendar") {
        if (integration.accessToken && integration.refreshToken) {
          const settings = (integration.settings as unknown as GoogleCalendarSettings) ?? { selectedCalendars: [] };
          const service = new GoogleCalendarServerService(
            integration.id,
            integration.accessToken,
            integration.refreshToken,
            integration.tokenExpiry,
            settings,
          );
          await service.initialize();
          const calendars = await service.listCalendars();

          return calendars.map((cal): AvailableCalendar => ({
            id: cal.id,
            summary: cal.summary,
            integrationId: integration.id,
            integrationName: integration.name,
            service: integration.service,
            color: cal.backgroundColor,
          }));
        }
      }
      else if (integration.service === "iCal") {
        // For iCal, the integration itself is the calendar
        return [{
          id: integration.id,
          summary: integration.name,
          integrationId: integration.id,
          integrationName: integration.name,
          service: integration.service,
          color: (integration.settings as any)?.eventColor || "#06b6d4",
        } as AvailableCalendar];
      }
      return [] as AvailableCalendar[];
    }));

    const allCalendars: AvailableCalendar[] = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        allCalendars.push(...result.value);
      }
      else {
        consola.error(`Failed to fetch calendars for integration ${integrations[index]?.id}:`, result.reason);
      }
    });

    return { calendars: allCalendars };
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to fetch calendars: ${error}`,
    });
  }
});
