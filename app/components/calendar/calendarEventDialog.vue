<script setup lang="ts">
import type { DateValue } from "@internationalized/date";

import { CalendarDate, getLocalTimeZone, parseDate } from "@internationalized/date";
import { consola } from "consola";
import { isBefore } from "date-fns";
import ical from "ical.js";

import type { CalendarEvent } from "~/types/calendar";

import { useCalendar } from "~/composables/useCalendar";
import { useCalendarEventTime } from "~/composables/useCalendarEventTime";
import { useUsers } from "~/composables/useUsers";
import { getBrowserTimezone } from "~/types/global";

import type { ICalEvent } from "../../../server/integrations/iCal/types";

const props = defineProps<{
  event: CalendarEvent | null;
  isOpen: boolean;
  integrationCapabilities?: string[];
  integrationServiceName?: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", event: CalendarEvent): void;
  (e: "delete", eventId: string): void;
}>();

const { users, fetchUsers } = useUsers();

const { getEventStartTimeForInput, getEventEndTimeForInput, getLocalTimeFromUTC } = useCalendar();
const { to12Hour, to24Hour, getRoundedCurrentTime, addMinutesTo12Hour } = useCalendarEventTime();

const StartHour = 0;
const EndHour = 23;
const DefaultStartHour = 9;
const DefaultEndHour = 10;

// Ref to the CalendarEventRecurrence child component (exposed: buildICalEvent, resetRecurrenceFields, isRecurring, recurrenceDays)
const recurrenceRef = ref<{
  buildICalEvent: (start: Date, end: Date) => ICalEvent;
  resetRecurrenceFields: () => void;
  isRecurring: { value: boolean };
  recurrenceDays: { value: number[] };
} | null>(null);

// Drives the child's internal parse watcher — set to the event's ical_event or null to reset
const currentIcalEvent = ref<ICalEvent | null>(null);

const title = ref("");
const description = ref("");
const startDate = ref<DateValue>(new CalendarDate(2022, 2, 6));
const endDate = ref<DateValue>(new CalendarDate(2022, 2, 6));

const allDay = ref(false);
const location = ref("");
const selectedUsers = ref<string[]>([]);
const error = ref<string | null>(null);

// Track if form has unsaved changes
const showUnsavedWarning = ref(false);

// Prevent double-submission
const isSubmitting = ref(false);
const isDeleting = ref(false);

// Store initial values to compare for dirty state
const initialValues = ref({
  title: "",
  description: "",
  location: "",
  allDay: false,
  selectedUsers: [] as string[],
  isRecurring: false,
});

const hourOptions = computed(() => {
  const options = [];
  for (let hour = 1; hour <= 12; hour++) {
    options.push({ value: hour, label: hour.toString() });
  }
  return options;
});

const minuteOptions = computed(() => {
  const options = [];
  for (let minute = 0; minute < 60; minute += 5) {
    const formattedMinute = minute.toString().padStart(2, "0");
    options.push({ value: minute, label: formattedMinute });
  }
  return options;
});

const amPmOptions = [
  { value: "AM", label: "AM" },
  { value: "PM", label: "PM" },
];

const startHour = ref(DefaultStartHour);
const startMinute = ref(0);
const startAmPm = ref("AM");
const endHour = ref(DefaultEndHour);
const endMinute = ref(0);
const endAmPm = ref("AM");

const canEdit = computed(() => {
  if (!props.integrationCapabilities)
    return true;
  return props.integrationCapabilities.includes("edit_events");
});

const canDelete = computed(() => {
  if (!props.integrationCapabilities)
    return true;
  return props.integrationCapabilities.includes("delete_events");
});

const canAdd = computed(() => {
  if (!props.integrationCapabilities)
    return true;
  return props.integrationCapabilities.includes("add_events");
});

const isReadOnly = computed(() => {
  return Boolean(props.event && !canEdit.value);
});

// Check if form has unsaved changes
const hasUnsavedChanges = computed(() => {
  return (
    title.value !== initialValues.value.title
    || description.value !== initialValues.value.description
    || location.value !== initialValues.value.location
    || allDay.value !== initialValues.value.allDay
    || (recurrenceRef.value?.isRecurring.value ?? false) !== initialValues.value.isRecurring
    || JSON.stringify([...selectedUsers.value].sort()) !== JSON.stringify([...initialValues.value.selectedUsers].sort())
  );
});

