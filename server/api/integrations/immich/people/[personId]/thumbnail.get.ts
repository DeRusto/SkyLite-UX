import { consola } from "consola";
import { createError, defineEventHandler, getQuery, getRouterParam, setResponseHeader } from "h3";
import { Buffer } from "node:buffer";

import prisma from "~/lib/prisma";

import { decryptApiKey } from "~~/server/utils/oauthCrypto";

/**
 * GET /api/integrations/immich/people/:personId/thumbnail
 * Proxies person/pet thumbnail requests to Immich (which requires auth headers)
 *
 * Route params:
 * - personId: Required - the ID of the person/pet
 *
 * Query params:
 * - integrationId: Required - the ID of the Immich integration
 */
export default defineEventHandler(async (event) => {
  const personId = getRouterParam(event, "personId");
  const query = getQuery(event);
  const integrationId = query.integrationId as string;

  if (!personId) {
    throw createError({
      statusCode: 400,
      message: "personId route parameter is required",
    });
  }

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

  // Get and decrypt credentials
  const encryptedApiKey = integration.apiKey;
  const baseUrl = integration.baseUrl;

  if (!encryptedApiKey || !baseUrl) {
    throw createError({
      statusCode: 400,
      message: "Immich integration is missing required configuration (API key or URL)",
    });
  }

  let apiKey: string;
  try {
    apiKey = decryptApiKey(encryptedApiKey);
  }
  catch (error) {
    consola.error("Failed to decrypt Immich API key:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to decrypt API credentials",
    });
  }

  try {
    // Fetch person thumbnail from Immich API
    const response = await fetch(`${baseUrl}/api/people/${personId}/thumbnail`, {
      headers: {
        "x-api-key": apiKey,
        "Accept": "image/*",
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
          errorMessage = "Person not found in Immich";
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

    // Get the content type from Immich response
    const contentType = response.headers.get("content-type") || "image/jpeg";

    // Set response headers for the image
    setResponseHeader(event, "Content-Type", contentType);
    setResponseHeader(event, "Cache-Control", "public, max-age=3600");

    // Return the image binary
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error; // Re-throw HTTP errors
    }

    consola.error("Error fetching Immich person thumbnail:", error);

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Failed to fetch person thumbnail from Immich",
    });
  }
});
