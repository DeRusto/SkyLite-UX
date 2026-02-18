<script setup lang="ts">
import { isValid, parseISO } from "date-fns";

import type { CalendarEvent } from "~/types/calendar";
import type { Integration } from "~/types/database";

import { useCalendar } from "~/composables/useCalendar";
import { useCalendarEvents } from "~/composables/useCalendarEvents";
import { useIntegrations } from "~/composables/useIntegrations";
import { integrationRegistry } from "~/types/integrations";

const route = useRoute();
const { allEvents } = useCalendar();
const { integrations } = useIntegrations();
const router = useRouter();

const { addEvent, updateEvent, deleteEvent } = useCalendarEvents();
const typedIntegrations = computed(() => (integrations.value ?? []) as Integration[]);

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
      @event-add="addEvent"
      @event-update="updateEvent"
      @event-delete="deleteEvent"
      @user-filter-change="handleUserFilterChange"
    />
  </div>
</template>
