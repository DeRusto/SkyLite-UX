import { consola } from "consola";
import { createError, defineEventHandler, getQuery, sendRedirect } from "h3";

import { createOAuth2Client, exchangeCodeForTokens } from "../../../../integrations/google-photos/oauth";

/**
 * Handle OAuth2 callback from Google for Photos API
 * Exchanges authorization code for access and refresh tokens
 * Stores tokens server-side and redirects with a one-time session token
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = query.code as string;
  const error = query.error as string;

  // Handle user denial or error from Google
  if (error) {
    consola.warn(`Google Photos OAuth error: ${error}`);
    return sendRedirect(event, `/settings?oauth_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    throw createError({
      statusCode: 400,
      message: "Authorization code not provided",
    });
  }

  try {
    const oauth2Client = createOAuth2Client();

    // Exchange code for tokens
    const tokenInfo = await exchangeCodeForTokens(oauth2Client, code);

    const { storeOAuthSession } = await import("../../../../utils/oauthSessionStore");
    const sessionToken = storeOAuthSession({
      accessToken: tokenInfo.accessToken,
      refreshToken: tokenInfo.refreshToken,
      expiryDate: tokenInfo.expiryDate,
      service: "google-photos",
    });

    return sendRedirect(event, `/settings?oauth_success=true&service=google-photos&session_token=${sessionToken}`);
  }
  catch (err) {
    consola.error("Google Photos OAuth callback error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to exchange authorization code";
    return sendRedirect(event, `/settings?oauth_error=${encodeURIComponent(errorMessage)}`);
  }
});