// Handle close with warning
function handleClose() {
  if (hasUnsavedChanges.value && !isReadOnly.value) {
    showUnsavedWarning.value = true;
  }
  else {
    emit("close");
  }
}

function confirmClose() {
  showUnsavedWarning.value = false;
  emit("close");
}

function cancelClose() {
  showUnsavedWarning.value = false;
}

// Store initial values when form opens or event changes
function storeInitialValues() {
  initialValues.value = {
    title: title.value,
    description: description.value,
    location: location.value,
    allDay: allDay.value,
    selectedUsers: [...selectedUsers.value],
    isRecurring: recurrenceRef.value?.isRecurring.value ?? false,
  };
}

watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    await fetchUsers();
    // Store initial values after a short delay to let the form populate
    setTimeout(() => storeInitialValues(), 100);
  }
  else {
    showUnsavedWarning.value = false;
  }
});

watch(startDate, (newStartDate) => {
  if (newStartDate && endDate.value) {
    const startTime = newStartDate.toDate(getLocalTimeZone());
    const endTime = endDate.value.toDate(getLocalTimeZone());

    if (startTime.getTime() === endTime.getTime() && isStartTimeAfterEndTime()) {
      endDate.value = newStartDate;
    }
    // recurrenceUntil validation is handled inside CalendarEventRecurrence via its startDate prop watcher
  }
});

watch(endDate, (newEndDate) => {
  if (newEndDate && startDate.value) {
    const startTime = startDate.value.toDate(getLocalTimeZone());
    const endTime = newEndDate.toDate(getLocalTimeZone());

    if (startTime.getTime() === endTime.getTime() && isStartTimeAfterEndTime()) {
      startDate.value = newEndDate;
    }
  }
});

watch(startHour, () => updateEndTime());
watch(startMinute, () => updateEndTime());
watch(startAmPm, () => updateEndTime());

watch(endHour, () => updateStartTime());
watch(endMinute, () => updateStartTime());
watch(endAmPm, () => updateStartTime());

function handleAllDayToggle() {
  if (!allDay.value) {
    const { hour24, minutes } = getRoundedCurrentTime();
    const startTime = to12Hour(hour24);

    startHour.value = startTime.hour;
    startMinute.value = minutes;
    startAmPm.value = startTime.amPm;

    const endTime = addMinutesTo12Hour(startTime.hour, minutes, startTime.amPm, 30);
    endHour.value = endTime.hour;
    endMinute.value = endTime.minute;
    endAmPm.value = endTime.amPm;
  }
}

