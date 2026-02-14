import { consola } from "consola";
import { computed, readonly } from "vue";

import type { CalendarEvent } from "~/types/calendar";
import type { Integration } from "~/types/database";
import type { CalendarIntegrationService, IntegrationService } from "~/types/integrations";

import { useCalendar } from "./useCalendar";
import { useIntegrations } from "./useIntegrations";
import { useSyncManager } from "./useSyncManager";
import { useUsers } from "./useUsers";

function isCalendarService(service: IntegrationService | null | undefined): service is CalendarIntegrationService {
  return service !== null && service !== undefined && typeof (service as CalendarIntegrationService).getEvents === "function";
}

function buildEventUsers(
  userIds: string[] | undefined,
  allUsers: readonly { id: string; name: string; avatar: string | null; color: string | null }[],
): { id: string; name: string; avatar: string | null; color: string | null }[] {
  if (!userIds) return [];
  return userIds
    .map(userId => allUsers.find(user => user.id === userId))
    .filter(Boolean)
    .map(user => ({
      id: user!.id,
      name: user!.name,
      avatar: user!.avatar,
      color: user!.color,
    }));
}

export function useCalendarIntegrations() {
  const { combineEvents, getEventUserColors, getIntegrationEvents } = useCalendar();
  const { integrations, loading: integrationsLoading, error: integrationsError, getService } = useIntegrations();
  const { users } = useUsers();

  const calendarIntegrations = computed(() =>
    (integrations.value as Integration[]).filter(integration =>
      integration.type === "calendar" && integration.enabled,
    ),
  );

  const calendarServices = computed(() => {
    const services: Map<string, CalendarIntegrationService> = new Map();
    calendarIntegrations.value.forEach((integration) => {
      const service = getService(integration.id);
      if (isCalendarService(service)) {
        services.set(integration.id, service);
      }
    });
    return services;
  });

  const processedCalendarEvents = computed(() => {
    const allEvents: CalendarEvent[] = [];

    calendarIntegrations.value.forEach((integration) => {
      try {
        const events = getIntegrationEvents(integration.id);
        if (!events || !Array.isArray(events))
          return;

        const eventColor = integration.settings?.eventColor as string || "#06b6d4";
        const useUserColors = integration.settings?.useUserColors as boolean | undefined;
        const eventUsers = buildEventUsers(integration.settings?.user as string[] | undefined, users.value);

        allEvents.push(...events.map((event: CalendarEvent) => ({
          ...event,
          users: eventUsers,
          color: getEventUserColors(event, { eventColor, useUserColors, defaultColor: "#06b6d4" }),
          integrationId: integration.id,
          integrationName: integration.name || "Unknown",
        })));
      }
      catch (error) {
        consola.warn(`Use Calendar Integrations: Failed to process calendar events for integration ${integration.id}:`, error);
      }
    });

    return combineEvents(allEvents);
  });

  const calendarSyncStatus = computed(() => {
    const { getCalendarSyncData } = useSyncManager();
    return getCalendarSyncData();
  });

  const getProcessedIntegrationEvents = (integrationId: string): CalendarEvent[] => {
    const integration = calendarIntegrations.value.find(i => i.id === integrationId);
    if (!integration)
      return [];

    try {
      const events = getIntegrationEvents(integrationId);
      if (!events || !Array.isArray(events))
        return [];

      const eventColor = integration.settings?.eventColor as string || "#06b6d4";
      const useUserColors = integration.settings?.useUserColors as boolean | undefined;
      const eventUsers = buildEventUsers(integration.settings?.user as string[] | undefined, users.value);

      return events.map((event: CalendarEvent) => ({
        ...event,
        users: eventUsers,
        color: getEventUserColors(event, { eventColor, useUserColors, defaultColor: "#06b6d4" }),
        integrationId: integration.id,
        integrationName: integration.name || "Unknown",
      }));
    }
    catch (error) {
      consola.warn(`Use Calendar Integrations: Failed to process events for integration ${integrationId}:`, error);
      return [];
    }
  };

  return {
    calendarEvents: readonly(processedCalendarEvents),
    calendarIntegrations: readonly(calendarIntegrations),
    calendarServices: readonly(calendarServices),
    calendarSyncStatus: readonly(calendarSyncStatus),

    integrationsLoading: readonly(integrationsLoading),
    integrationsError: readonly(integrationsError),

    getProcessedIntegrationEvents,
  };
}
