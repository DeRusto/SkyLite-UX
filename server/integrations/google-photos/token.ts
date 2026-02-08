import { consola } from "consola";

import prisma from "~/lib/prisma";

import { createOAuth2Client, decryptToken, encryptToken, refreshAccessToken } from "./oauth";

/**
 * Ensures a valid access token is available for the given integration.
 * Checks expiry and refreshes if needed, updating the database.
 */
export async function ensureValidAccessToken(integrationId: string) {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration) {
    throw new Error("Integration not found");
  }

  if (!integration.accessToken || !integration.refreshToken || !integration.tokenExpiry) {
    throw new Error("Integration missing OAuth credentials");
  }

  const now = new Date();
  // Refresh if expired or expiring in next 5 minutes
  if (now.getTime() > integration.tokenExpiry.getTime() - 5 * 60 * 1000) {
    consola.info(`Refreshing access token for integration ${integrationId}`);

    const oauth2Client = createOAuth2Client();
    const tokens = await refreshAccessToken(oauth2Client, integration.refreshToken);

    // Update DB
    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        accessToken: encryptToken(tokens.accessToken),
        refreshToken: tokens.refreshToken,
        tokenExpiry: new Date(tokens.expiryDate),
      },
    });

    return tokens.accessToken; // Return PLAIN token
  }

  // Token is valid. Decrypt it for use.
  // Note: `integration.accessToken` is encrypted string in DB.
  return decryptToken(integration.accessToken);
}
