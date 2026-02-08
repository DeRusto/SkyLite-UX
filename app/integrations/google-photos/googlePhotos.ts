import type { IntegrationService, IntegrationStatus } from "~/types/integrations";

export type GooglePhotosSettings = {
  selectedAlbums?: string[];
};

/**
 * Create a Google Photos service instance
 * This is the client-side service that interacts with the Google Photos integration
 */
export function createGooglePhotosService(
  id: string,
  accessToken?: string | null,
  refreshToken?: string | null,
  tokenExpiry?: Date | null,
): IntegrationService {
  const isAuthenticated = Boolean(accessToken && refreshToken);

  return {
    async initialize() {
      // No initialization needed - OAuth handles auth
    },

    async validate(): Promise<boolean> {
      return isAuthenticated;
    },

    async getStatus(): Promise<IntegrationStatus> {
      return {
        isConnected: isAuthenticated,
        lastChecked: new Date(),
        error: isAuthenticated ? undefined : "Not authenticated with Google Photos",
      };
    },

    async testConnection(): Promise<boolean> {
      // With Picker API, we don't have a list endpoint to test against.
      // We rely on OAuth success.
      return isAuthenticated;
    },
  };
}
