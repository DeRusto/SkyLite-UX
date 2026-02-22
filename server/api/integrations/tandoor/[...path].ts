import { PrismaClient } from "@prisma/client";
import { consola } from "consola";
import { createError, defineEventHandler, getQuery, readBody } from "h3";

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  const pathParts = event.context.params?.path;
  if (!pathParts) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid path",
    });
  }

  const method = event.method;
  const query = getQuery(event);
  const body = method !== "GET" ? await readBody(event) : undefined;

  if (method === "POST" && !body) {
    throw createError({
      statusCode: 400,
      statusMessage: "Request body is required for POST requests",
    });
  }

  const integrationId = query.integrationId as string;
  if (!integrationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "integrationId query parameter is required",
    });
  }

  const integration = await prisma.integration.findFirst({
    where: {
      id: integrationId,
      type: "shopping",
      enabled: true,
    },
  });

  if (!integration || !integration.baseUrl) {
    throw createError({
      statusCode: 404,
      statusMessage: "Tandoor integration not found or not configured",
    });
  }

  if (integration.type !== "shopping" || integration.service !== "tandoor") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid integration type for Tandoor API",
    });
  }

  const baseUrl = integration.baseUrl.endsWith("/") ? integration.baseUrl.slice(0, -1) : integration.baseUrl;
  const path = Array.isArray(pathParts) ? pathParts.join("/") : pathParts;

  // Whitelist allowed Tandoor API endpoints to prevent SSRF
  const ALLOWED_TANDOOR_ENDPOINTS = [
    "shopping-list-entry",
    "shopping-list",
    "food",
    "unit",
    "recipe",
    "keyword",
    "ingredient",
    "meal-plan",
  ];

  const firstSegment = path.split("/")[0];
  if (!firstSegment || !ALLOWED_TANDOOR_ENDPOINTS.includes(firstSegment)) {
    throw createError({
      statusCode: 403,
      statusMessage: `Access to Tandoor endpoint "${firstSegment}" is not allowed`,
    });
  }

  const { integrationId: _, ...restQuery } = query;
  const url = `${baseUrl}/api/${path}${Object.keys(restQuery).length ? `?${new URLSearchParams(restQuery as Record<string, string>).toString()}` : ""}`;

  try {
    const fixedUrl = url.charAt(url.length - 1) === "/" ? url : `${url}/`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Host": "localhost",
    };

    if (integration.apiKey) {
      const { decryptApiKey } = await import("~~/server/utils/oauthCrypto");
      headers.Authorization = `Bearer ${decryptApiKey(integration.apiKey)}`;
    }

    const response = await fetch(fixedUrl, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      consola.error("Integrations Tandoor: API error response:", errorText);
      throw createError({
        statusCode: response.status,
        statusMessage: `Tandoor API error: ${response.status} ${response.statusText} - ${errorText}`,
      });
    }

    return await response.json();
  }
  catch (error: unknown) {
    consola.error("Integrations Tandoor: Error proxying request to Tandoor:", error);
    const statusCode = error && typeof error === "object" && "statusCode" in error ? Number(error.statusCode) : 500;
    const isDev = import.meta.dev;
    const message = isDev
      ? (error && typeof error === "object" && "statusMessage" in error ? String(error.statusMessage) : (error && typeof error === "object" && "message" in error ? String(error.message) : "Failed to proxy request to Tandoor"))
      : "Integration request failed";
    throw createError({
      statusCode,
      statusMessage: message,
    });
  }
});
