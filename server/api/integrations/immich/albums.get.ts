import { consola } from "consola";
import { createError, defineEventHandler, getQuery } from "h3";

import prisma from "~/lib/prisma";
import { decryptApiKey } from "~~/server/utils/oauthCrypto";

/**
 * Immich Album type from Immich API
 */
type ImmichAlbum = {
  id: string;
  albumName: string;
  description: string;
  assetCount: number;
  albumThumbnailAssetId: string | null;
  createdAt: string;
  updatedAt: string;
  shared: boolean;
  ownerId: string;
};

/**
 * GET /api/integrations/immich/albums
 * Fetches available Immich albums
 *
 * Query params:
 * - integrationId: Required - the ID of the Immich integration
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const integrationId = query.integrationId as string;

  if (!integrationId) {
    throw createError({
      statusCode: 400,
      message: "integrationId query parameter is required",
    });
  }

  // Look up the integration
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration) {
    throw createError({
      statusCode: 404,
      message: "Integration not found",
    });
  }

  if (integration.type !== "photos" || integration.service !== "immich") {
    throw createError({
      statusCode: 400,
      message: "Invalid integration type - expected Immich photos integration",
    });
  }

  // Get credentials
  const storedApiKey = integration.apiKey;
  const baseUrl = integration.baseUrl;

  if (!storedApiKey || !baseUrl) {
    throw createError({
      statusCode: 400,
      message: "Immich integration is missing required configuration (API key or URL)",
    });
  }

  // Try to decrypt if encrypted, otherwise use as-is (plaintext API keys)
  let apiKey: string;
  try {
    apiKey = decryptApiKey(storedApiKey);
  }
  catch {
    // API key stored in plaintext (non-OAuth integrations)
    apiKey = storedApiKey;
  }

  try {
    // Fetch albums from Immich API
    const response = await fetch(`${baseUrl}/api/albums`, {
      headers: {
        "x-api-key": apiKey,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      let errorMessage: string;
      switch (response.status) {
        case 401:
          errorMessage = "Authentication failed - check your API key";
          break;
        case 403:
          errorMessage = "Access denied - API key may lack required permissions";
          break;
        case 404:
          errorMessage = "Immich API endpoint not found - check your server URL";
          break;
        case 500:
        case 502:
        case 503:
          errorMessage = "Immich server error - try again later";
          break;
        default:
          errorMessage = `Immich server responded with status ${response.status}`;
      }
      throw createError({
        statusCode: response.status,
        message: errorMessage,
      });
    }

    const albums: ImmichAlbum[] = await response.json();

    consola.info(`Fetched ${albums.length} Immich albums for integration ${integrationId}`);

    // Transform to a standardized format
    return {
      albums: albums.map(album => ({
        id: album.id,
        title: album.albumName,
        description: album.description,
        assetCount: album.assetCount,
        thumbnailAssetId: album.albumThumbnailAssetId,
        shared: album.shared,
        createdAt: album.createdAt,
        updatedAt: album.updatedAt,
      })),
    };
  }
  catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error; // Re-throw HTTP errors
    }

    consola.error("Error fetching Immich albums:", error);

    // Check if this is a network connectivity error
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isNetworkError = errorMsg.includes("fetch failed")
      || errorMsg.includes("ECONNREFUSED")
      || errorMsg.includes("EHOSTUNREACH")
      || errorMsg.includes("ETIMEDOUT")
      || errorMsg.includes("ENOTFOUND")
      || errorMsg.includes("network");

    throw createError({
      statusCode: isNetworkError ? 503 : 500,
      message: isNetworkError
        ? "Could not connect to Immich server. Please check that the server is running and the URL is correct."
        : (error instanceof Error ? error.message : "Failed to fetch albums from Immich"),
    });
  }
});
