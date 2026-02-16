import { consola } from "consola";
import { createError, defineEventHandler, getQuery, sendRedirect } from "h3";

import { createOAuth2Client, exchangeCodeForTokens } from "../../../../integrations/google-photos/oauth";

/**
 * Handle OAuth2 callback from Google for Photos API
 * Exchanges authorization code for access and refresh tokens
 * Redirects to settings page with encrypted tokens in URL params
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

    // Tokens are now passed in plaintext to the frontend and will be encrypted
    // before database persistence in the integration API handlers.
    const redirectUrl = `/settings?oauth_success=true`
      + `&service=google-photos`
      + `&access_token=${encodeURIComponent(tokenInfo.accessToken)}`
      + `&refresh_token=${encodeURIComponent(tokenInfo.refreshToken)}`
      + `&token_expiry=${tokenInfo.expiryDate}`;

    return sendRedirect(event, redirectUrl);
  }
  catch (err) {
    consola.error("Google Photos OAuth callback error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to exchange authorization code";
    return sendRedirect(event, `/settings?oauth_error=${encodeURIComponent(errorMessage)}`);
  }
});
