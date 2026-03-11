import type { IntegrationService, IntegrationStatus } from "~/types/integrations";

export type OpenMeteoWeatherSettings = {
  location?: string;
  units?: string;
};

export function createOpenMeteoWeatherService(
  _id: string,
  settings?: OpenMeteoWeatherSettings,
): IntegrationService {
  const location = settings?.location || "";
  const units = settings?.units || "fahrenheit";
  let isConnected = false;
  let lastError: string | undefined;

  return {
    async initialize() {
      try {
        const response = await $fetch("/api/weather/current", {
          query: { location, units },
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
      return true;
    },

    async getStatus(): Promise<IntegrationStatus> {
      return {
        isConnected,
        lastChecked: new Date(),
        error: lastError,
      };
    },

    async testConnection(): Promise<boolean> {
      try {
        const response = await $fetch("/api/weather/current", {
          query: { location, units },
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
