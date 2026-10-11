import { encryptToken as encryptCalendarToken } from "~~/server/integrations/google-calendar/oauth";
import { encryptToken as encryptPhotosToken } from "~~/server/integrations/google-photos/oauth";
import { encryptApiKey } from "~~/server/utils/oauthCrypto";
import { consola } from "consola";
import { createError, defineEventHandler, readBody } from "h3";

import prisma from "~/lib/prisma";
import { createIntegrationService, integrationRegistry } from "~/types/integrations";

import { normalizeWebcalUrl } from "../../utils/icalUrl";
import { sanitizeIntegration } from "../../utils/sanitizeIntegration";

export default defineEventHandler(async (event) => {
  try {
    const id = event.context.params?.id;
    if (!id) {
      throw createError({
        statusCode: 400,
        message: "Integration ID is required",
      });
    }

    const body = await readBody(event);
    const { name, type, service, apiKey, icon, enabled, settings, accessToken, refreshToken, tokenExpiry, tokenType } = body;
    let baseUrl = body.baseUrl;
    if (baseUrl && typeof baseUrl === "string") {
      baseUrl = normalizeWebcalUrl(baseUrl);
    }
    let preservedSettings = settings;

    // Encrypt tokens if provided (Google Calendar/Photos) — fork addition
    let finalAccessToken = accessToken;
    let finalRefreshToken = refreshToken;

    if (service === "google-calendar") {
      if (accessToken)
        finalAccessToken = encryptCalendarToken(accessToken);
      if (refreshToken)
        finalRefreshToken = encryptCalendarToken(refreshToken);
    }
    else if (service === "google-photos") {
      if (accessToken)
        finalAccessToken = encryptPhotosToken(accessToken);
      if (refreshToken)
        finalRefreshToken = encryptPhotosToken(refreshToken);
    }

    if (apiKey || baseUrl || settings || accessToken || refreshToken) {
      const currentIntegration = await prisma.integration.findUnique({
        where: { id },
      });

      if (!currentIntegration) {
        throw createError({
          statusCode: 404,
          message: "Integration not found",
        });
      }

      const updatedData = {
        ...currentIntegration,
        ...(name && { name }),
        ...(type && { type }),
        ...(service && { service }),
        ...(apiKey && { apiKey: encryptApiKey(apiKey) }),
        ...(baseUrl && { baseUrl }),
        ...(icon !== undefined && { icon }),
        ...(enabled !== undefined && { enabled }),
        ...(settings && { settings }),
        ...(finalAccessToken && { accessToken: finalAccessToken }),
        ...(finalRefreshToken && { refreshToken: finalRefreshToken }),
        ...(tokenExpiry && { tokenExpiry: new Date(tokenExpiry) }),
        ...(tokenType && { tokenType }),
      };

      if (settings && typeof settings === "object") {
        const currentSettings = currentIntegration.settings as Record<string, unknown> | null;
        const newSettings = settings as Record<string, unknown>;

        if (!newSettings.clientSecret && currentSettings?.clientSecret) {
          preservedSettings = {
            ...newSettings,
            clientSecret: currentSettings.clientSecret,
          };
          updatedData.settings = preservedSettings;
        }
      }

      const integrationKey = `${updatedData.type}:${updatedData.service}`;
      const integrationConfig = integrationRegistry.get(integrationKey);

      if (integrationConfig) {
        if (type || service) {
          const missingFields = integrationConfig.settingsFields
            .filter(field => field.required)
            .filter((field) => {
              if (field.key === "apiKey")
                return !updatedData.apiKey;
              if (field.key === "baseUrl")
                return !updatedData.baseUrl;
              if (field.key === "name")
                return !updatedData.name;
              if (field.key === "type")
                return !updatedData.type;
              if (field.key === "service")
                return !updatedData.service;
              return false;
            })
            .map(field => field.label);

          if (missingFields.length > 0) {
            throw createError({
              statusCode: 400,
              message: `Missing required fields: ${missingFields.join(", ")}`,
            });
          }
        }

        const hasOAuth = integrationConfig.capabilities.includes("oauth");

        if (!hasOAuth) {
          const tempIntegration = {
            id: "temp",
            type: updatedData.type,
            service: updatedData.service,
            apiKey: updatedData.apiKey,
            baseUrl: updatedData.baseUrl,
            enabled: true,
            name: updatedData.name || "Temp",
            icon: updatedData.icon || null,
            settings: updatedData.settings || {},
            accessToken: updatedData.accessToken || null,
            refreshToken: updatedData.refreshToken || null,
            tokenExpiry: updatedData.tokenExpiry ? new Date(updatedData.tokenExpiry) : null,
            tokenType: updatedData.tokenType || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const integrationService = await createIntegrationService(tempIntegration);
          if (!integrationService) {
            throw createError({
              statusCode: 400,
              message: `Unsupported integration type: ${updatedData.type}:${updatedData.service}`,
            });
          }

          const connectionSuccess = await integrationService.testConnection?.();
          if (!connectionSuccess) {
            const status = await integrationService.getStatus();
            throw createError({
              statusCode: 400,
              message: `Connection test failed: ${status.error || "Unknown error"}`,
            });
          }
        }
      }
    }

    const integration = await prisma.integration.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(service && { service }),
        ...(apiKey && { apiKey: encryptApiKey(apiKey) }),
        ...(baseUrl && { baseUrl }),
        ...(icon !== undefined && { icon }),
        ...(enabled !== undefined && { enabled }),
        ...(preservedSettings && { settings: preservedSettings }),
        ...(finalAccessToken && { accessToken: finalAccessToken }),
        ...(finalRefreshToken && { refreshToken: finalRefreshToken }),
        ...(tokenExpiry && { tokenExpiry: new Date(tokenExpiry) }),
        ...(tokenType && { tokenType }),
      },
    });

    return sanitizeIntegration(integration);
  }
  catch (error: unknown) {
    consola.error("Integrations id put: Error updating integration:", error);
    const statusCode = error && typeof error === "object" && "statusCode" in error ? Number(error.statusCode) : 500;
    const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Failed to update integration";
    throw createError({
      statusCode,
      message,
    });
  }
});
