import { consola } from "consola";
import { createError, defineEventHandler, getQuery } from "h3";

import prisma from "~/lib/prisma";
// eslint-disable-next-line perfectionist/sort-imports
import { decryptToken } from "../../integrations/google-calendar/oauth";

type ImmichSearchResult = {
  assets: {
    items: Array<{
      id: string;
      type: string;
      originalPath: string;
      thumbhash: string | null;
      fileCreatedAt: string;
      exifInfo?: {
        description?: string;
        city?: string;
        state?: string;
        country?: string;
      };
    }>;
    total: number;
    count: number;
    nextPage: string | null;
  };
};

type ImmichAlbumAssets = {
  assets: Array<{
    id: string;
    type: string;
  }>;
};

/**
 * GET /api/screensaver/photos
 * Fetches photos for the screensaver slideshow from configured Immich integration.
 * Supports filtering by selected albums and/or people.
 *
 * Query params:
 * - count: Number of photos to return (default: 20, max: 100)
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const count = Math.min(Math.max(Number(query.count) || 20, 1), 100);

  try {
    // Find enabled Immich photo integration
    const integration = await prisma.integration.findFirst({
      where: {
        type: "photos",
        service: "immich",
        enabled: true,
      },
    });

    if (!integration) {
      return {
        photos: [],
        total: 0,
        message: "No enabled Immich integration found",
      };
    }

    const storedApiKey = integration.apiKey;
    const baseUrl = integration.baseUrl;

    if (!storedApiKey || !baseUrl) {
      return {
        photos: [],
        total: 0,
        message: "Immich integration missing credentials",
      };
    }

    // Try to decrypt if encrypted, otherwise use as-is
    let apiKey: string;
    try {
      apiKey = decryptToken(storedApiKey);
    }
    catch {
      apiKey = storedApiKey;
    }

    // Get filter settings
    const settings = (integration.settings || {}) as Record<string, unknown>;
    const selectedAlbums = Array.isArray(settings.selectedAlbums) ? settings.selectedAlbums as string[] : [];
    const selectedPeople = Array.isArray(settings.selectedPeople) ? settings.selectedPeople as string[] : [];

    const headers = {
      "x-api-key": apiKey,
      "Accept": "application/json",
      "Content-Type": "application/json",
    };

    let photoIds: Set<string> | null = null;
    let albumFetchErrors = 0;

    // If albums are selected, get photos from those albums
    if (selectedAlbums.length > 0) {
      photoIds = new Set<string>();
      for (const albumId of selectedAlbums) {
        try {
          const albumResponse = await fetch(`${baseUrl}/api/albums/${albumId}`, { headers });
          if (albumResponse.ok) {
            const albumData = await albumResponse.json() as ImmichAlbumAssets;
            if (albumData.assets) {
              for (const asset of albumData.assets) {
                if (asset.type === "IMAGE") {
                  photoIds.add(asset.id);
                }
              }
            }
          }
          else {
            albumFetchErrors++;
          }
        }
        catch (err) {
          consola.warn(`Failed to fetch album ${albumId}:`, err);
          albumFetchErrors++;
        }
      }
    }

    // If people are selected, get photos of those people
    let personPhotoIds: Set<string> | null = null;
    let personFetchErrors = 0;
    if (selectedPeople.length > 0) {
      personPhotoIds = new Set<string>();
      for (const personId of selectedPeople) {
        try {
          // Use Immich search/metadata API to find photos of a specific person
          const searchResponse = await fetch(`${baseUrl}/api/search/metadata`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              personIds: [personId],
              type: "IMAGE",
              size: 1000,
            }),
          });
          if (searchResponse.ok) {
            const searchData = await searchResponse.json() as ImmichSearchResult;
            if (searchData.assets?.items) {
              for (const asset of searchData.assets.items) {
                personPhotoIds.add(asset.id);
              }
            }
          }
          else {
            personFetchErrors++;
          }
        }
        catch (err) {
          consola.warn(`Failed to fetch photos for person ${personId}:`, err);
          personFetchErrors++;
        }
      }
    }

    // Combine filters: if both albums AND people selected, intersect the sets
    let finalPhotoIds: string[];

    if (photoIds !== null && personPhotoIds !== null) {
      // Both filters active: intersection (photos in selected albums OF selected people)
      finalPhotoIds = [...photoIds].filter(id => personPhotoIds!.has(id));
    }
    else if (photoIds !== null) {
      // Only album filter
      finalPhotoIds = [...photoIds];
    }
    else if (personPhotoIds !== null) {
      // Only people filter
      finalPhotoIds = [...personPhotoIds];
    }
    else {
      // No filters - get random photos from the library
      try {
        const randomResponse = await fetch(`${baseUrl}/api/search/metadata`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            type: "IMAGE",
            size: count,
          }),
        });
        if (randomResponse.ok) {
          const randomData = await randomResponse.json() as ImmichSearchResult;
          finalPhotoIds = (randomData.assets?.items || []).map(a => a.id);
        }
        else {
          finalPhotoIds = [];
        }
      }
      catch {
        finalPhotoIds = [];
      }
    }

    // Shuffle and limit
    finalPhotoIds = shuffleArray(finalPhotoIds).slice(0, count);

    // Build photo URLs that go through our proxy
    const photos = finalPhotoIds.map(id => ({
      id,
      url: `/api/integrations/immich/thumbnail?integrationId=${integration.id}&assetId=${id}&size=preview`,
    }));

    // Check if all fetches failed and provide user-friendly error
    const totalFetchAttempts = (selectedAlbums.length || 0) + (selectedPeople.length || 0);
    const totalErrors = albumFetchErrors + personFetchErrors;
    const allFetchesFailed = totalFetchAttempts > 0 && totalErrors === totalFetchAttempts;

    return {
      photos,
      total: photos.length,
      filters: {
        albumCount: selectedAlbums.length,
        peopleCount: selectedPeople.length,
      },
      error: allFetchesFailed && photos.length === 0
        ? "Could not connect to Immich server. Please check that the server is running and the URL is correct."
        : undefined,
    };
  }
  catch (error) {
    consola.error("Error fetching screensaver photos:", error);

    // Check if this is a network connectivity error
    const errorMsg = error instanceof Error ? error.message : String(error);
    const isNetworkError = errorMsg.includes("fetch failed")
      || errorMsg.includes("ECONNREFUSED")
      || errorMsg.includes("EHOSTUNREACH")
      || errorMsg.includes("ETIMEDOUT")
      || errorMsg.includes("ENOTFOUND")
      || errorMsg.includes("network");

    // Return empty photos with user-friendly message instead of throwing
    return {
      photos: [],
      total: 0,
      error: isNetworkError
        ? "Could not connect to Immich server. Please check that the server is running and the URL is correct."
        : "Failed to fetch photos from Immich. The service may be temporarily unavailable.",
    };
  }
});

/**
 * Fisher-Yates shuffle
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
