<script setup lang="ts">
import { consola } from "consola";
import { isValid, parseISO } from "date-fns";

import type { CalendarEvent } from "~/types/calendar";
import type { Integration } from "~/types/database";

import { useAlertToast } from "~/composables/useAlertToast";
import { useCalendar } from "~/composables/useCalendar";
import { useCalendarEvents } from "~/composables/useCalendarEvents";
import { useIntegrations } from "~/composables/useIntegrations";
import { useUsers } from "~/composables/useUsers";
import { integrationRegistry } from "~/types/integrations";

const route = useRoute();
const { allEvents, getEventUserColors } = useCalendar();
const { users } = useUsers();
const { integrations } = useIntegrations();
const { showError, showSuccess, showWarning } = useAlertToast();

const router = useRouter();

const typedIntegrations = computed(() => (integrations.value ?? []) as Integration[]);

function getIntegrationEventId(event: CalendarEvent, integration: Integration) {
  const prefix = integration.service === "google-calendar" ? "google" : integration.service;
  return event.id.replace(`${prefix}-${integration.id}-`, "");
}

// Handle deep link to specific date via ?date=YYYY-MM-DD query parameter
const currentDate = useState<Date>("calendar-current-date");
const dateParam = route.query.date as string | undefined;
if (dateParam) {
  const parsedDate = parseISO(dateParam);
  if (isValid(parsedDate)) {
    currentDate.value = parsedDate;
  }
}

// Handle user filter from URL query parameter
const usersParam = route.query.users as string | undefined;
const initialUserFilter = usersParam ? usersParam.split(",") : [];

// Update URL when filters change
function handleUserFilterChange(userIds: string[]) {
  const query = { ...route.query };
  if (userIds.length > 0) {
    query.users = userIds.join(",");
  }
  else {
    delete query.users;
  }
  router.replace({ query });
}

async function handleEventAdd(event: CalendarEvent) {
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

    const { data: cachedEvents } = useNuxtData("calendar-events");
    const previousEvents = cachedEvents.value ? [...cachedEvents.value] : [];

    const newEvent = {
      ...event,
      id: `temp-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (cachedEvents.value && Array.isArray(cachedEvents.value)) {
      cachedEvents.value.push(newEvent);
    }

    try {
      const eventColor = getEventUserColors(event);
      const { createEvent } = useCalendarEvents();
      const createdEvent = await createEvent({
        title: event.title,
        description: event.description,
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        color: eventColor,
        location: event.location,
        ical_event: event.ical_event,
        users: event.users,
      });

      if (cachedEvents.value && Array.isArray(cachedEvents.value)) {
        const tempIndex = cachedEvents.value.findIndex((e: CalendarEvent) => e.id === newEvent.id);
        if (tempIndex !== -1) {
          cachedEvents.value[tempIndex] = createdEvent;
        }
      }

      showSuccess("Event Created", "Local event created successfully");
    }
    catch (error) {
      if (cachedEvents.value && previousEvents.length > 0) {
        cachedEvents.value.splice(0, cachedEvents.value.length, ...previousEvents);
      }
      throw error;
    }
  }
  catch {
    showError("Failed to Create Event", "Failed to create the event. Please try again.");
  }
}

async function handleEventUpdate(event: CalendarEvent) {
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

    const { data: cachedEvents } = useNuxtData("calendar-events");
    const previousEvents = cachedEvents.value ? [...cachedEvents.value] : [];

    if (cachedEvents.value && Array.isArray(cachedEvents.value)) {
      const eventIndex = cachedEvents.value.findIndex((e: CalendarEvent) => e.id === event.id);
      if (eventIndex !== -1) {
        cachedEvents.value[eventIndex] = { ...cachedEvents.value[eventIndex], ...event };
      }
    }

    try {
      const eventColor = getEventUserColors(event);
      const { updateEvent } = useCalendarEvents();
      await updateEvent(event.id, {
        title: event.title,
        description: event.description,
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        color: eventColor,
        location: event.location,
        ical_event: event.ical_event,
        users: event.users,
      });

      showSuccess("Event Updated", "Local event updated successfully");
    }
    catch (error) {
      if (cachedEvents.value && previousEvents.length > 0) {
        cachedEvents.value.splice(0, cachedEvents.value.length, ...previousEvents);
      }
      throw error;
    }
  }
  catch {
    showError("Failed to Update Event", "Failed to update the event. Please try again.");
  }
}

async function handleEventDelete(eventId: string) {
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

        const params = new URLSearchParams({
          integrationId: integration.id,
        });
        if (event.calendarId) {
          params.set("calendarId", event.calendarId);
        }

        await $fetch(`/api/integrations/${integration.service}/events/${integrationEventId}?${params.toString()}`, {
          method: "DELETE",
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

    const { data: cachedEvents } = useNuxtData("calendar-events");
    const previousEvents = cachedEvents.value ? [...cachedEvents.value] : [];

    if (cachedEvents.value && Array.isArray(cachedEvents.value)) {
      cachedEvents.value.splice(0, cachedEvents.value.length, ...cachedEvents.value.filter((e: CalendarEvent) => e.id !== eventId));
    }

    try {
      const { deleteEvent } = useCalendarEvents();
      await deleteEvent(eventId);
      showSuccess("Event Deleted", "Local event deleted successfully");
    }
    catch (error) {
      if (cachedEvents.value && previousEvents.length > 0) {
        cachedEvents.value.splice(0, cachedEvents.value.length, ...previousEvents);
      }
      throw error;
    }
  }
  catch {
    showError("Failed to Delete Event", "Failed to delete the event. Please try again.");
  }
}

function getEventIntegrationCapabilities(event: CalendarEvent): { capabilities: string[]; serviceName?: string } | undefined {
  if (!event.integrationId)
    return undefined;

  const integration = typedIntegrations.value.find(i => i.id === event.integrationId);
  if (!integration)
    return undefined;

  const config = integrationRegistry.get(`${integration.type}:${integration.service}`);
  return {
    capabilities: config?.capabilities || [],
    serviceName: integration.service,
  };
}
</script>

<template>
  <div>
    <CalendarMainView
      :events="allEvents as CalendarEvent[]"
      class="h-[calc(100vh-2rem)]"
      :get-integration-capabilities="getEventIntegrationCapabilities"
      :initial-user-filter="initialUserFilter"
      @event-add="handleEventAdd"
      @event-update="handleEventUpdate"
      @event-delete="handleEventDelete"
      @user-filter-change="handleUserFilterChange"
    />
  </div>
</template>
