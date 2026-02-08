import { consola } from "consola";
import { defineEventHandler, readBody } from "h3";

import prisma from "~/lib/prisma";
// eslint-disable-next-line perfectionist/sort-imports
import { decryptToken } from "../../../integrations/google-calendar/oauth";

/**
 * POST /api/integrations/immich/sync
 * Manually trigger a sync with Immich to fetch new photos
 * This validates the connection and updates the integration's updatedAt timestamp
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { integrationId } = body as { integrationId: string };

    if (!integrationId) {
      throw new Error("Integration ID is required");
    }

    // Find the Immich integration
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      throw new Error("Integration not found");
    }

    if (integration.service !== "immich") {
      throw new Error("This endpoint only supports Immich integrations");
    }

    const storedApiKey = integration.apiKey;
    const baseUrl = integration.baseUrl;

    if (!storedApiKey || !baseUrl) {
      throw new Error("Immich integration missing credentials");
    }

    // Try to decrypt if encrypted, otherwise use as-is
    let apiKey: string;
    try {
      apiKey = decryptToken(storedApiKey);
    }
    catch {
      apiKey = storedApiKey;
    }

    // Test connection by calling the Immich server ping endpoint
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let connectionSuccessful = false;
    let errorMessage: string | null = null;

    try {
      const response = await fetch(`${baseUrl}/api/server/ping`, {
        headers: {
          "x-api-key": apiKey,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        connectionSuccessful = true;
      }
      else {
        errorMessage = `Server responded with status ${response.status}`;
      }
    }
    catch (error) {
      clearTimeout(timeoutId);
      const fetchError = error as Error;
      errorMessage = fetchError.name === "AbortError"
        ? "Connection timed out"
        : fetchError.message || "Failed to connect to Immich";
    }

    // Update the integration's updatedAt timestamp to track last sync
    await prisma.integration.update({
      where: { id: integrationId },
      data: { updatedAt: new Date() },
    });

    if (connectionSuccessful) {
      consola.success(`Immich sync successful for integration ${integration.name}`);
      return {
        success: true,
        message: "Sync successful",
        lastSync: new Date().toISOString(),
      };
    }
    else {
      consola.warn(`Immich sync failed for integration ${integration.name}:`, errorMessage);
      return {
        success: false,
        message: errorMessage || "Sync failed",
        lastSync: new Date().toISOString(),
      };
    }
  }
  catch (error) {
    consola.error("Error during Immich sync:", error);
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Failed to sync with Immich",
    });
  }
});
