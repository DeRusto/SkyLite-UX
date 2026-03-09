<script setup lang="ts">
import { consola } from "consola";

import type { Integration } from "~/types/database";

import { useAlertToast } from "~/composables/useAlertToast";

const props = defineProps<{
  householdSettings: any;
  integrations: Integration[];
}>();

const emit = defineEmits<{
  "update:householdSettings": [settings: any];
  "triggerSync": [];
}>();

const { showError } = useAlertToast();

const availableCalendars = computed(() => {
  const calendars: { label: string; value: string; color?: string }[] = [];

  if (!props.integrations)
    return calendars;

  for (const integration of props.integrations) {
    if (integration.service === "google-calendar" && integration.enabled && integration.settings) {
      let settings: unknown = integration.settings;
      if (typeof settings === "string") {
        try {
          settings = JSON.parse(settings);
        }
        catch (e) {
          consola.error("Failed to parse integration settings:", e);
          continue;
        }
      }

      if (!settings || typeof settings !== "object")
        continue;

      const metadata = (settings as any).calendarMetadata || {};
      const selectedIds = Array.isArray((settings as any).selectedCalendars)
        ? (settings as any).selectedCalendars
        : [];

      for (const calId of selectedIds) {
        const meta = metadata[calId];
        calendars.push({
          label: meta?.summary || "Unknown Calendar",
          value: `${integration.id}:${calId}`,
          color: meta?.color,
        });
      }
    }
  }
  return calendars;
});

function getLinkedCalendarsByType(type: "HOLIDAY" | "FAMILY"): string[] {
  if (!props.householdSettings?.linkedCalendars)
    return [];

  if (!Array.isArray(props.householdSettings.linkedCalendars))
    return [];

  return props.householdSettings.linkedCalendars
    .filter((l: any) => l.type === type)
    .map((l: any) => `${l.integrationId}:${l.calendarId}`);
}

async function toggleHouseholdCalendar(type: "HOLIDAY" | "FAMILY", value: string, checked: boolean) {
  if (!props.householdSettings)
    return;

  const [integrationId, calendarId] = value.split(":");
  let currentLinks = Array.isArray(props.householdSettings.linkedCalendars)
    ? [...props.householdSettings.linkedCalendars]
    : [];

  if (checked) {
    const exists = currentLinks.some(
      (l: any) => l.type === type && l.integrationId === integrationId && l.calendarId === calendarId,
    );
    if (!exists) {
      currentLinks.push({ type, integrationId, calendarId });
    }
  }
  else {
    currentLinks = currentLinks.filter(
      (l: any) => !(l.type === type && l.integrationId === integrationId && l.calendarId === calendarId),
    );
  }

  // Emit updated settings for parent to update its ref
  emit("update:householdSettings", { ...props.householdSettings, linkedCalendars: currentLinks });

  try {
    await $fetch("/api/household/settings", {
      method: "PUT",
      body: { linkedCalendars: currentLinks },
    });

    emit("triggerSync");
  }
  catch (err) {
    consola.error("Failed to update household calendars", err);
    showError("Failed to Save", "Could not update calendar settings.");
  }
}

const linkedHolidayCalendars = computed(() => getLinkedCalendarsByType("HOLIDAY"));
const linkedFamilyCalendars = computed(() => getLinkedCalendarsByType("FAMILY"));

async function updateHouseholdColor(type: "HOLIDAY" | "FAMILY", color: string) {
  if (!props.householdSettings)
    return;

  const updatedSettings = { ...props.householdSettings };
  if (type === "HOLIDAY")
    updatedSettings.holidayColor = color;
  if (type === "FAMILY")
    updatedSettings.familyColor = color;

  emit("update:householdSettings", updatedSettings);

  try {
    await $fetch("/api/household/settings", {
      method: "PUT",
      body: {
        holidayColor: updatedSettings.holidayColor,
        familyColor: updatedSettings.familyColor,
      },
    });

    emit("triggerSync");
  }
  catch (err) {
    consola.error("Failed to update household colors", err);
    showError("Failed to Save", "Could not update color settings.");
  }
}
</script>

<template>
  <div class="bg-default rounded-lg shadow-sm border border-default p-6 mb-6">
    <h2 class="text-lg font-semibold text-highlighted mb-4">
      Household Calendars
    </h2>
    <div v-if="availableCalendars.length === 0" class="text-muted text-sm italic">
      No calendars available. Please configure a Calendar integration first.
    </div>
    <div v-else class="space-y-6">
      <!-- Holiday Calendars -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <div>
            <label class="block text-sm font-medium text-highlighted">Holiday Calendars</label>
            <p class="text-xs text-muted mb-2">
              Events from these calendars will be tagged as Holidays.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted">Color</span>
            <input
              type="color"
              :value="householdSettings?.holidayColor || '#ef4444'"
              class="h-6 w-8 p-0 border border-default rounded cursor-pointer bg-transparent"
              aria-label="Holiday Calendar Color"
              @change="(e) => updateHouseholdColor('HOLIDAY', (e.target as HTMLInputElement).value)"
            >
          </div>
        </div>
        <div class="space-y-1 max-h-48 overflow-y-auto border border-default rounded-md p-2">
          <div
            v-for="cal in availableCalendars"
            :key="`holiday-${cal.value}`"
            class="flex items-center gap-2"
          >
            <UCheckbox
              :model-value="linkedHolidayCalendars.includes(cal.value)"
              :label="cal.label"
              color="primary"
              @update:model-value="(checked: any) => toggleHouseholdCalendar('HOLIDAY', cal.value, checked)"
            />
            <span
              v-if="cal.color"
              :style="{ backgroundColor: cal.color }"
              class="size-2 rounded-full shrink-0"
            />
          </div>
        </div>
      </div>

      <!-- Family Calendars -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <div>
            <label class="block text-sm font-medium text-highlighted">Family Calendars</label>
            <p class="text-xs text-muted mb-2">
              Events from these calendars will be tagged as Family Events.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-muted">Color</span>
            <input
              type="color"
              :value="householdSettings?.familyColor || '#3b82f6'"
              class="h-6 w-8 p-0 border border-default rounded cursor-pointer bg-transparent"
              aria-label="Family Calendar Color"
              @change="(e) => updateHouseholdColor('FAMILY', (e.target as HTMLInputElement).value)"
            >
          </div>
        </div>
        <div class="space-y-1 max-h-48 overflow-y-auto border border-default rounded-md p-2">
          <div
            v-for="cal in availableCalendars"
            :key="`family-${cal.value}`"
            class="flex items-center gap-2"
          >
            <UCheckbox
              :model-value="linkedFamilyCalendars.includes(cal.value)"
              :label="cal.label"
              color="primary"
              @update:model-value="(checked: any) => toggleHouseholdCalendar('FAMILY', cal.value, checked)"
            />
            <span
              v-if="cal.color"
              :style="{ backgroundColor: cal.color }"
              class="size-2 rounded-full shrink-0"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
