import { consola } from "consola";
import { addDays } from "date-fns";
import { createError, defineEventHandler, getQuery, setResponseHeader } from "h3";
import { Buffer } from "node:buffer";

import prisma from "~/lib/prisma";

import { decryptApiKey } from "~/server/utils/oauthCrypto";

// Cache expiration: 7 days
const CACHE_EXPIRY_DAYS = 7;

// Module-level: track last prune time
let lastPruneTime = 0;
const PRUNE_INTERVAL_MS = 60_000; // at most once per minute

/**
 * GET /api/integrations/immich/thumbnail
 * Proxies thumbnail requests to Immich (which requires auth headers)
 * Implements server-side caching for improved performance and offline capability
 *
 * Query params:
 * - integrationId: Required - the ID of the Immich integration
 * - assetId: Required - the ID of the asset or person to fetch the thumbnail for
 * - size: Optional - thumbnail size ("thumbnail" or "preview", default "thumbnail")
 * - type: Optional - "asset" (default) or "person" for face thumbnails
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const integrationId = query.integrationId as string;
  const assetId = query.assetId as string;
  const size = (query.size as string) || "thumbnail";
  const thumbnailType = (query.type as string) || "asset";

  if (!integrationId) {
    throw createError({
      statusCode: 400,
      message: "integrationId query parameter is required",
    });
  }

  if (!assetId) {
    throw createError({
      statusCode: 400,
      message: "assetId query parameter is required",
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

  // Check cache first (only for assets, not person thumbnails)
  if (thumbnailType === "asset") {
    try {
      // Periodically clean up expired cache entries (10% chance to avoid overhead)
      const nowTs = Date.now();
      if (Math.random() < 0.1 && nowTs - lastPruneTime > PRUNE_INTERVAL_MS) {
        lastPruneTime = nowTs;
        prisma.photoCache.deleteMany({
          where: { expiresAt: { lt: new Date() } },
        }).catch(err => consola.warn("Failed to prune photo cache:", err));
      }

      const cachedPhoto = await prisma.photoCache.findUnique({
        where: {
          integrationId_assetId_size: {
            integrationId,
            assetId,
            size,
          },
        },
      });

      if (cachedPhoto && cachedPhoto.expiresAt > new Date()) {
        consola.debug(`Photo cache hit for ${assetId} (${size})`);

        // Set cache headers for browser
        setResponseHeader(event, "Content-Type", cachedPhoto.contentType);
        setResponseHeader(event, "Cache-Control", "public, max-age=3600");
        setResponseHeader(event, "X-Photo-Cache", "HIT");

        // Return cached image
        return Buffer.from(cachedPhoto.imageData);
      }
      else if (cachedPhoto) {
        // Cache expired, delete it
        await prisma.photoCache.delete({
          where: { id: cachedPhoto.id },
        });
      }
    }
    catch (err) {
      consola.warn("Error checking photo cache:", err);
      // Continue to fetch from Immich
    }
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
    // Build the correct Immich URL based on thumbnail type
    const thumbnailUrl = thumbnailType === "person"
      ? `${baseUrl}/api/people/${assetId}/thumbnail`
      : `${baseUrl}/api/assets/${assetId}/thumbnail?size=${size}`;

    // Fetch thumbnail from Immich API
    const response = await fetch(thumbnailUrl, {
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
          errorMessage = "Asset not found in Immich";
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

    // Get the image data
    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // Cache the photo (only for assets, not person thumbnails)
    if (thumbnailType === "asset") {
      try {
        const expiresAt = addDays(new Date(), CACHE_EXPIRY_DAYS);

        await prisma.photoCache.upsert({
          where: {
            integrationId_assetId_size: {
              integrationId,
              assetId,
              size,
            },
          },
          create: {
            integrationId,
            assetId,
            size,
            imageData: imageBuffer,
            contentType,
            expiresAt,
          },
          update: {
            imageData: imageBuffer,
            contentType,
            expiresAt,
          },
        });

        consola.debug(`Cached photo ${assetId} (${size}) until ${expiresAt.toISOString()}`);
      }
      catch (err) {
        consola.warn("Failed to cache photo:", err);
        // Continue anyway - we have the image
      }
    }

    // Set response headers for the image
    setResponseHeader(event, "Content-Type", contentType);
    setResponseHeader(event, "Cache-Control", "public, max-age=3600");
    setResponseHeader(event, "X-Photo-Cache", "MISS");

    // Return the image binary
    return imageBuffer;
  }
  catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error; // Re-throw HTTP errors
    }

    consola.error("Error fetching Immich thumbnail:", error);

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Failed to fetch thumbnail from Immich",
    });
  }
});