watch(() => props.event, async (newEvent) => {
  if (newEvent) {
    // Handle new events (empty id) - set dates from the event but reset other fields
    if (newEvent.id === "") {
      title.value = "";
      description.value = "";
      location.value = "";
      selectedUsers.value = [];
      error.value = null;
      currentIcalEvent.value = null; // child resets via its icalEvent prop watcher

      // Use the start date from the event (set when clicking "+ Add Event" on a specific day)
      const start = newEvent.start instanceof Date ? newEvent.start : new Date(newEvent.start);
      const startDateStr = start.toISOString().split("T")[0];
      if (startDateStr) {
        startDate.value = parseDate(startDateStr);
        endDate.value = parseDate(startDateStr);
      }

      const { hour24, minutes } = getRoundedCurrentTime();
      const startTime = to12Hour(hour24);

      startHour.value = startTime.hour;
      startMinute.value = minutes;
      startAmPm.value = startTime.amPm;

      const endTime = addMinutesTo12Hour(startTime.hour, minutes, startTime.amPm, 30);
      endHour.value = endTime.hour;
      endMinute.value = endTime.minute;
      endAmPm.value = endTime.amPm;

      allDay.value = newEvent.allDay || false;
      return;
    }

    // Handle existing events
    const isExpandedEvent = newEvent.id.includes("-");
    let originalEvent = newEvent;

    if (isExpandedEvent && !newEvent.integrationId) {
      const originalId = newEvent.id.split("-")[0];

      const fetchedEvent = await $fetch<CalendarEvent>(`/api/calendar-events/${originalId}`);

      if (fetchedEvent) {
        const fetchedCalendarEvent = fetchedEvent;
        originalEvent = {
          ...fetchedCalendarEvent,

          start: newEvent.start,
          end: newEvent.end,

          ical_event: newEvent.ical_event
            ? {
                ...fetchedCalendarEvent.ical_event,
                dtstart: newEvent.ical_event.dtstart,
                dtend: newEvent.ical_event.dtend,
              }
            : null,
        } as CalendarEvent;
      }
    }

    title.value = originalEvent.title || "";
    description.value = originalEvent.description || "";
    const start = originalEvent.start instanceof Date ? originalEvent.start : new Date(originalEvent.start);

    let startLocal, endLocal;

    if (newEvent.allDay) {
      startLocal = new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
      const endDateVal = newEvent.end instanceof Date ? newEvent.end : new Date(newEvent.end);
      endLocal = new Date(endDateVal.getUTCFullYear(), endDateVal.getUTCMonth(), endDateVal.getUTCDate() - 1);
    }
    else {
      startLocal = getLocalTimeFromUTC(start);
      endLocal = getLocalTimeFromUTC(newEvent.end instanceof Date ? newEvent.end : new Date(newEvent.end));
    }

    const startDateStr = startLocal.toLocaleDateString("en-CA");
    const endDateStr = endLocal.toLocaleDateString("en-CA");

    startDate.value = parseDate(startDateStr);
    endDate.value = parseDate(endDateStr);

    const startTimeStr = getEventStartTimeForInput(newEvent);
    const endTimeStr = getEventEndTimeForInput(newEvent);

    const startTimeParts = startTimeStr.split(":");
    if (startTimeParts.length >= 2) {
      const startTimeHour = Number.parseInt(startTimeParts[0]!);
      const startConverted = to12Hour(startTimeHour);
      startHour.value = startConverted.hour;
      startMinute.value = Number.parseInt(startTimeParts[1]!);
      startAmPm.value = startConverted.amPm;
    }

    const endTimeParts = endTimeStr.split(":");
    if (endTimeParts.length >= 2) {
      const endTimeHour = Number.parseInt(endTimeParts[0]!);
      const endConverted = to12Hour(endTimeHour);
      endHour.value = endConverted.hour;
      endMinute.value = Number.parseInt(endTimeParts[1]!);
      endAmPm.value = endConverted.amPm;
    }
    allDay.value = newEvent.allDay || false;
    location.value = newEvent.location || "";
    selectedUsers.value = newEvent.users?.map(user => user.id) || [];
    error.value = null;

    // Drive the child's parse watcher instead of calling parseICalEvent directly
    currentIcalEvent.value = newEvent.ical_event ?? null;
  }
  else {
    resetForm();
  }
}, { immediate: true });

function resetForm() {
  title.value = "";
  description.value = "";

  const now = new Date();
  const todayString = now.toISOString().split("T")[0];
  if (todayString) {
    const todayDate = parseDate(todayString);
    startDate.value = todayDate;
    endDate.value = todayDate;
  }

  const { hour24, minutes } = getRoundedCurrentTime();
  const startTime = to12Hour(hour24);

  startHour.value = startTime.hour;
  startMinute.value = minutes;
  startAmPm.value = startTime.amPm;

  const endTime = addMinutesTo12Hour(startTime.hour, minutes, startTime.amPm, 30);
  endHour.value = endTime.hour;
  endMinute.value = endTime.minute;
  endAmPm.value = endTime.amPm;

  allDay.value = false;
  location.value = "";
  selectedUsers.value = [];
  error.value = null;
  isSubmitting.value = false;
  isDeleting.value = false;
  currentIcalEvent.value = null; // child resets via its icalEvent prop watcher
}

function updateEndTime() {
  if (allDay.value)
    return;

  if (startDate.value.toDate(getLocalTimeZone()).getTime() === endDate.value.toDate(getLocalTimeZone()).getTime() && isStartTimeAfterEndTime()) {
    const endTime = addMinutesTo12Hour(startHour.value, startMinute.value, startAmPm.value, 30);
    endHour.value = endTime.hour;
    endMinute.value = endTime.minute;
    endAmPm.value = endTime.amPm;
  }
}

function updateStartTime() {
  if (allDay.value)
    return;

  if (startDate.value.toDate(getLocalTimeZone()).getTime() === endDate.value.toDate(getLocalTimeZone()).getTime() && isStartTimeAfterEndTime()) {
    let endHour24 = to24Hour(endHour.value, endAmPm.value);
    let adjustedMinute = endMinute.value - 30;

    if (adjustedMinute < 0) {
      adjustedMinute += 60;
      endHour24 -= 1;
    }

    if (endHour24 < 0) {
      endHour24 += 24;
    }

    const newStartTime = to12Hour(endHour24);
    startHour.value = newStartTime.hour;
    startMinute.value = adjustedMinute;
    startAmPm.value = newStartTime.amPm;
  }
}

