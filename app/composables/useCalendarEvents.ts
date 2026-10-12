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
  const { getEventUserColors } = useCalendar();
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
      consola.debug(
        "Use Calendar Events: Calendar events refreshed successfully",
      );
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
            if (config.capabilities.includes("add_events") && integration.service === "google") {
              await $fetch("/api/integrations/google_calendar/events", {
                method: "POST",
                body: {
                  ...event,
                  integrationId: integration.id,
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
      };

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

  const updateEventObject = async (event: CalendarEvent) => {
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
              } as CalendarEventResponse;
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

  // Upstream-compatible native CRUD (upstream calendar page calls these
  // signatures; the fork's object-based addEvent/updateEventObject above
  // handle integration-routed events).
  const createEvent = async (eventData: Omit<CalendarEvent, "id">) => {
    try {
      const newEvent = await $fetch<CalendarEvent>("/api/calendar-events", {
        method: "POST",
        body: eventData,
      });

      await refreshNuxtData("calendar-events");

      return newEvent;
    }
    catch (err) {
      error.value = "Failed to create calendar event";
      consola.error("Use Calendar Events: Error creating calendar event:", err);
      throw err;
    }
  };

  const updateEvent = async (
    eventOrId: CalendarEvent | string,
    updates?: Partial<CalendarEvent>,
  ) => {
    if (typeof eventOrId === "string") {
      try {
        const updatedEvent = await $fetch<CalendarEvent>(
          `/api/calendar-events/${eventOrId}`,
          {
            method: "PUT",
            body: updates,
          },
        );

        await refreshNuxtData("calendar-events");

        return updatedEvent;
      }
      catch (err) {
        error.value = "Failed to update calendar event";
        consola.error("Use Calendar Events: Error updating calendar event:", err);
        throw err;
      }
    }

    return updateEventObject(eventOrId);
  };

  // Native delete by ID. The calendar page routes integration deletes itself
  // and may already have removed the event from the cache, so this must not
  // depend on finding the event locally.
  const deleteEvent = async (id: string) => {
    try {
      await $fetch(`/api/calendar-events/${id}` as string, {
        method: "DELETE",
      });

      await refreshNuxtData("calendar-events");

      return true;
    }
    catch (err) {
      error.value = "Failed to delete calendar event";
      consola.error("Use Calendar Events: Error deleting calendar event:", err);
      throw err;
    }
  };

  return {
    events: readonly(currentEvents),
    loading: readonly(loading),
    error: readonly(error),
    fetchEvents,
    addEvent,
    createEvent,
    updateEvent,
    deleteEvent,
  };
}
