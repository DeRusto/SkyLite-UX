import { createError, defineEventHandler, readBody } from "h3";

import { consola } from "consola";

import prisma from "~/lib/prisma";

import type { GoogleCalendarSettings } from "~~/server/integrations/google-calendar/types";

import { GoogleCalendarServerService } from "~~/server/integrations/google-calendar/client";

/**
 * Trigger manual sync with Google Calendar
 * POST /api/integrations/google-calendar/sync
 *
 * Request body:
 * - integrationId: string
 *
 * Returns sync status and fetched events
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { integrationId } = body;

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
        message: "Integration missing OAuth tokens - re-authorization required",
      });
    }

    if (!integration.enabled) {
      throw createError({
        statusCode: 400,
        message: "Integration is disabled",
      });
    }

    consola.info(`Manual sync triggered for Google Calendar integration ${integrationId}`);

    // Create service instance
    const service = new GoogleCalendarServerService(
      integration.id,
      integration.accessToken,
      integration.refreshToken,
      integration.tokenExpiry,
      integration.settings as GoogleCalendarSettings,
    );

    await service.initialize();
    const googleEvents = await service.getEvents();

    // Convert to CalendarEvent format
    const calendarEvents = googleEvents.map(ge => service.convertToCalendarEvent(ge));

    // Update integration's last sync time
    await prisma.integration.update({
      where: { id: integration.id },
      data: { updatedAt: new Date() },
    });

    consola.info(`Manual sync complete: fetched ${calendarEvents.length} events from Google Calendar`);

    return {
      success: true,
      events: calendarEvents,
      eventCount: calendarEvents.length,
      lastSync: new Date().toISOString(),
    };
  }
  catch (error) {
    consola.error(`Manual sync failed for integration ${integrationId}:`, error);

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Failed to sync with Google Calendar",
    });
  }
});
