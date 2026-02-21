import { consola } from "consola";

import type { CalendarEvent, CalendarEventResponse } from "~/types/calendar";
import type { Integration } from "~/types/database";

import { useAlertToast } from "~/composables/useAlertToast";
import { useCalendar } from "~/composables/useCalendar";
import { useIntegrations } from "~/composables/useIntegrations";
import { useUsers } from "~/composables/useUsers";
import { integrationRegistry } from "~/types/integrations";
import { getErrorMessage } from "~/utils/error";
import { performOptimisticUpdate } from "~/utils/optimistic";

export function useCalendarEvents() {
  const loading = useState<boolean>("calendar-events-loading", () => false);
  const error = useState<string | null>("calendar-events-error", () => null);

  const { data: events } = useNuxtData<CalendarEventResponse[]>("calendar-events");
  const { integrations } = useIntegrations();
  const { users } = useUsers();
  const { getEventUserColors, allEvents } = useCalendar();
  const { showSuccess, showError, showWarning } = useAlertToast();

  const currentEvents = computed(() => (events.value || []).map(event => ({
    ...event,
    start: new Date(event.start),
    end: new Date(event.end),
  })) as CalendarEvent[]);
  const typedIntegrations = computed(() => (integrations.value ?? []) as Integration[]);

  const fetchEvents = async () => {
    loading.value = true;
    error.value = null;
    try {
      await refreshNuxtData("calendar-events");
      consola.debug("Use Calendar Events: Calendar events refreshed successfully");
      return currentEvents.value;
    }
    catch (err) {
      error.value = getErrorMessage(err, "Failed to fetch calendar events");
      consola.error("Use Calendar Events: Error fetching calendar events:", err);
      throw err;
    }
    finally {
      loading.value = false;
    }
  };

  function getIntegrationEventId(event: CalendarEvent, integration: Integration) {
    const config = integrationRegistry.get(`${integration.type}:${integration.service}`);
    const expectedPrefix = config?.idPrefix || integration.service;
    const prefixString = `${expectedPrefix}-${integration.id}-`;
    if (event.id.startsWith(prefixString)) {
      return event.id.slice(prefixString.length);
    }
    consola.warn(`getIntegrationEventId: ID "${event.id}" does not start with expected prefix "${prefixString}" for integration ${integration.id} (${integration.service})`);
    return null;
  }

  const addEvent = async (event: CalendarEvent) => {
    try {
      /**
       * Current Implementation Detail:
       * addEvent only syncs to an external calendar when exactly one user has a linked calendar.
       * This avoids the complexity of syncing a single event across multiple external services
       * and managing conflict resolution or multi-way sync states.
       *
       * TODO: Support syncing multi-user events across multiple linked calendars.
       * This requires a strategy for mapping one SkyLite event to multiple external event IDs
       * and handling updates/deletes consistently across all providers.
       */
      const selectedUsers = event.users || [];
      if (selectedUsers.length === 1 && selectedUsers[0]) {
        const userId = selectedUsers[0].id;
        const user = users.value.find(u => u.id === userId);

        if (user?.calendarIntegrationId && user?.calendarId) {
          const integration = typedIntegrations.value.find(i => i.id === user.calendarIntegrationId);
          const config = integration
            ? integrationRegistry.get(`${integration.type}:${integration.service}`)
            : null;

          if (integration && config) {
            if (config.capabilities.includes("add_events")) {
              await $fetch(`/api/integrations/${integration.service}/events`, {
                method: "POST",
                body: {
                  integrationId: integration.id,
                  calendarEvent: event,
                  calendarId: user.calendarId,
                },
              });

              await refreshNuxtData("calendar-events");
              showSuccess("Event Created", `Event added to ${user.name}'s calendar`);
              return;
            }
            else {
              consola.warn(`Integration ${integration.service} does not support add_events for user ${user.id}. Creating local event.`);
              showWarning("Not Supported", `Linked calendar does not support adding events. Event will be created locally in SkyLite.`);
            }
          }
          else {
            consola.warn(`Integration ${user.calendarIntegrationId} not found for user ${user.id}. Creating local event.`);
            showWarning("Integration Not Found", `Linked calendar integration not found. Event will be created locally in SkyLite.`);
          }
        }
      }

      if (event.integrationId) {
        showError("Not Supported", "Adding events to this integration is not supported");
        return;
      }

      // Local event optimistic update
      const previousEvents = structuredClone(events.value ?? []);
      const tempId = crypto.randomUUID();
      const newEvent: CalendarEventResponse = {
        ...event,
        start: event.start.toISOString(),
        end: event.end.toISOString(),
        id: tempId,
      } as any; // Temporary cast to match CalendarEventResponse shape for optimistic cache

      const createdEvent = await performOptimisticUpdate(
        () => $fetch<CalendarEventResponse>("/api/calendar-events", {
          method: "POST",
          body: {
            title: event.title,
            description: event.description,
            start: event.start,
            end: event.end,
            allDay: event.allDay,
            color: getEventUserColors(event),
            location: event.location,
            ical_event: event.ical_event,
            users: event.users,
          },
        }),
        () => {
          if (events.value && Array.isArray(events.value)) {
            events.value.push(newEvent);
          }
        },
        () => {
          if (events.value) {
            events.value.splice(0, events.value.length, ...previousEvents);
          }
        },
      );

      if (events.value && Array.isArray(events.value)) {
        const tempIndex = events.value.findIndex((e: CalendarEventResponse) => e.id === tempId);
        if (tempIndex !== -1) {
          events.value[tempIndex] = createdEvent;
        }
      }

      showSuccess("Event Created", "Local event created successfully");
      return createdEvent;
    }
    catch (err) {
      const message = getErrorMessage(err, "Failed to create the event");
      showError("Failed to Create Event", message);
      throw err;
    }
  };

  const updateEvent = async (event: CalendarEvent) => {
    try {
      if (event.integrationId) {
        const integration = typedIntegrations.value.find(i => i.id === event.integrationId);
        if (!integration) {
          showError("Integration Not Found", "The linked calendar integration could not be found.");
          return;
        }

        const config = integrationRegistry.get(`${integration.type}:${integration.service}`);
        if (config?.capabilities.includes("edit_events")) {
          const integrationEventId = getIntegrationEventId(event, integration);
          if (!integrationEventId) {
            showError("Update Failed", "Could not determine the integration event ID.");
            return;
          }

          await $fetch(`/api/integrations/${integration.service}/events/${integrationEventId}`, {
            method: "PUT",
            body: {
              integrationId: integration.id,
              updates: event,
              calendarId: event.calendarId,
            },
          });

          await refreshNuxtData("calendar-events");
          showSuccess("Event Updated", "Integration event updated successfully");
          return;
        }
        else {
          showError("Not Supported", "Updating events in this integration is not supported");
          return;
        }
      }

      // Local event optimistic update
      const previousEvents = structuredClone(events.value ?? []);

      const updatedEvent = await performOptimisticUpdate(
        () => $fetch<CalendarEventResponse>(`/api/calendar-events/${event.id}`, {
          method: "PUT",
          body: {
            title: event.title,
            description: event.description,
            start: event.start,
            end: event.end,
            allDay: event.allDay,
            color: getEventUserColors(event),
            location: event.location,
            ical_event: event.ical_event,
            users: event.users,
          },
        }),
        () => {
          if (events.value && Array.isArray(events.value)) {
            const eventIndex = events.value.findIndex((e: CalendarEventResponse) => e.id === event.id);
            if (eventIndex !== -1) {
              events.value[eventIndex] = {
                ...events.value[eventIndex],
                ...event,
                start: event.start.toISOString(),
                end: event.end.toISOString(),
              } as any;
            }
          }
        },
        () => {
          if (events.value) {
            events.value.splice(0, events.value.length, ...previousEvents);
          }
        },
      );

      // Reconciliation
      if (events.value && Array.isArray(events.value)) {
        const eventIndex = events.value.findIndex((e: CalendarEventResponse) => e.id === event.id);
        if (eventIndex !== -1) {
          events.value[eventIndex] = updatedEvent;
        }
      }

      showSuccess("Event Updated", "Local event updated successfully");
      return updatedEvent;
    }
    catch (err) {
      const message = getErrorMessage(err, "Failed to update the event");
      showError("Failed to Update Event", message);
      throw err;
    }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      const event = allEvents.value.find(e => e.id === eventId) as CalendarEvent | undefined;

      if (!event) {
        showError("Event Not Found", "The event could not be found.");
        return;
      }

      if (event.integrationId) {
        const integration = typedIntegrations.value.find(i => i.id === event.integrationId);
        if (!integration) {
          showError("Integration Not Found", "The linked calendar integration could not be found.");
          return;
        }

        const config = integrationRegistry.get(`${integration.type}:${integration.service}`);
        if (config?.capabilities.includes("delete_events")) {
          const integrationEventId = getIntegrationEventId(event, integration);
          if (!integrationEventId) {
            showError("Delete Failed", "Could not determine the integration event ID.");
            return;
          }

          await $fetch(`/api/integrations/${integration.service}/events/${integrationEventId}`, {
            method: "DELETE",
            query: {
              integrationId: integration.id,
              calendarId: event.calendarId,
            },
          });

          await refreshNuxtData("calendar-events");
          showSuccess("Event Deleted", "Integration event deleted successfully");
          return;
        }
        else {
          showError("Not Supported", "Deleting events from this integration is not supported");
          return;
        }
      }

      // Local event optimistic update
      const previousEvents = structuredClone(events.value ?? []);

      await performOptimisticUpdate(
        () => $fetch<void>(`/api/calendar-events/${eventId}`, {
          method: "DELETE",
        }),
        () => {
          if (events.value && Array.isArray(events.value)) {
            const index = events.value.findIndex((e: CalendarEventResponse) => e.id === eventId);
            if (index !== -1) {
              events.value.splice(index, 1);
            }
          }
        },
        () => {
          if (events.value) {
            events.value.splice(0, events.value.length, ...previousEvents);
          }
        },
      );

      showSuccess("Event Deleted", "Local event deleted successfully");
      return true;
    }
    catch (err) {
      const message = getErrorMessage(err, "Failed to delete the event");
      showError("Failed to Delete Event", message);
      throw err;
    }
  };

  return {
    events: readonly(currentEvents),
    loading: readonly(loading),
    error: readonly(error),
    fetchEvents,
    addEvent,
    updateEvent,
    deleteEvent,
  };
}
