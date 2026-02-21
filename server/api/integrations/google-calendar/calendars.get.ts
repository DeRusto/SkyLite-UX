import { GoogleCalendarServerService } from "~~/server/integrations/google-calendar/client";
import { createError, defineEventHandler, getHeader, getQuery } from "h3";

/**
 * Fetch available Google Calendars for selection
 * Used after OAuth to let user choose which calendars to sync
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  // Read tokens from headers for better security
  const accessToken = getHeader(event, "x-access-token") || (query.accessToken as string);
  const refreshToken = getHeader(event, "x-refresh-token") || (query.refreshToken as string);
  const tokenExpiryHeader = getHeader(event, "x-token-expiry");
  const tokenExpiry = tokenExpiryHeader
    ? new Date(Number(tokenExpiryHeader))
    : (query.tokenExpiry ? new Date(Number(query.tokenExpiry)) : null);

  if (!accessToken || !refreshToken) {
    throw createError({
      statusCode: 400,
      message: "Access token and refresh token required",
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
