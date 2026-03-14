import { GoogleCalendarServerService } from "~~/server/integrations/google-calendar/client";
import { createError, defineEventHandler, getHeader } from "h3";

/**
 * Fetch available Google Calendars for selection
 * Used after OAuth to let user choose which calendars to sync
 */
export default defineEventHandler(async (event) => {
  // Read tokens from headers only (query parameters not accepted for security)
  const accessToken = getHeader(event, "x-access-token");
  const refreshToken = getHeader(event, "x-refresh-token");
  const tokenExpiryHeader = getHeader(event, "x-token-expiry");
  const tokenExpiry = tokenExpiryHeader ? new Date(Number(tokenExpiryHeader)) : null;

  if (!accessToken || !refreshToken) {
    throw createError({
      statusCode: 400,
      message: "OAuth tokens must be provided via headers (x-access-token, x-refresh-token, x-token-expiry)",
    });
  }

  try {
    // Create temporary service instance to list calendars
    const service = new GoogleCalendarServerService(
      "temp",
      accessToken,
      refreshToken,
      tokenExpiry,
      { selectedCalendars: [] },
    );

    await service.initialize();
    const calendars = await service.listCalendars();

    return { calendars };
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Failed to fetch calendars",
    });
  }
});
