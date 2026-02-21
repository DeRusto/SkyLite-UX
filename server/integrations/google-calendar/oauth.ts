import type { OAuth2Client } from "google-auth-library";

import { consola } from "consola";
import { google } from "googleapis";

import type { TokenInfo } from "./types";

export { decryptToken, encryptToken, getEncryptionKey } from "../../utils/oauthCrypto";

/**
 * Create Google OAuth2 client with credentials from environment
 * @returns Configured OAuth2Client instance
 */
export function createOAuth2Client(): OAuth2Client {
  const config = useRuntimeConfig();
  const clientId = config.googleClientId as string;
  const clientSecret = config.googleClientSecret as string;
  const redirectUri = (config.googleRedirectUri as string) || "http://localhost:3000/api/integrations/google-calendar/oauth/callback";

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required");
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri,
  );
}

/**
 * Refresh an expired access token using refresh token
 * @param oauth2Client - OAuth2 client instance
 * @param refreshToken - Refresh token (plain text)
 * @returns New access token and expiry date
 */
export async function refreshAccessToken(
  oauth2Client: OAuth2Client,
  refreshToken: string,
): Promise<TokenInfo> {
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token || !credentials.expiry_date) {
      throw new Error("Failed to refresh access token: missing credentials");
    }

    return {
      accessToken: credentials.access_token,
      refreshToken: credentials.refresh_token || refreshToken,
      expiryDate: credentials.expiry_date,
    };
  }
  catch (error) {
    consola.error("Failed to refresh access token:", error);
    throw new Error("Token refresh failed - re-authorization required");
  }
}

/**
 * Generate Google OAuth2 authorization URL
 * @param oauth2Client - OAuth2 client instance
 * @param state - Optional state parameter for CSRF protection
 * @returns Authorization URL to redirect user to
 */
export function generateAuthUrl(oauth2Client: OAuth2Client, state?: string): string {
  const scopes = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
  ];

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
    state,
  });
}

/**
 * Exchange authorization code for tokens
 * @param oauth2Client - OAuth2 client instance
 * @param code - Authorization code from OAuth callback
 * @returns Token information
 */
export async function exchangeCodeForTokens(
  oauth2Client: OAuth2Client,
  code: string,
): Promise<TokenInfo> {
  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
      throw new Error("Incomplete token response from Google");
    }

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
    };
  }
  catch (error) {
    consola.error("Failed to exchange code for tokens:", error);
    throw new Error("Failed to exchange authorization code");
  }
}
