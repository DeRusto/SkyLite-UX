import { consola } from "consola";
import { createError, defineEventHandler, getQuery } from "h3";

import prisma from "~/lib/prisma";

import { createGooglePhotosClient } from "../../../integrations/google-photos/client";

/**
 * GET /api/integrations/google-photos/albums
 * Fetches available Google Photos albums
 *
 * Two modes:
 * 1. With integrationId - uses tokens from saved integration
 * 2. With accessToken/refreshToken/tokenExpiry - uses provided tokens (OAuth flow)
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const integrationId = query.integrationId as string;
  const accessToken = query.accessToken as string;
  const refreshToken = query.refreshToken as string;
  const tokenExpiry = query.tokenExpiry ? new Date(Number(query.tokenExpiry)) : null;

  let effectiveAccessToken: string | null = null;
  let effectiveRefreshToken: string | null = null;
  let effectiveTokenExpiry: Date | null = null;

  // Mode 1: Use tokens from saved integration
  if (integrationId) {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      throw createError({
        statusCode: 404,
        message: "Integration not found",
      });
    }

    if (integration.type !== "photos" || integration.name !== "google-photos") {
      throw createError({
        statusCode: 400,
        message: "Invalid integration type - expected Google Photos integration",
      });
    }

    effectiveAccessToken = integration.accessToken;
    effectiveRefreshToken = integration.refreshToken;
    effectiveTokenExpiry = integration.tokenExpiry;
  }
  // Mode 2: Use provided tokens (OAuth flow)
  else if (accessToken && refreshToken) {
    effectiveAccessToken = accessToken;
    effectiveRefreshToken = refreshToken;
    effectiveTokenExpiry = tokenExpiry;
  }
  else {
    throw createError({
      statusCode: 400,
      message: "Either integrationId or accessToken/refreshToken required",
    });
  }

  try {
    // Create Google Photos client
    const client = await createGooglePhotosClient(
      effectiveAccessToken,
      effectiveRefreshToken,
      effectiveTokenExpiry,
    );

    // Fetch albums
    const albums = await client.listAlbums();

    consola.info(`Fetched ${albums.length} Google Photos albums`);

    return {
      albums: albums.map(album => ({
        id: album.id,
        title: album.title,
        productUrl: album.productUrl,
        mediaItemsCount: album.mediaItemsCount,
        coverPhotoBaseUrl: album.coverPhotoBaseUrl,
      })),
    };
  }
  catch (error) {
    consola.error("Error fetching Google Photos albums:", error);

    if (error instanceof Error && error.message.includes("OAuth tokens are required")) {
      throw createError({
        statusCode: 401,
        message: "Google Photos not authorized - please connect your Google account",
      });
    }

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Failed to fetch albums",
    });
  }
});
