import { consola } from "consola";

import type { CalendarEvent } from "~/types/calendar";
import type { Integration } from "~/types/database";

import { useAlertToast } from "~/composables/useAlertToast";
import { useCalendar } from "~/composables/useCalendar";
import { useIntegrations } from "~/composables/useIntegrations";
import { useUsers } from "~/composables/useUsers";
import { integrationRegistry } from "~/types/integrations";
import { getErrorMessage } from "~/utils/error";

export function useCalendarEvents() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  const { data: events } = useNuxtData<CalendarEvent[]>("calendar-events");
  const { integrations } = useIntegrations();
  const { users } = useUsers();
  const { getEventUserColors } = useCalendar();
  const { showSuccess, showError, showWarning } = useAlertToast();

  const currentEvents = computed(() => events.value || []);
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
    const prefix = integration.service === "google-calendar" ? "google" : integration.service;
    return event.id.replace(`${prefix}-${integration.id}-`, "");
  }

  const addEvent = async (event: CalendarEvent) => {
    try {
      // Check if event is for a single user with a linked calendar
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
                method: "POST" as any,
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
      const previousEvents = events.value ? [...events.value] : [];
      const newEvent = {
        ...event,
        id: `temp-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (events.value && Array.isArray(events.value)) {
        events.value.push(newEvent);
      }

      try {
        const eventColor = getEventUserColors(event);
        const createdEvent = await $fetch<CalendarEvent>("/api/calendar-events", {
          method: "POST" as any,
          body: {
            title: event.title,
            description: event.description,
            start: event.start,
            end: event.end,
            allDay: event.allDay,
            color: eventColor,
            location: event.location,
            ical_event: event.ical_event,
            users: event.users,
          },
        });

        if (events.value && Array.isArray(events.value)) {
          const tempIndex = events.value.findIndex((e: CalendarEvent) => e.id === newEvent.id);
          if (tempIndex !== -1) {
            events.value[tempIndex] = createdEvent;
          }
        }

        showSuccess("Event Created", "Local event created successfully");
        return createdEvent;
      }
      catch (error) {
        if (events.value) {
          events.value.splice(0, events.value.length, ...previousEvents);
        }
        throw error;
      }
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

          await $fetch(`/api/integrations/${integration.service}/events/${integrationEventId}`, {
            method: "PUT" as any,
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
      const previousEvents = events.value ? [...events.value] : [];

      if (events.value && Array.isArray(events.value)) {
        const eventIndex = events.value.findIndex((e: CalendarEvent) => e.id === event.id);
        if (eventIndex !== -1) {
          events.value[eventIndex] = { ...events.value[eventIndex], ...event };
        }
      }

      try {
        const eventColor = getEventUserColors(event);
        const updatedEvent = await $fetch<CalendarEvent>(`/api/calendar-events/${event.id}`, {
          method: "PUT" as any,
          body: {
            title: event.title,
            description: event.description,
            start: event.start,
            end: event.end,
            allDay: event.allDay,
            color: eventColor,
            location: event.location,
            ical_event: event.ical_event,
            users: event.users,
          },
        });

        showSuccess("Event Updated", "Local event updated successfully");
        return updatedEvent;
      }
      catch (error) {
        if (events.value) {
          events.value.splice(0, events.value.length, ...previousEvents);
        }
        throw error;
      }
    }
    catch (err) {
      const message = getErrorMessage(err, "Failed to update the event");
      showError("Failed to Update Event", message);
      throw err;
    }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      const { allEvents } = useCalendar();
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

          const params = new URLSearchParams({
            integrationId: integration.id,
          });
          if (event.calendarId) {
            params.set("calendarId", event.calendarId);
          }

          await $fetch(`/api/integrations/${integration.service}/events/${integrationEventId}?${params.toString()}`, {
            method: "DELETE" as any,
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
      const previousEvents = events.value ? [...events.value] : [];

      if (events.value && Array.isArray(events.value)) {
        events.value.splice(0, events.value.length, ...events.value.filter((e: CalendarEvent) => e.id !== eventId));
      }

      try {
        await $fetch(`/api/calendar-events/${eventId}`, {
          method: "DELETE" as any,
        });
        showSuccess("Event Deleted", "Local event deleted successfully");
        return true;
      }
      catch (error) {
        if (events.value) {
          events.value.splice(0, events.value.length, ...previousEvents);
        }
        throw error;
      }
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
