import { defineEventHandler, sendRedirect } from "h3";

import { createOAuth2Client, generateAuthUrl } from "../../../../integrations/google-photos/oauth";

/**
 * Initiate Google OAuth2 authorization flow for Photos API
 * Redirects user to Google consent screen
 */
export default defineEventHandler(async (event) => {
  const oauth2Client = createOAuth2Client();

  // Generate authorization URL with Photos scopes
  const authUrl = generateAuthUrl(oauth2Client);
  console.log("DEBUG: Google Photos Auth URL:", authUrl);

  // Redirect to Google consent screen
  return sendRedirect(event, authUrl);
});
