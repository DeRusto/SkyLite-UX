// Home Assistant Weather Integration - Forecast
// Fetches forecast data from a Home Assistant weather entity using the weather.get_forecasts service

import { PrismaClient } from "@prisma/client";
import { consola } from "consola";

type HomeAssistantForecastItem = {
  condition: string;
  datetime: string;
  wind_bearing?: number;
  cloud_coverage?: number;
  temperature: number;
  templow?: number;
  pressure?: number;
  wind_speed?: number;
  precipitation?: number;
  precipitation_probability?: number;
  humidity?: number;
};

type HomeAssistantForecastResponse = {
  service_response: Record<string, {
    forecast: HomeAssistantForecastItem[];
  }>;
};

// Map Home Assistant weather states to icons
const weatherStateToIcon: Record<string, string> = {
  "clear-night": "i-lucide-moon",
  "cloudy": "i-lucide-cloud",
  "exceptional": "i-lucide-alert-triangle",
  "fog": "i-lucide-cloud-fog",
  "hail": "i-lucide-cloud-hail",
  "lightning": "i-lucide-cloud-lightning",
  "lightning-rainy": "i-lucide-cloud-lightning",
  "partlycloudy": "i-lucide-cloud-sun",
  "pouring": "i-lucide-cloud-rain",
  "rainy": "i-lucide-cloud-rain",
  "snowy": "i-lucide-cloud-snow",
  "snowy-rainy": "i-lucide-cloud-snow",
  "sunny": "i-lucide-sun",
  "windy": "i-lucide-wind",
  "windy-variant": "i-lucide-wind",
};

// Map Home Assistant weather states to descriptions
const weatherStateToDescription: Record<string, string> = {
  "clear-night": "Clear night",
  "cloudy": "Cloudy",
  "exceptional": "Exceptional",
  "fog": "Foggy",
  "hail": "Hail",
  "lightning": "Lightning",
  "lightning-rainy": "Thunderstorm",
  "partlycloudy": "Partly cloudy",
  "pouring": "Heavy rain",
  "rainy": "Rainy",
  "snowy": "Snowy",
  "snowy-rainy": "Snow and rain",
  "sunny": "Sunny",
  "windy": "Windy",
  "windy-variant": "Windy",
};

export default defineEventHandler(async (event) => {
  const { integrationId, entityId } = getQuery(event) as { integrationId: string; entityId: string };
  const prisma = new PrismaClient(); // Ideally import this from lib

  if (!integrationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Integration ID is required",
    });
  }

  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration) {
    throw createError({
      statusCode: 404,
      statusMessage: "Integration not found",
    });
  }

  const baseUrl = integration.baseUrl;
  const apiKey = integration.apiKey;
  const targetEntityId = entityId || (integration.settings as any)?.entityId || "weather.home";

  if (!baseUrl || !apiKey) {
    throw createError({
      statusCode: 400,
      statusMessage: "Home Assistant URL and API key are required (missing in integration config)",
    });
  }

  try {
    // Call the weather.get_forecasts service
    const response = await $fetch<HomeAssistantForecastResponse>(
      `${baseUrl}/api/services/weather/get_forecasts?return_response`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: {
          entity_id: targetEntityId,
          type: "daily",
        },
      },
    );

    consola.info("HA Forecast Response:", JSON.stringify(response, null, 2));
    consola.info("Target Entity ID:", targetEntityId);

    const entityData = response.service_response?.[targetEntityId];
    if (!entityData || !entityData.forecast) {
      throw createError({
        statusCode: 404,
        statusMessage: "No forecast data returned from Home Assistant",
      });
    }

    const forecast = entityData.forecast;

    // Process daily data (7 days)
    const daily = forecast.slice(0, 7).map((item) => {
      const date = item.datetime.split("T")[0]!; // Extract YYYY-MM-DD
      const condition = weatherStateToDescription[item.condition] || item.condition;
      const icon = weatherStateToIcon[item.condition] || "i-lucide-cloud";

      return {
        date,
        dayName: new Date(date).toLocaleDateString("en-US", { weekday: "short" }),
        high: Math.round(item.temperature),
        low: Math.round(item.templow ?? item.temperature), // Fallback if no low
        condition,
        icon,
        precipProbability: item.precipitation_probability ?? 0,
        uvIndex: 0, // HA doesn't typically provide UV in standard forecast
        windSpeed: Math.round(item.wind_speed ?? 0),
      };
    });

    // Estimate hourly data (HA daily forecast doesn't give hourly, so we might return empty or mock it if needed)
    // For now, we will leave hourly empty as the UI handles missing hourly gracefully
    const hourly: any[] = [];

    return {
      hourly,
      daily,
      units: "fahrenheit", // NOTE: We might need to fetch the entity state to know the units, or assume based on user settings.
      // For now defaulting to fahrenheit but we could check unit_system or entity attributes if critical.
      location: { lat: 0, lon: 0 }, // We don't have location coords easily, sending 0,0
      fetchedAt: new Date().toISOString(),
    };
  }
  catch (error: any) {
    consola.error("Failed to fetch Home Assistant forecast:", error);
    if (error.data) {
      consola.error("HA Response Data:", error.data);
    }
    throw createError({
      statusCode: 503,
      statusMessage: `Failed to fetch forecast from Home Assistant: ${error.message}`,
    });
  }
});
