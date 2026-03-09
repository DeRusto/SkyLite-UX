import { consola } from "consola";
import ical from "ical.js";

import type { CalendarEvent } from "~/types/calendar";
import type { Integration, ShoppingListWithItemsAndCount, TodoColumn, TodoWithUser, User } from "~/types/database";
import type { CalendarIntegrationService, IntegrationService, ShoppingIntegrationService, TodoIntegrationService } from "~/types/integrations";

import { integrationConfigs } from "~/integrations/integrationConfig";
import { setBrowserTimezone, setTimezoneRegistered } from "~/types/global";
import { createIntegrationService, registerIntegration } from "~/types/integrations";

export const integrationServices = new Map<string, IntegrationService>();

export default defineNuxtPlugin(async () => {
  consola.start("AppInit: Starting up...");

  const config = useRuntimeConfig();
  const browserTimezone = config.public.tz;

  // Phase 1: Timezone registration (non-blocking, UTC fallback on failure or timeout)
  try {
    const apiUrl = `https://tz.add-to-calendar-technology.com/api/${encodeURIComponent(browserTimezone)}.ics`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let vtimezoneBlock: string | null = null;
    try {
      vtimezoneBlock = await $fetch<string>(apiUrl, { signal: controller.signal });
    }
    finally {
      clearTimeout(timeoutId);
    }

    if (!vtimezoneBlock) {
      throw new Error("No timezone data received");
    }

    const timezoneComponent = new ical.Component(ical.parse(vtimezoneBlock));
    const timezone = new ical.Timezone({ tzid: browserTimezone, component: timezoneComponent });
    ical.TimezoneService.register(timezone);
    consola.debug("AppInit: Successfully registered timezone:", browserTimezone, "on", import.meta.server ? "server" : "client");

    setTimezoneRegistered(true);
    setBrowserTimezone(browserTimezone);
  }
  catch (error) {
    consola.warn("AppInit: Failed to register timezone, calendar will use fallback:", error);
    setTimezoneRegistered(false);
  }

  integrationConfigs.forEach((integrationConfig) => {
    registerIntegration(integrationConfig);
  });
  consola.debug(`AppInit: Registered ${integrationConfigs.length} integrations`);

  try {
    // Phase 2: Core data loading (users, integrations — must succeed; 1 retry on failure)
    const [_usersResult, _currentUserResult, integrationsResult] = await Promise.all([
      useAsyncData("users", () => $fetch<User[]>("/api/users"), {
        server: true,
        lazy: false,
      }),

      useAsyncData("current-user", () => Promise.resolve(null), {
        server: false,
        lazy: false,
      }),

      useAsyncData("integrations", () => $fetch<Integration[]>("/api/integrations"), {
        server: true,
        lazy: false,
      }),
    ]);

    if (_usersResult.error.value || integrationsResult.error.value) {
      consola.warn("AppInit: Core data load failed, retrying...");
      try {
        await Promise.all([
          _usersResult.error.value ? _usersResult.refresh() : Promise.resolve(),
          integrationsResult.error.value ? integrationsResult.refresh() : Promise.resolve(),
        ]);
        consola.debug("AppInit: Core data retry succeeded");
      }
      catch (retryError) {
        consola.error("AppInit: Core data retry failed, app will render with missing data:", retryError);
      }
    }

    consola.debug("AppInit: Core dependencies loaded successfully");

    // Phase 3: Extended data loading (events, todos, shopping — can fail gracefully)
    try {
      await Promise.all([
        useAsyncData("calendar-events", () => $fetch<CalendarEvent[]>("/api/calendar-events"), {
          server: true,
          lazy: false,
        }),

        useAsyncData("todos", () => $fetch<TodoWithUser[]>("/api/todos"), {
          server: true,
          lazy: false,
        }),

        useAsyncData("native-shopping-lists", () => $fetch<ShoppingListWithItemsAndCount[]>("/api/shopping-lists"), {
          server: true,
          lazy: false,
        }),

        useAsyncData("todo-columns", () => $fetch<TodoColumn[]>("/api/todo-columns"), {
          server: true,
          lazy: false,
        }),
      ]);
      consola.debug("AppInit: Local data loaded successfully");
    }
    catch (extendedError) {
      consola.error("AppInit: Error loading extended data (app will render with partial data):", extendedError);
    }

    // Phase 4: Integration services initialization (best effort)
    const integrationDataPromises: ReturnType<typeof useAsyncData>[] = [];

    if (integrationsResult.data.value) {
      const enabledIntegrations = integrationsResult.data.value.filter(integration => integration.enabled);
      consola.debug(`AppInit: Found ${enabledIntegrations.length} enabled integrations`);

      for (const integration of enabledIntegrations) {
        consola.debug(`AppInit: Processing integration: ${integration.name} (${integration.type})`);

        try {
          const service = await createIntegrationService(integration);
          if (!service) {
            consola.warn(`AppInit: Failed to create service for ${integration.name}`);
            continue;
          }

          await service.initialize();

          integrationServices.set(integration.id, service);
          consola.debug(`AppInit: Service initialized and stored for ${integration.name}`);

          if (integration.type === "calendar") {
            integrationDataPromises.push(
              useAsyncData(`calendar-events-${integration.id}`, async () => {
                try {
                  const events = await (service as CalendarIntegrationService).getEvents();
                  return events || [];
                }
                catch (err) {
                  consola.error(`AppInit: Error fetching calendar events for ${integration.name}:`, err);
                  return [];
                }
              }, {
                server: true,
                lazy: false,
              }),
            );
          }
          else if (integration.type === "shopping") {
            integrationDataPromises.push(
              useAsyncData(`shopping-lists-${integration.id}`, async () => {
                try {
                  const lists = await (service as ShoppingIntegrationService).getShoppingLists();
                  return lists || [];
                }
                catch (err) {
                  consola.error(`AppInit: Error fetching shopping lists for ${integration.name}:`, err);
                  return [];
                }
              }, {
                server: true,
                lazy: false,
              }),
            );
          }
          else if (integration.type === "todo") {
            integrationDataPromises.push(
              useAsyncData(`todos-${integration.id}`, async () => {
                try {
                  const todos = await (service as TodoIntegrationService).getTodos();
                  return todos || [];
                }
                catch (err) {
                  consola.error(`AppInit: Error fetching todos for ${integration.name}:`, err);
                  return [];
                }
              }, {
                server: true,
                lazy: false,
              }),
            );
          }
        }
        catch (err) {
          consola.error(`AppInit: Error processing integration ${integration.name}:`, err);
        }
      }
    }

    if (integrationDataPromises.length > 0) {
      consola.debug(`AppInit: Loading data for ${integrationDataPromises.length} integrations...`);

      try {
        await Promise.all(integrationDataPromises);
        consola.debug("AppInit: Integration data loaded successfully");
      }
      catch (integrationError) {
        consola.error("AppInit: Error loading integration data:", integrationError);
      }
    }

    consola.debug(`AppInit: All data pre-loaded successfully. Initialized ${integrationServices.size} integration services.`);
  }
  catch (error) {
    consola.error("AppInit: Error pre-loading data:", error);
  }
});
