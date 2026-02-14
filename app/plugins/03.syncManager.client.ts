import { consola } from "consola";

import type { CalendarEvent } from "~/types/calendar";
import type { ShoppingListWithItemsAndCount, TodoWithUser } from "~/types/database";
import type { EventSourceStatus, IntegrationSyncData, SyncConnectionStatus, SyncEvent } from "~/types/sync";

import { getIntegrationCacheKey } from "~/composables/useSyncManager";

export default defineNuxtPlugin(() => {
  const syncData = useState<IntegrationSyncData>("sync-data", () => ({}));
  const connectionStatus = useState<SyncConnectionStatus>("sync-connection-status", () => "disconnected");
  const lastHeartbeat = useState<Date | null>("sync-last-heartbeat", () => null);

  let eventSource: EventSource | null = null;
  const eventSourceData = ref<string | null>(null);
  const eventSourceStatus = ref<EventSourceStatus>("CLOSED");
  const eventSourceError = ref<Event | null>(null);

  function connectEventSource() {
    try {
      eventSource = new EventSource("/api/sync/events");

      eventSource.onopen = () => {
        eventSourceStatus.value = "OPEN";
        connectionStatus.value = "connected";
        consola.debug("Sync Manager: Connected to sync stream");
      };

      eventSource.onmessage = (event) => {
        eventSourceData.value = event.data;
      };

      eventSource.onerror = (error) => {
        eventSourceStatus.value = "CLOSED";
        connectionStatus.value = "error";
        eventSourceError.value = error;
        consola.error("Sync Manager: EventSource error:", error);
      };

      eventSourceStatus.value = "CONNECTING";
      connectionStatus.value = "connecting";
    }
    catch (error) {
      consola.error("Sync Manager: Failed to create EventSource:", error);
      connectionStatus.value = "error";
    }
  }

  connectEventSource();

  let reconnectAttempts = 0;
  const maxReconnectAttempts = 3;
  const reconnectDelay = 1000;

  function attemptReconnect() {
    if (reconnectAttempts >= maxReconnectAttempts) {
      consola.error("Sync Manager: Failed to reconnect to sync stream after 3 attempts");
      connectionStatus.value = "error";
      return;
    }

    setTimeout(() => {
      consola.debug(`Sync Manager: Attempting to reconnect to sync stream (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
      reconnectAttempts++;
      connectEventSource();
    }, reconnectDelay * reconnectAttempts);
  }

  watch(eventSourceStatus, (newStatus) => {
    switch (newStatus) {
      case "CONNECTING":
        connectionStatus.value = "connecting";
        break;
      case "OPEN":
        connectionStatus.value = "connected";
        reconnectAttempts = 0;
        break;
      case "CLOSED":
        connectionStatus.value = "disconnected";
        if (reconnectAttempts < maxReconnectAttempts) {
          attemptReconnect();
        }
        break;
    }
  });

  watch(eventSourceData, (rawData) => {
    if (!rawData)
      return;

    try {
      const event: SyncEvent = JSON.parse(rawData);
      consola.debug("Sync Manager: Received sync event:", event.type, event);

      switch (event.type) {
        case "connection_established":
          consola.debug("Sync Manager: Connected to sync stream:", event.message);
          break;

        case "sync_status":
          consola.debug(`Sync Manager: Sync status: ${event.activeIntegrations?.length || 0} active integrations, ${event.connectedClients || 0} connected clients`);
          break;

        case "heartbeat":
          lastHeartbeat.value = new Date(event.timestamp);
          break;

        case "integration_sync":
          if (event.integrationId) {
            syncData.value[event.integrationId] = {
              data: event.data || [],
              lastSync: new Date(event.timestamp),
              success: event.success || false,
              error: event.error,
            };

            if (event.integrationType && event.success) {
              updateIntegrationCache(event.integrationType, event.integrationId, event.data || []);
            }

            consola.debug(`Sync Manager: Updated sync data for integration ${event.integrationId}:`, {
              success: event.success,
              hasData: !!event.data,
              error: event.error,
            });
          }
          break;

        case "native_data_change":
          if (event.dataType) {
            consola.debug(`Sync Manager: Native data changed: ${event.dataType} ${event.action} ${event.entityId}`);
            refreshNativeData(event.dataType);
          }
          break;
      }
    }
    catch (error) {
      consola.error("Sync Manager: Failed to parse sync event:", error, rawData);
    }
  });

  watch(eventSourceError, (error) => {
    if (error) {
      consola.error("Sync Manager: Sync stream error:", error);
      connectionStatus.value = "error";
    }
  });

  function updateIntegrationCache(integrationType: string, integrationId: string, data: CalendarEvent[] | ShoppingListWithItemsAndCount[] | TodoWithUser[]) {
    const nuxtApp = useNuxtApp();
    const cacheKey = getIntegrationCacheKey(integrationType, integrationId);
    nuxtApp.payload.data = {
      ...nuxtApp.payload.data,
      [cacheKey]: data,
    };
  }

  const KNOWN_DATA_TYPES = new Set(["calendar-events", "todos", "todo-columns", "shopping-lists", "users", "integrations"]);

  async function refreshNativeData(dataType: string) {
    if (!KNOWN_DATA_TYPES.has(dataType)) {
      consola.warn(`Sync Manager: Unknown data type for refresh: ${dataType}`);
      return;
    }

    try {
      await refreshNuxtData(dataType);
      consola.debug(`Sync Manager: Refreshed ${dataType} data`);
    }
    catch (error) {
      consola.error(`Sync Manager: Failed to refresh ${dataType} data:`, error);
    }
  }

  function cleanup() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  if (import.meta.client) {
    window.addEventListener("beforeunload", cleanup);
  }

  return {
    provide: {
      getSyncData: (integrationId: string) => {
        return syncData.value[integrationId];
      },

      getAllSyncData: () => {
        return syncData.value;
      },

      getSyncConnectionStatus: () => {
        return connectionStatus.value;
      },

      getLastHeartbeat: () => {
        return lastHeartbeat.value;
      },

      isSyncConnected: () => {
        return connectionStatus.value === "connected";
      },

      getCachedIntegrationData: (integrationType: string, integrationId: string) => {
        const nuxtApp = useNuxtApp();
        return nuxtApp.payload.data[getIntegrationCacheKey(integrationType, integrationId)];
      },

      checkIntegrationCache: (integrationType: string, integrationId: string) => {
        const nuxtApp = useNuxtApp();
        return nuxtApp.payload.data[getIntegrationCacheKey(integrationType, integrationId)] !== undefined;
      },

      purgeIntegrationCache: (integrationType: string, integrationId: string) => {
        const nuxtApp = useNuxtApp();
        const cacheKey = getIntegrationCacheKey(integrationType, integrationId);
        if (nuxtApp.payload.data[cacheKey] !== undefined) {
          delete nuxtApp.payload.data[cacheKey];
          consola.debug(`Sync Manager: Purged cache for ${integrationType} integration ${integrationId}`);
        }
      },

      triggerImmediateSync: async (integrationType: string, integrationId: string) => {
        try {
          consola.debug(`Sync Manager: Triggering immediate sync for ${integrationType} integration ${integrationId}`);

          const response = await $fetch("/api/sync/trigger", {
            method: "POST",
            body: {
              integrationId,
              integrationType,
              force: true,
            },
          });

          consola.debug(`Sync Manager: Immediate sync triggered successfully for ${integrationType} integration ${integrationId}`);
          return response;
        }
        catch (error) {
          consola.error(`Sync Manager: Failed to trigger immediate sync for ${integrationType} integration ${integrationId}:`, error);
          throw error;
        }
      },

      reconnectSync: () => {
        cleanup();
        reconnectAttempts = 0;
        connectEventSource();
      },
    },
  };
});
