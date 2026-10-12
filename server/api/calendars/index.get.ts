import { consola } from "consola";

import type { AvailableCalendar } from "~/types/calendar";
import type { CalendarConfig } from "~/types/integrations";

import prisma from "~/lib/prisma";

type CalendarIntegrationSettings = {
  calendars?: CalendarConfig[];
  eventColor?: string;
};

export default defineEventHandler(async (_event) => {
  try {
    const integrations = await prisma.integration.findMany({
      where: {
        type: "calendar",
        enabled: true,
      },
    });

    const allCalendars: AvailableCalendar[] = [];

    for (const integration of integrations) {
      const settings = (integration.settings ?? {}) as CalendarIntegrationSettings;

      if (integration.service === "google") {
        // Calendars are chosen in the integration's calendar selector and
        // stored in its settings, so no Google API call is needed here.
        for (const cal of settings.calendars ?? []) {
          if (!cal.enabled)
            continue;
          allCalendars.push({
            id: cal.id,
            summary: cal.name,
            integrationId: integration.id,
            integrationName: integration.name,
            service: integration.service,
            color: cal.eventColor,
          });
        }
      }
      else if (integration.service === "iCal") {
        // For iCal, the integration itself is the calendar
        allCalendars.push({
          id: integration.id,
          summary: integration.name,
          integrationId: integration.id,
          integrationName: integration.name,
          service: integration.service,
          color: settings.eventColor || "#06b6d4",
        });
      }
    }

    return { calendars: allCalendars };
  }
  catch (error) {
    consola.error("Calendars: Failed to list calendars:", error);
    throw createError({
      statusCode: 500,
      message: `Failed to fetch calendars: ${error}`,
    });
  }
});
