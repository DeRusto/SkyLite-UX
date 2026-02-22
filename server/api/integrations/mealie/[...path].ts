import { PrismaClient } from "@prisma/client";
import { consola } from "consola";
import { createError, defineEventHandler, getQuery, readBody } from "h3";

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  const pathParts = event.context.params?.path;
  if (!pathParts) {
    throw createError({
      statusCode: 400,
      message: "Invalid path",
    });
  }

  const method = event.method;
  const query = getQuery(event);
  const body = method !== "GET" ? await readBody(event) : undefined;

  if (method === "POST" && !body) {
    throw createError({
      statusCode: 400,
      message: "Request body is required for POST requests",
    });
  }

  const integrationId = query.integrationId as string;
  if (!integrationId) {
    throw createError({
      statusCode: 400,
      message: "integrationId query parameter is required",
    });
  }

  const integration = await prisma.integration.findFirst({
    where: {
      id: integrationId,
      type: "shopping",
      enabled: true,
    },
  });

  if (!integration || !integration.apiKey || !integration.baseUrl) {
    throw createError({
      statusCode: 404,
      message: "Mealie integration not found or not configured",
    });
  }

  if (integration.type !== "shopping") {
    throw createError({
      statusCode: 400,
      message: "Invalid integration type for Mealie API",
    });
  }

  const baseUrl = integration.baseUrl.endsWith("/") ? integration.baseUrl : `${integration.baseUrl}/`;
  const path = Array.isArray(pathParts) ? pathParts.join("/") : pathParts;

  const { integrationId: _, ...restQuery } = query;
  const queryString = new URLSearchParams();

  Object.entries(restQuery).forEach(([key, value]) => {
    if (key === "integrationId")
      return;
    if (Array.isArray(value)) {
      value.forEach(v => queryString.append(key, v as string));
    }
    else {
      queryString.append(key, value as string);
    }
  });

  const url = `${baseUrl}${path}${queryString.toString() ? `?${queryString.toString()}` : ""}`;

  try {
    const { decryptApiKey } = await import("~~/server/utils/oauthCrypto");
    const decryptedApiKey = decryptApiKey(integration.apiKey);
    const response = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${decryptedApiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw createError({
        statusCode: response.status,
        message: `Mealie API error: ${response.statusText}`,
      });
    }

    const data = await response.json();
    return data;
  }
  catch (error: unknown) {
    consola.error("Integrations Mealie: Error proxying to Mealie:", error);
    const statusCode = error && typeof error === "object" && "statusCode" in error ? Number(error.statusCode) : 500;
    const isDev = import.meta.dev;
    const message = isDev
      ? (error && typeof error === "object" && "message" in error ? String(error.message) : "Failed to proxy request to Mealie")
      : "Integration request failed";
    throw createError({
      statusCode,
      message,
    });
  }
});
