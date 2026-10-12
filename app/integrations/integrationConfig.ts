import type { ShoppingListItem, TodoListItem } from "~/types/database";
import type {
  GoogleCalendarSettings,
  ICalSettings,
  IntegrationConfig,
} from "~/types/integrations";
import type { DialogField } from "~/types/ui";

import type { HomeAssistantWeatherSettings } from "./home-assistant/homeAssistantWeather";
import type { ImmichSettings } from "./immich/immichPhotos";
import type { OpenMeteoWeatherSettings } from "./open-meteo/openMeteoWeather";

import {
  createGoogleCalendarService,
  handleGoogleCalendarSave,
} from "./google_calendar/googleCalendar";
import { createHomeAssistantWeatherService } from "./home-assistant/homeAssistantWeather";
import { createICalService } from "./iCal/iCalendar";
import { createImmichService } from "./immich/immichPhotos";
import {
  createMealieService,
  getMealieFieldsForItem,
} from "./mealie/mealieShoppingLists";
import { createOpenMeteoWeatherService } from "./open-meteo/openMeteoWeather";
import {
  createTandoorService,
  getTandoorFieldsForItem,
} from "./tandoor/tandoorShoppingLists";

export const integrationConfigs: IntegrationConfig[] = [
  // ================================================
  // Calendar integration configs can support the following capabilities:
  // - get_events: Can get events from the calendar
  // - add_events: Can add events to the calendar
  // - edit_events: Can edit events in the calendar
  // - delete_events: Can delete events from the calendar
  // - oauth: Can authenticate using OAuth
  // - select_calendars: Can select calendars from the user's account
  //   - individual calendars define access role: read or write
  //   - if access role is read, add_events, edit_events, and delete_events permissions are stripped
  // - select_users: Can select users to link to the calendar event (currently only enables the user selection in the event dialog if declared)
  // ================================================
  {
    type: "calendar",
    service: "iCal",
    settingsFields: [
      {
        key: "baseUrl",
        label: "URL",
        type: "url" as const,
        placeholder: "https://example.com/calendar.ics",
        required: true,
        description: "Your iCal URL",
      },
      {
        key: "user",
        label: "User",
        type: "text" as const,
        placeholder: "Jane Doe",
        required: false,
        description:
          "Select user(s) to link to this calendar or choose an event color",
      },
      {
        key: "eventColor",
        label: "Event Color",
        type: "color" as const,
        placeholder: "#06b6d4",
        required: false,
      },
      {
        key: "useUserColors",
        label: "Use User Profile Colors",
        type: "boolean" as const,
        required: false,
        description:
          "Use individual user profile colors for events instead of a single event color",
      },
    ],
    capabilities: ["get_events"],
    icon: "https://unpkg.com/lucide-static@latest/icons/calendar.svg",
    dialogFields: [],
    syncInterval: 10,
    idPrefix: "iCal",
  },
  // ================================================
  // Weather integration configs
  // - get_current: Get current weather conditions
  // - get_forecast: Get weather forecast
  // ================================================
  {
    type: "weather",
    service: "open-meteo",
    settingsFields: [
      {
        key: "location",
        label: "Location",
        type: "text" as const,
        placeholder: "City name or coordinates (lat,lon)",
        required: true,
        description: "Your location for weather data",
      },
      {
        key: "units",
        label: "Temperature Units",
        type: "select" as const,
        options: ["fahrenheit", "celsius"],
        required: false,
        description: "Choose temperature display units",
      },
    ],
    capabilities: ["get_current", "get_forecast"],
    icon: "https://unpkg.com/lucide-static@latest/icons/cloud-sun.svg",
    dialogFields: [],
    syncInterval: 30,
  },
  {
    type: "weather",
    service: "home-assistant",
    settingsFields: [
      {
        key: "baseUrl",
        label: "Home Assistant URL",
        type: "url" as const,
        placeholder: "http://homeassistant.local:8123",
        required: true,
        description: "Your Home Assistant instance URL",
      },
      {
        key: "apiKey",
        label: "Long-Lived Access Token",
        type: "password" as const,
        required: true,
        description: "Create a token in Home Assistant under Profile > Security",
      },
      {
        key: "entityId",
        label: "Weather Entity",
        type: "text" as const,
        placeholder: "weather.home",
        required: true,
        description: "The weather entity ID to use",
      },
    ],
    capabilities: ["get_current", "get_forecast"],
    icon: "https://cdn.jsdelivr.net/gh/selfhst/icons/svg/home-assistant.svg",
    dialogFields: [],
    syncInterval: 30,
  },
  // ================================================
  // Photos integration configs
  // - get_albums: List available albums
  // - get_photos: Get photos from selected albums
  // ================================================
  {
    type: "photos",
    service: "immich",
    settingsFields: [
      {
        key: "baseUrl",
        label: "Immich Server URL",
        type: "url" as const,
        placeholder: "https://immich.local",
        required: true,
        description: "Your Immich server URL",
      },
      {
        key: "apiKey",
        label: "API Key",
        type: "password" as const,
        required: true,
        description: "Your Immich API key for authentication",
      },
      {
        key: "selectedAlbums",
        label: "Albums for Screensaver",
        type: "multiselect" as const,
        required: false,
        description: "Select which albums to use for the screensaver slideshow",
      },
    ],
    capabilities: ["get_albums", "get_photos", "get_people"],
    icon: "https://cdn.jsdelivr.net/gh/selfhst/icons/svg/immich.svg",
    dialogFields: [],
    syncInterval: 60,
  },
  {
    type: "calendar",
    service: "google",
    settingsFields: [
      {
        key: "clientId",
        label: "Client ID",
        type: "text" as const,
        placeholder: "paste your client id here",
        required: true,
        description: "Your Google OAuth Client ID",
      },
      {
        key: "clientSecret",
        label: "Client Secret",
        type: "password" as const,
        placeholder: "paste your client secret here",
        required: true,
        description:
          "Your Google OAuth Client Secret (required for server-side token exchange)",
      },
    ],
    capabilities: [
      "get_events",
      "edit_events",
      "add_events",
      "delete_events",
      "oauth",
      "select_calendars",
    ],
    icon: "https://unpkg.com/lucide-static@latest/icons/calendar.svg",
    dialogFields: [],
    syncInterval: 10,
    customSaveHandler: handleGoogleCalendarSave,
  },
  // ================================================
  // Meal integration configs can support the following list-level capabilities:
  // - get_recipes: Can get recipes from the integration
  // - add_recipe: Can add new recipes to the integration
  // - get_meal_plan: Can get meal plans from the integration
  // - add_meal_plan: Can add meals to the meal plan
  // - edit_meal_plan: Can edit meals in the meal plan
  // - delete_meal_plan: Can delete meals from the meal plan
  // ================================================
  // TODO: Add meal integration configs
  // ================================================
  // Shopping integration configs can support the following list-level capabilities:
  // - add_items: Can add new items to lists
  // - clear_items: Can clear completed items from lists
  // - edit_items: Can edit existing items in lists
  // - delete_items: Can delete items from lists
  // ================================================
  {
    type: "shopping",
    service: "tandoor",
    settingsFields: [
      {
        key: "apiKey",
        label: "API Key",
        type: "password" as const,
        placeholder: "Scope needs to be \"read write\"",
        required: true,
        description: "Your Tandoor API key for authentication",
      },
      {
        key: "baseUrl",
        label: "Base URL",
        type: "url" as const,
        placeholder: "http://your-tandoor-instance:port",
        required: true,
        description: "The base URL of your Tandoor instance",
      },
    ],
    capabilities: ["add_items", "edit_items"],
    icon: "https://cdn.jsdelivr.net/gh/selfhst/icons/svg/tandoor-recipes.svg",
    dialogFields: [
      {
        key: "name",
        label: "Item Name",
        type: "text" as const,
        placeholder: "Milk, Bread, Apples, etc.",
        required: true,
        canEdit: true,
      },
      {
        key: "quantity",
        label: "Quantity",
        type: "number" as const,
        min: 0,
        canEdit: true,
      },
      {
        key: "unit",
        label: "Unit",
        type: "text" as const,
        placeholder: "Disabled for Tandoor",
        canEdit: false,
      },
    ],
    syncInterval: 5,
  },
  {
    type: "shopping",
    service: "mealie",
    settingsFields: [
      {
        key: "apiKey",
        label: "API Key",
        type: "password" as const,
        placeholder: "Enter your Mealie API key",
        required: true,
        description: "Your Mealie API key for authentication",
      },
      {
        key: "baseUrl",
        label: "Base URL",
        type: "url" as const,
        placeholder: "http://your-mealie-instance:port",
        required: true,
        description: "The base URL of your Mealie instance",
      },
    ],
    capabilities: ["add_items", "clear_items", "edit_items"],
    icon: "https://cdn.jsdelivr.net/gh/selfhst/icons/svg/mealie.svg",
    dialogFields: [
      {
        key: "quantity",
        label: "Quantity",
        type: "number" as const,
        min: 0,
        canEdit: true,
      },
      {
        key: "unit",
        label: "Unit",
        type: "text" as const,
        placeholder: "Disabled for Mealie",
        canEdit: false,
      },
      {
        key: "notes",
        label: "Notes",
        type: "textarea" as const,
        placeholder: "Note...",
        canEdit: true,
      },
      {
        key: "food",
        label: "Food Item",
        type: "text" as const,
        placeholder: "Disabled for Mealie",
        canEdit: false,
      },
    ],
    syncInterval: 5,
  },
  // ================================================
  // TODO integration configs can support the following list-level capabilities:
  // - get_todos: Can get tasks from the integration
  // - add_todos: Can add new tasks to the integration
  // - edit_todos: Can edit existing tasks in the integration
  // - complete_todos: Can toggle task completion status
  // - delete_todos: Can delete tasks from the integration
  // ================================================
  // TODO: Add TODO integration configs
  // ================================================
];

