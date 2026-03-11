import type { IntegrationService, IntegrationStatus } from "~/types/integrations";

export type OpenMeteoWeatherSettings = {
  location?: string;
  units?: string;
};

type GeocodingResult = {
  latitude: number;
  longitude: number;
  name: string;
  country: string;
  admin1?: string;
};

type GeocodingResponse = {
  results?: GeocodingResult[];
};

type ResolvedCoords = {
  lat: number;
  lon: number;
};

async function resolveLocationToCoords(location: string): Promise<ResolvedCoords | null> {
  const trimmed = location.trim();

  // Check if already in lat,lon coordinate format
  const coordMatch = trimmed.match(/^(-?\d+(?:\.\d*)?),\s*(-?\d+(?:\.\d*)?)$/);
  if (coordMatch && coordMatch[1] && coordMatch[2]) {
    const lat = Number.parseFloat(coordMatch[1]);
    const lon = Number.parseFloat(coordMatch[2]);
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return { lat, lon };
    }
    return null;
  }

  // Use Open-Meteo geocoding API for city names or zip codes
  try {
    const response = await $fetch<GeocodingResponse>(
      "https://geocoding-api.open-meteo.com/v1/search",
      {
        query: {
          name: trimmed,
          count: 1,
          language: "en",
          format: "json",
        },
      },
    );

    if (response.results && response.results.length > 0) {
      const result = response.results[0];
      return {
        lat: result.latitude,
        lon: result.longitude,
      };
    }

    return null;
  }
  catch (error) {
    throw new Error(
      error instanceof Error
        ? `Failed to resolve location: ${error.message}`
        : "Failed to resolve location",
    );
  }
}
  }
}

function isValidLocationFormat(location: string): boolean {
  const trimmed = location.trim();

  // lat,lon coordinate format
  const coordMatch = trimmed.match(/^(-?\d+(?:\.\d*)?),\s*(-?\d+(?:\.\d*)?)$/);
  if (coordMatch) return true;

  // 5-digit US zip code
  if (/^\d{5}$/.test(trimmed)) return true;

  // City name or "city, state" — at least 2 characters
  if (trimmed.length >= 2) return true;

  return false;
}

export function createOpenMeteoWeatherService(
  _id: string,
  settings?: OpenMeteoWeatherSettings,
): IntegrationService {
  const location = settings?.location || "";
  const units = settings?.units || "fahrenheit";
  let isConnected = false;
  let lastError: string | undefined;
  let resolvedCoords: ResolvedCoords | undefined;

  return {
    async initialize() {
      if (!location) {
        isConnected = false;
        lastError = "Location is required";
        return;
      }

      try {
        const coords = await resolveLocationToCoords(location);
        if (!coords) {
          isConnected = false;
          lastError = `Could not resolve location "${location}". Use coordinates (lat,lon), a US zip code, or a city name.`;
          return;
        }

        resolvedCoords = coords;
        const response = await $fetch("/api/weather/current", {
          query: { lat: coords.lat, lon: coords.lon, units },
        });
        isConnected = !!response;
        lastError = undefined;
      }
      catch (error) {
        isConnected = false;
        lastError = error instanceof Error ? error.message : "Failed to connect to Open-Meteo";
      }
    },

    async validate() {
      if (!location) {
        lastError = "Location is required";
        return false;
      }

      if (!isValidLocationFormat(location)) {
        lastError = "Location must be coordinates (lat,lon), a US zip code, or a city name (e.g., \"Chicago\" or \"Chicago, IL\")";
        return false;
      }

      // For coordinate input, validate range
      const coordMatch = location.trim().match(/^(-?\d+(?:\.\d*)?),\s*(-?\d+(?:\.\d*)?)$/);
      if (coordMatch && coordMatch[1] && coordMatch[2]) {
        const lat = Number.parseFloat(coordMatch[1]);
        const lon = Number.parseFloat(coordMatch[2]);
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          lastError = "Coordinates out of range. Latitude must be -90 to 90, longitude -180 to 180.";
          return false;
        }
      }

      lastError = undefined;
      return true;
    }
    },

    async getStatus(): Promise<IntegrationStatus> {
      return {
        isConnected,
        lastChecked: new Date(),
        error: lastError,
      };
    },

    async testConnection(): Promise<boolean> {
      if (!location) {
        isConnected = false;
        lastError = "Location is required";
        return false;
      }

      try {
        const coords = resolvedCoords || await resolveLocationToCoords(location);
        if (!coords) {
          isConnected = false;
          lastError = `Could not resolve location "${location}". Use coordinates (lat,lon), a US zip code, or a city name.`;
          return false;
        }

        resolvedCoords = coords;
        const response = await $fetch("/api/weather/current", {
          query: { lat: coords.lat, lon: coords.lon, units },
        });
        isConnected = !!response;
        lastError = undefined;
        return true;
      }
      catch (error) {
        isConnected = false;
        lastError = error instanceof Error ? error.message : "Failed to connect to Open-Meteo";
        return false;
      }
    },

    async getCapabilities(): Promise<string[]> {
      return ["get_current", "get_forecast"];
    },
  };
}
