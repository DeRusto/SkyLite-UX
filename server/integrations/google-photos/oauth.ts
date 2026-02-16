import type { OAuth2Client } from "google-auth-library";

import { consola } from "consola";
import { google } from "googleapis";

import type { TokenInfo } from "../google-calendar/types";

export { decryptToken, encryptToken, getEncryptionKey } from "../../utils/oauthCrypto";

/**
 * Create Google OAuth2 client with credentials from environment
 * Google Photos uses the same OAuth client but with different scopes
 * @returns Configured OAuth2Client instance
 */
export function createOAuth2Client(): OAuth2Client {
  const config = useRuntimeConfig();
  const clientId = config.googleClientId as string;
  const clientSecret = config.googleClientSecret as string;
  // Derive Google Photos redirect URI from the main one (usually Calendar's)
  // This ensures we respect the configured domain/port
  const baseRedirectUri = (config.googleRedirectUri as string) || "http://localhost:8877/api/integrations/google-calendar/oauth/callback";
  const redirectUri = baseRedirectUri.replace("google-calendar", "google-photos");

  consola.debug("Google Photos Redirect URI:", redirectUri);

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
 * Generate Google OAuth2 authorization URL for Photos API
 * @param oauth2Client - OAuth2 client instance
 * @param state - Optional state parameter for CSRF protection
 * @returns Authorization URL to redirect user to
 */
export function generateAuthUrl(oauth2Client: OAuth2Client, state?: string): string {
  // Google Photos API scopes
  const scopes = [
    "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
    "email",
    "profile",
    "openid",
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

    consola.debug("Received tokens with scopes:", tokens.scope);

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