const serviceFactoryMap = {
  "calendar:iCal": (
    _id: string,
    _apiKey: string,
    baseUrl: string,
    settings?: ICalSettings | GoogleCalendarSettings,
  ) => {
    const iCalSettings = settings as ICalSettings;
    const eventColor = iCalSettings?.eventColor || "#06b6d4";
    const user = iCalSettings?.user;
    const useUserColors = iCalSettings?.useUserColors || false;
    return createICalService(_id, baseUrl, eventColor, user, useUserColors);
  },
  "weather:open-meteo": (_id: string, _apiKey: string, _baseUrl: string, settings?: OpenMeteoWeatherSettings) => {
    return createOpenMeteoWeatherService(_id, settings);
  },
  "weather:home-assistant": (id: string, apiKey: string, baseUrl: string, settings?: HomeAssistantWeatherSettings) => {
    return createHomeAssistantWeatherService(id, apiKey, baseUrl, settings);
  },
  "photos:immich": (id: string, apiKey: string, baseUrl: string, settings?: ImmichSettings) => createImmichService(id, apiKey, baseUrl, settings),
  "calendar:google": (
    _id: string,
    _apiKey: string,
    _baseUrl: string,
    settings?: ICalSettings | GoogleCalendarSettings,
  ) => {
    const googleSettings = settings as GoogleCalendarSettings;
    return createGoogleCalendarService(
      _id,
      googleSettings?.clientId || "",
      googleSettings?.clientSecret || "",
    );
  },
  "shopping:mealie": createMealieService,
  "shopping:tandoor": createTandoorService,
} as const;

