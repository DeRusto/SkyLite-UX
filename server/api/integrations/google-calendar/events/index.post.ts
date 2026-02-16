import type { GoogleCalendarSettings } from "~~/server/integrations/google-calendar/types";

import { GoogleCalendarServerService } from "~~/server/integrations/google-calendar/client";
import { createError, defineEventHandler, readBody } from "h3";

import prisma from "~/lib/prisma";

/**
 * Create an event in Google Calendar
 * POST /api/integrations/google-calendar/events
 *
 * Request body:
 * - integrationId: string
 * - event: CalendarEvent (without id)
 * - calendarId: string (optional, defaults to primary calendar)
 *
 * Returns the created Google event
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const { integrationId, calendarEvent, calendarId } = body;

  if (!integrationId) {
    throw createError({
      statusCode: 400,
      message: "Integration ID required",
    });
  }

  if (!calendarEvent) {
    throw createError({
      statusCode: 400,
      message: "Calendar event data required",
    });
  }

  try {
    // Fetch integration from database
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.service !== "google-calendar") {
      throw createError({
        statusCode: 404,
        message: "Google Calendar integration not found",
      });
    }

    if (!integration.accessToken || !integration.refreshToken) {
      throw createError({
        statusCode: 400,
        message: "Integration missing OAuth tokens",
      });
    }

    const settings = integration.settings as GoogleCalendarSettings;
    const targetCalendarId = calendarId || settings.selectedCalendars?.[0] || "primary";

    // Create service instance
    const service = new GoogleCalendarServerService(
      integration.id,
      integration.accessToken,
      integration.refreshToken,
      integration.tokenExpiry,
      settings,
    );

    await service.initialize();

    // Create event in Google Calendar
    const googleEvent = await service.addEvent(calendarEvent, targetCalendarId);

    // Create event mapping to track the sync
    await prisma.calendarEventMapping.create({
      data: {
        skyliteEventId: calendarEvent.tempId || `temp-${Date.now()}`,
        googleEventId: googleEvent.id,
        googleCalendarId: targetCalendarId,
        integrationId: integration.id,
        syncDirection: "OUTBOUND",
        lastSyncedAt: new Date(),
      },
    });

    // Update integration's last sync time
    await prisma.integration.update({
      where: { id: integration.id },
      data: { updatedAt: new Date() },
    });

    return {
      success: true,
      event: googleEvent,
      calendarId: targetCalendarId,
    };
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Failed to create event in Google Calendar",
    });
  }
});
