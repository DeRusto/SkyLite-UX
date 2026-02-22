import { consola } from "consola";
import { createError, defineEventHandler, getHeader } from "h3";

/**
 * CSRF and basic request origin protection middleware.
 * For state-mutating API routes (POST/PUT/PATCH/DELETE), validates that
 * requests originate from the same site. This prevents cross-origin
 * requests from malicious websites while allowing same-origin app usage.
 *
 * This is appropriate for a self-hosted family app with no external
 * authentication system - network-level isolation is assumed.
 */
export default defineEventHandler((event) => {
  const url = event.node.req.url || "";
  const method = event.node.req.method || "GET";

  // Only protect state-mutating methods on API routes
  if (!url.startsWith("/api/") || !["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return;
  }

  // Skip OAuth callback routes - they receive redirects from Google
  const oauthRoutes = [
    "/api/integrations/google-calendar/oauth/callback",
    "/api/integrations/google-photos/oauth/callback",
  ];
  if (oauthRoutes.some(route => url.startsWith(route))) {
    return;
  }

  const origin = getHeader(event, "origin");
  const referer = getHeader(event, "referer");
  const host = getHeader(event, "host");

  // Allow requests with no Origin header - these are typically same-origin
  // fetch requests or server-to-server calls (not browser cross-origin requests)
  if (!origin) {
    return;
  }

  // Validate Origin matches the host (same-site check)
  if (host) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host === host) {
        return; // Same origin - allow
      }
    }
    catch {
      // Malformed origin - log and reject
      consola.warn(`CSRF: Malformed origin header: ${origin}`);
      throw createError({
        statusCode: 403,
        statusMessage: "Forbidden: Invalid request origin",
      });
    }

    consola.warn(`CSRF: Cross-origin ${method} request blocked. Origin: ${origin}, Host: ${host}, URL: ${url}, Referer: ${referer || "none"}`);
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden: Cross-origin requests are not allowed",
    });
  }
});
