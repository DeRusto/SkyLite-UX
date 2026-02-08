import { consola } from "consola";

import { createOAuth2Client, decryptToken, refreshAccessToken } from "./oauth";

export type GooglePhotosAlbum = {
  id: string;
  title: string;
  productUrl: string;
  mediaItemsCount: string;
  coverPhotoBaseUrl?: string;
  coverPhotoMediaItemId?: string;
};

export type GooglePhotosMediaItem = {
  id: string;
  description?: string;
  productUrl: string;
  baseUrl: string;
  mimeType: string;
  mediaMetadata?: {
    creationTime?: string;
    width?: string;
    height?: string;
    photo?: {
      cameraMake?: string;
      cameraModel?: string;
    };
  };
  filename: string;
};

export type GooglePhotosClient = {
  listAlbums: () => Promise<GooglePhotosAlbum[]>;
  getAlbumPhotos: (albumId: string, pageSize?: number) => Promise<GooglePhotosMediaItem[]>;
  getPhotos: (pageSize?: number) => Promise<GooglePhotosMediaItem[]>;
};

/**
 * Create a Google Photos API client
 * @param encryptedAccessToken - Encrypted access token
 * @param encryptedRefreshToken - Encrypted refresh token
 * @param tokenExpiry - Token expiry timestamp
 * @returns Google Photos client with methods to fetch albums and photos
 */
export async function createGooglePhotosClient(
  encryptedAccessToken: string | null,
  encryptedRefreshToken: string | null,
  tokenExpiry: Date | null,
): Promise<GooglePhotosClient> {
  if (!encryptedAccessToken || !encryptedRefreshToken) {
    throw new Error("OAuth tokens are required - please authorize Google Photos first");
  }

  const oauth2Client = createOAuth2Client();
  let accessToken = decryptToken(encryptedAccessToken);
  const refreshToken = decryptToken(encryptedRefreshToken);

  // Check if token is expired and refresh if needed
  if (tokenExpiry && new Date(tokenExpiry) < new Date()) {
    consola.info("Google Photos access token expired, refreshing...");
    const newTokens = await refreshAccessToken(oauth2Client, refreshToken);
    accessToken = newTokens.accessToken;
  }

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  // DEBUG: Check token scopes directly from Google
  try {
    const infoUrl = `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`;
    // consola.info("DEBUG: Checking token info at", infoUrl);
    const infoRes = await fetch(infoUrl);
    const info = await infoRes.json();
    console.log("DEBUG: Token verification (scopes):", info.scope);
    if (info.error) {
      console.error("DEBUG: Token info error:", info.error_description);
    }
  }
  catch (e) {
    console.error("DEBUG: Failed to verify token scopes:", e);
  }

  // Google Photos API base URL
  const PHOTOS_API_BASE = "https://photoslibrary.googleapis.com/v1";

  /**
   * List all albums accessible to the user
   */
  /**
   * List all albums accessible to the user
   */
  async function listAlbums(): Promise<GooglePhotosAlbum[]> {
    try {
      const albums: GooglePhotosAlbum[] = [];
      let pageToken: string | undefined;

      do {
        const url = new URL(`${PHOTOS_API_BASE}/albums`);
        url.searchParams.set("pageSize", "50");
        if (pageToken) {
          url.searchParams.set("pageToken", pageToken);
        }

        const response = await oauth2Client.request<{ albums?: GooglePhotosAlbum[]; nextPageToken?: string }>({
          url: url.toString(),
          method: "GET",
        });

        if (response.status !== 200) {
          throw new Error(`Failed to fetch albums: ${response.status} ${response.statusText}`);
        }

        const data = response.data;
        if (data.albums) {
          albums.push(...data.albums);
        }
        pageToken = data.nextPageToken;
      } while (pageToken);

      return albums;
    }
    catch (error) {
      consola.error("Error listing Google Photos albums:", error);
      throw error;
    }
  }

  /**
   * Get photos from a specific album
   */
  /**
   * Get photos from a specific album
   */
  async function getAlbumPhotos(albumId: string, pageSize: number = 50): Promise<GooglePhotosMediaItem[]> {
    try {
      const response = await oauth2Client.request<{ mediaItems?: GooglePhotosMediaItem[] }>({
        url: `${PHOTOS_API_BASE}/mediaItems:search`,
        method: "POST",
        data: {
          albumId,
          pageSize,
        },
      });

      if (response.status !== 200) {
        throw new Error(`Failed to fetch album photos: ${response.status}`);
      }

      return response.data.mediaItems || [];
    }
    catch (error) {
      consola.error("Error fetching album photos:", error);
      throw error;
    }
  }

  /**
   * Get recent photos (not from a specific album)
   */
  /**
   * Get recent photos (not from a specific album)
   */
  async function getPhotos(pageSize: number = 50): Promise<GooglePhotosMediaItem[]> {
    try {
      const response = await oauth2Client.request<{ mediaItems?: GooglePhotosMediaItem[] }>({
        url: `${PHOTOS_API_BASE}/mediaItems?pageSize=${pageSize}`,
        method: "GET",
      });

      if (response.status !== 200) {
        throw new Error(`Failed to fetch photos: ${response.status}`);
      }

      return response.data.mediaItems || [];
    }
    catch (error) {
      consola.error("Error fetching photos:", error);
      throw error;
    }
  }

  return {
    listAlbums,
    getAlbumPhotos,
    getPhotos,
  };
}
