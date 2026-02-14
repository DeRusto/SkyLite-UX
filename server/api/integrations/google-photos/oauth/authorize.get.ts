import { consola } from "consola";
import { defineEventHandler, sendRedirect } from "h3";

import { createOAuth2Client, generateAuthUrl } from "../../../../integrations/google-photos/oauth";

/**
 * Initiate Google OAuth2 authorization flow for Photos API
 * Redirects user to Google consent screen
 */
export default defineEventHandler(async (event) => {
  const oauth2Client = createOAuth2Client();

  const authUrl = generateAuthUrl(oauth2Client);
  consola.debug("Google Photos Auth URL:", authUrl);

  return sendRedirect(event, authUrl);
});