function isStartTimeAfterEndTime(): boolean {
  const startTime24 = to24Hour(startHour.value, startAmPm.value);
  const endTime24 = to24Hour(endHour.value, endAmPm.value);

  const startTotalMinutes = startTime24 * 60 + startMinute.value;
  const endTotalMinutes = endTime24 * 60 + endMinute.value;

  if (startDate.value.toDate(getLocalTimeZone()).getTime() === endDate.value.toDate(getLocalTimeZone()).getTime()) {
    return startTotalMinutes > endTotalMinutes;
  }

  return false;
}

function handleSave() {
  // Prevent double-submission
  if (isSubmitting.value) {
    return;
  }

  if (!canAdd.value && !props.event) {
    error.value = "This integration does not support creating new events";
    return;
  }

  if (!canEdit.value && props.event) {
    error.value = "This integration does not support editing events";
    return;
  }

  if (!title.value.trim()) {
    error.value = "Title is required";
    return;
  }

  if (!startDate.value || !endDate.value) {
    error.value = "Invalid date selection";
    return;
  }

  isSubmitting.value = true;

  let start: Date;
  let end: Date;

  try {
    if (allDay.value) {
      const startUTC = new Date(Date.UTC(
        startDate.value.year,
        startDate.value.month - 1,
        startDate.value.day,
        0,
        0,
        0,
        0,
      ));

      const endUTC = new Date(Date.UTC(
        endDate.value.year,
        endDate.value.month - 1,
        endDate.value.day + 1,
        0,
        0,
        0,
        0,
      ));

      start = startUTC;
      end = endUTC;
    }
    else {
      const startLocal = startDate.value.toDate(getLocalTimeZone());
      const endLocal = endDate.value.toDate(getLocalTimeZone());

      const startHours24 = to24Hour(startHour.value, startAmPm.value);
      const endHours24 = to24Hour(endHour.value, endAmPm.value);

      if (
        startHours24 < StartHour
        || startHours24 > EndHour
        || endHours24 < StartHour
        || endHours24 > EndHour
      ) {
        error.value = `Selected time must be between ${StartHour}:00 and ${EndHour}:00`;
        return;
      }

      startLocal.setHours(startHours24, startMinute.value, 0, 0);
      endLocal.setHours(endHours24, endMinute.value, 0, 0);

      const browserTimezone = getBrowserTimezone();
      const timezone = browserTimezone ? ical.TimezoneService.get(browserTimezone) : null;

      if (timezone) {
        const startICal = ical.Time.fromJSDate(startLocal, true);
        const endICal = ical.Time.fromJSDate(endLocal, true);

        const startLocalICal = startICal.convertToZone(timezone);
        const endLocalICal = endICal.convertToZone(timezone);

        const startUTC = startLocalICal.convertToZone(ical.TimezoneService.get("UTC"));
        const endUTC = endLocalICal.convertToZone(ical.TimezoneService.get("UTC"));

        start = startUTC.toJSDate();
        end = endUTC.toJSDate();
      }
      else {
        const startICal = ical.Time.fromJSDate(startLocal, false)
          .convertToZone(ical.TimezoneService.get("UTC"));
        const endICal = ical.Time.fromJSDate(endLocal, false)
          .convertToZone(ical.TimezoneService.get("UTC"));
        start = startICal.toJSDate();
        end = endICal.toJSDate();
      }
    }

    const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    if (isBefore(endDateOnly, startDateOnly)) {
      error.value = "End date cannot be before start date";
      return;
    }

    const eventTitle = title.value.trim();

    const selectedUserObjects = users.value
      .filter(user => selectedUsers.value.includes(user.id))
      .map(user => ({
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        color: user.color,
      }));

    // Build the iCal event via the recurrence child component (safe: user interaction guarantees mount)
    const icalEvent = recurrenceRef.value!.buildICalEvent(start, end);
    icalEvent.uid = props.event?.id || `skylite-${Date.now()}`;
    icalEvent.summary = title.value || "(no title)";
    if (description.value)
      icalEvent.description = description.value;
    if (location.value)
      icalEvent.location = location.value;
    if (selectedUsers.value.length > 0) {
      icalEvent.attendees = users.value
        .filter(user => selectedUsers.value.includes(user.id))
        .map((user) => {
          const sanitizedName = user.name.toLowerCase().replace(/[^a-z0-9]/g, "");
          return {
            cn: user.name,
            mailto: user.email || `${sanitizedName}@skylite.local`,
            role: "REQ-PARTICIPANT",
          };
        });
    }

    // Adjust start/end JS dates for weekly recurrence with selected days
    const childIsRecurring = recurrenceRef.value!.isRecurring.value;
    const childRecurrenceDays = recurrenceRef.value!.recurrenceDays.value;

    if (childIsRecurring && childRecurrenceDays.length > 0) {
      const startDay = start.getUTCDay();
      const sortedDays = [...childRecurrenceDays].sort((a, b) => {
        const relativeA = a >= startDay ? a - startDay : 7 - startDay + a;
        const relativeB = b >= startDay ? b - startDay : 7 - startDay + b;
        return relativeA - relativeB;
      });

      const firstDay = sortedDays[0] ?? startDay;
      if (startDay !== firstDay) {
        const daysToAdd = firstDay >= startDay
          ? firstDay - startDay
          : 7 - startDay + firstDay;

        start = new Date(start.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        end = new Date(end.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
      }
    }

    const isExpandedEvent = props.event?.id?.includes("-");
    const eventId = isExpandedEvent ? props.event?.id.split("-")[0] : props.event?.id || "";

    const eventData: CalendarEvent = {
      id: eventId || "",
      title: eventTitle,
      description: description.value,
      start,
      end,
      allDay: allDay.value,
      location: location.value,
      color: props.event?.color || "sky",
      users: selectedUserObjects,
      ical_event: icalEvent,
    };

    emit("save", eventData);
    // Reset submitting state after a short delay to prevent rapid re-clicks
    setTimeout(() => {
      isSubmitting.value = false;
    }, 500);
  }
  catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    consola.error("Calendar Event Dialog: Error converting dates in handleSave:", errorMessage);
    error.value = "Failed to process event dates. Please try again.";
    isSubmitting.value = false;
  }
}

function handleDelete() {
  // Prevent double-delete
  if (isDeleting.value) {
    return;
  }

  if (!canDelete.value) {
    error.value = "This integration does not support deleting events";
    return;
  }

  if (props.event?.id) {
    isDeleting.value = true;
    emit("delete", props.event.id);
    // Reset after a short delay
    setTimeout(() => {
      isDeleting.value = false;
    }, 500);
  }
}
</script>

<template>
  <GlobalDialog
    :is-open="isOpen"
    :title="event?.id ? 'Edit Event' : 'Create Event'"
    :is-submitting="isSubmitting"
    :is-read-only="isReadOnly"
    :show-delete="!!(event?.id && canDelete)"
    :is-deleting="isDeleting"
    @close="handleClose"
    @save="handleSave"
    @delete="handleDelete"
  >
    <div class="space-y-6">
      <div v-if="isReadOnly" class="bg-info/10 text-info rounded-md px-3 py-2 text-sm">
        This event cannot be edited. {{ integrationServiceName || 'This integration' }} does not support editing events.
      </div>
      <div class="space-y-2">
        <label class="block text-sm font-medium text-highlighted">Title</label>
        <UInput
          v-model="title"
          placeholder="Event title"
          class="w-full"
          :ui="{ base: 'w-full' }"
          :disabled="isReadOnly"
        />
      </div>
      <div class="space-y-2">
        <label class="block text-sm font-medium text-highlighted">Description</label>
        <UTextarea
          v-model="description"
          placeholder="Event description"
          :rows="3"
          class="w-full"
          :ui="{ base: 'w-full' }"
          :disabled="isReadOnly"
        />
      </div>
      <div class="flex gap-4">
        <div class="w-1/2 space-y-2">
          <label class="block text-sm font-medium text-highlighted">Start Date</label>
          <UPopover>
            <UButton
              color="neutral"
              variant="subtle"
              icon="i-lucide-calendar"
              class="w-full justify-between"
              :disabled="isReadOnly"
            >
              <NuxtTime
                v-if="startDate"
                :datetime="startDate.toDate(getLocalTimeZone())"
                year="numeric"
                month="short"
                day="numeric"
              />
              <span v-else>Select a date</span>
            </UButton>
            <template #content>
              <UCalendar
                :model-value="startDate as DateValue"
                class="p-2"
                :disabled="isReadOnly"
                @update:model-value="(value) => { if (value) startDate = value as DateValue }"
              />
            </template>
          </UPopover>
        </div>
        <div v-if="!allDay" class="w-1/2 space-y-2">
          <label class="block text-sm font-medium text-highlighted">Start Time</label>
          <div class="flex gap-2">
            <USelect
              v-model="startHour"
              :items="hourOptions"
              option-attribute="label"
              value-attribute="value"
              class="flex-1"
              :ui="{ base: 'flex-1' }"
              :disabled="isReadOnly"
            />
            <USelect
              v-model="startMinute"
              :items="minuteOptions"
              option-attribute="label"
              value-attribute="value"
              class="flex-1"
              :ui="{ base: 'flex-1' }"
              :disabled="isReadOnly"
            />
            <USelect
              v-model="startAmPm"
              :items="amPmOptions"
              option-attribute="label"
              value-attribute="value"
              class="flex-1"
              :ui="{ base: 'flex-1' }"
              :disabled="isReadOnly"
            />
          </div>
        </div>
      </div>
      <div class="flex gap-4">
        <div class="w-1/2 space-y-2">
          <label class="block text-sm font-medium text-highlighted">End Date</label>
          <UPopover>
            <UButton
              color="neutral"
              variant="subtle"
              icon="i-lucide-calendar"
              class="w-full justify-between"
              :disabled="isReadOnly"
            >
              <NuxtTime
                v-if="endDate"
                :datetime="endDate.toDate(getLocalTimeZone())"
                year="numeric"
                month="short"
                day="numeric"
              />
              <span v-else>Select a date</span>
            </UButton>
            <template #content>
              <UCalendar
                :model-value="endDate as DateValue"
                class="p-2"
                :disabled="isReadOnly"
                @update:model-value="(value) => { if (value) endDate = value as DateValue }"
              />
            </template>
          </UPopover>
        </div>
        <div v-if="!allDay" class="w-1/2 space-y-2">
          <label class="block text-sm font-medium text-highlighted">End Time</label>
          <div class="flex gap-2">
            <USelect
              v-model="endHour"
              :items="hourOptions"
              option-attribute="label"
              value-attribute="value"
              class="flex-1"
              :ui="{ base: 'flex-1' }"
              :disabled="isReadOnly"
            />
            <USelect
              v-model="endMinute"
              :items="minuteOptions"
              option-attribute="label"
              value-attribute="value"
              class="flex-1"
              :ui="{ base: 'flex-1' }"
              :disabled="isReadOnly"
            />
            <USelect
              v-model="endAmPm"
              :items="amPmOptions"
              option-attribute="label"
              value-attribute="value"
              class="flex-1"
              :ui="{ base: 'flex-1' }"
              :disabled="isReadOnly"
            />
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <UCheckbox
          v-model="allDay"
          label="All day"
          :disabled="isReadOnly"
          @change="handleAllDayToggle"
        />
      </div>
      <!-- Recurrence UI (checkbox + options) managed by CalendarEventRecurrence -->
      <CalendarEventRecurrence
        ref="recurrenceRef"
        :ical-event="currentIcalEvent"
        :is-read-only="isReadOnly"
        :start-date="startDate"
      />
      <div class="space-y-2">
        <label class="block text-sm font-medium text-highlighted">Location</label>
        <UInput
          v-model="location"
          placeholder="Event location"
          class="w-full"
          :ui="{ base: 'w-full' }"
          :disabled="isReadOnly"
        />
      </div>
      <!-- User selection managed by CalendarEventUserSelector -->
      <CalendarEventUserSelector
        v-model="selectedUsers"
        :users="users"
        :is-read-only="isReadOnly"
        :is-new-event="!event?.id"
      />
    </div>

    <template #footer-left>
      <UButton
        v-if="!isReadOnly && !event?.id"
        color="neutral"
        variant="ghost"
        icon="i-lucide-rotate-ccw"
        @click="resetForm"
      >
        Reset
      </UButton>
    </template>
  </GlobalDialog>

  <!-- Unsaved Changes Warning Modal -->
  <GlobalDialog
    :is-open="showUnsavedWarning"
    title="Unsaved Changes"
    save-label="Discard Changes"
    save-color="error"
    save-variant="subtle"
    cancel-label="Keep Editing"
    max-width="max-w-sm"
    @close="cancelClose"
    @save="confirmClose"
  >
    <p class="text-sm text-muted mb-4">
      You have unsaved changes. Are you sure you want to close without saving?
    </p>
  </GlobalDialog>
</template>