const fieldFilters = {
  mealie: getMealieFieldsForItem,
  tandoor: getTandoorFieldsForItem,
};
export function getIntegrationFields(integrationType: string): DialogField[] {
  const config = integrationConfigs.find(c => c.service === integrationType);
  return config?.dialogFields || [];
}

export function getFieldsForItem(
  item: ShoppingListItem | TodoListItem | null | undefined,
  integrationType: string | undefined,
  allFields: { key: string }[],
): { key: string }[] {
  if (
    !integrationType
    || !fieldFilters[integrationType as keyof typeof fieldFilters]
  ) {
    return allFields;
  }

  const filterFunction
    = fieldFilters[integrationType as keyof typeof fieldFilters];

  if (integrationType === "mealie") {
    return (filterFunction as typeof getMealieFieldsForItem)(
      item as ShoppingListItem | null | undefined,
      allFields,
    );
  }
  else if (integrationType === "tandoor") {
    return (filterFunction as typeof getTandoorFieldsForItem)(
      item as ShoppingListItem | null | undefined,
      allFields,
    );
  }

  return allFields;
}
// The map's individual factories keep their own narrower settings types
// (the fork's weather and Immich factories differ from upstream's), so
// getServiceFactories normalizes them to this shared signature at this
// single boundary.
export type ServiceFactoryFn = (
  id: string,
  apiKey: string,
  baseUrl: string,
  settings?: Record<string, unknown>,
) => unknown;

export function getServiceFactories(): { key: string; factory: ServiceFactoryFn }[] {
  return integrationConfigs.map(config => ({
    key: `${config.type}:${config.service}`,
    factory:
      serviceFactoryMap[
        `${config.type}:${config.service}` as keyof typeof serviceFactoryMap
      ] as unknown as ServiceFactoryFn,
  }));
}
