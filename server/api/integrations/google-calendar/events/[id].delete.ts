import type { GoogleCalendarSettings } from "~~/server/integrations/google-calendar/types";

import { GoogleCalendarServerService } from "~~/server/integrations/google-calendar/client";
import { createError, defineEventHandler, getRouterParam, readBody } from "h3";

import prisma from "~/lib/prisma";

/**
 * Delete an event from Google Calendar
 * DELETE /api/integrations/google-calendar/events/:id
 *
 * Path params:
 * - id: Google event ID
 *
 * Request body:
 * - integrationId: string
 * - calendarId: string (optional, defaults to primary calendar)
 *
 * Returns success confirmation
 */
export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, "id");

  if (!eventId) {
    throw createError({
      statusCode: 400,
      message: "Event ID required",
    });
  }

  const body = await readBody(event);
  const { integrationId, calendarId } = body;

  if (!integrationId) {
    throw createError({
      statusCode: 400,
      message: "Integration ID required",
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

    // Delete event from Google Calendar
    await service.deleteEvent(eventId, targetCalendarId);

    // Update or remove event mapping
    const existingMapping = await prisma.calendarEventMapping.findFirst({
      where: {
        googleEventId: eventId,
        integrationId: integration.id,
      },
    });

    if (existingMapping) {
      await prisma.calendarEventMapping.update({
        where: { id: existingMapping.id },
        data: {
          syncDirection: "OUTBOUND",
          lastSyncedAt: new Date(),
        },
      });
    }

    // Update integration's last sync time
    await prisma.integration.update({
      where: { id: integration.id },
      data: { updatedAt: new Date() },
    });

    return {
      success: true,
      message: "Event deleted successfully",
    };
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Failed to delete event from Google Calendar",
    });
  }
});
