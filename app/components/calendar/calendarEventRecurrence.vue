<script setup lang="ts">
import type { DateValue } from "@internationalized/date";

import { CalendarDate, getLocalTimeZone } from "@internationalized/date";
import { consola } from "consola";
import { isBefore } from "date-fns";
import ical from "ical.js";

import type { ICalEvent } from "../../../server/integrations/iCal/types";

const props = defineProps<{
  icalEvent: ICalEvent | null;
  isReadOnly: boolean;
  startDate: DateValue;
}>();

const isRecurring = ref(false);
const recurrenceType = ref<"daily" | "weekly" | "monthly" | "yearly">("weekly");
const recurrenceInterval = ref(1);
const recurrenceEndType = ref<"never" | "count" | "until">("never");
const recurrenceCount = ref(10);
const recurrenceUntil = ref<DateValue>(new CalendarDate(2025, 12, 31));
const recurrenceDays = ref<number[]>([]);
const recurrenceMonthlyType = ref<"day" | "weekday">("day");
const recurrenceMonthlyWeekday = ref<{ week: number; day: number }>({ week: 1, day: 1 });
const recurrenceYearlyType = ref<"day" | "weekday">("day");
const recurrenceYearlyWeekday = ref<{ week: number; day: number; month: number }>({ week: 1, day: 1, month: 0 });

const recurrenceTypeOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const recurrenceEndTypeOptions = [
  { value: "never", label: "Never" },
  { value: "count", label: "After" },
  { value: "until", label: "Until" },
];

const dayOptions = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const monthlyTypeOptions = [
  { value: "day", label: "On day" },
  { value: "weekday", label: "On weekday" },
];

const yearlyTypeOptions = [
  { value: "day", label: "On day" },
  { value: "weekday", label: "On weekday" },
];

const weekOptions = [
  { value: 1, label: "First" },
  { value: 2, label: "Second" },
  { value: 3, label: "Third" },
  { value: 4, label: "Fourth" },
  { value: -1, label: "Last" },
];

const monthOptions = [
  { value: 0, label: "January" },
  { value: 1, label: "February" },
  { value: 2, label: "March" },
  { value: 3, label: "April" },
  { value: 4, label: "May" },
  { value: 5, label: "June" },
  { value: 6, label: "July" },
  { value: 7, label: "August" },
  { value: 8, label: "September" },
  { value: 9, label: "October" },
  { value: 10, label: "November" },
  { value: 11, label: "December" },
];

function toggleRecurrenceDay(day: number) {
  if (props.isReadOnly)
    return;

  const index = recurrenceDays.value.indexOf(day);
  if (index > -1) {
    recurrenceDays.value.splice(index, 1);
  }
  else {
    recurrenceDays.value.push(day);
  }
}

function parseICalEvent(icalData: ICalEvent | null): void {
  if (!icalData || icalData.type !== "VEVENT") {
    resetRecurrenceFields();
    return;
  }

  try {
    const event = icalData;

    const rrule = event.rrule;
    if (rrule) {
      isRecurring.value = true;

      const freq = rrule.freq?.toLowerCase();
      if (freq && ["daily", "weekly", "monthly", "yearly"].includes(freq)) {
        recurrenceType.value = freq as "daily" | "weekly" | "monthly" | "yearly";
      }

      recurrenceInterval.value = rrule.interval || 1;

      const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

      if (recurrenceType.value === "weekly" && rrule.byday) {
        recurrenceDays.value = rrule.byday.map((day: string) => dayNames.indexOf(day)).filter((day: number) => day !== -1);
      }

      if (recurrenceType.value === "monthly" && rrule.byday) {
        const bydayStr = Array.isArray(rrule.byday) ? rrule.byday[0] : rrule.byday;
        if (bydayStr) {
          const weekMatch = bydayStr.match(/^(-?\d+)([A-Z]{2})$/);
          if (weekMatch) {
            const week = Number.parseInt(weekMatch[1] || "1", 10);
            const dayCode = weekMatch[2] || "SU";
            const dayIndex = dayNames.indexOf(dayCode);

            if (dayIndex !== -1) {
              recurrenceMonthlyType.value = "weekday";
              recurrenceMonthlyWeekday.value = { week, day: dayIndex };
            }
          }
        }
      }

      if (recurrenceType.value === "yearly" && rrule.byday && rrule.bymonth) {
        const bydayStr = Array.isArray(rrule.byday) ? rrule.byday[0] : rrule.byday;
        if (bydayStr) {
          const weekMatch = bydayStr.match(/^(-?\d+)([A-Z]{2})$/);
          if (weekMatch) {
            const week = Number.parseInt(weekMatch[1] || "1", 10);
            const dayCode = weekMatch[2] || "SU";
            const dayIndex = dayNames.indexOf(dayCode);

            if (dayIndex !== -1) {
              recurrenceYearlyType.value = "weekday";
              const month = Array.isArray(rrule.bymonth) ? (rrule.bymonth[0] || 1) - 1 : (rrule.bymonth || 1) - 1;
              recurrenceYearlyWeekday.value = { week, day: dayIndex, month };
            }
          }
        }
      }

      if (rrule.count) {
        recurrenceEndType.value = "count";
        recurrenceCount.value = rrule.count;
      }
      else if (rrule.until) {
        recurrenceEndType.value = "until";
        const untilICal = ical.Time.fromString(rrule.until, "UTC");
        if (untilICal) {
          const untilDate = untilICal.toJSDate();
          recurrenceUntil.value = new CalendarDate(
            untilDate.getUTCFullYear(),
            untilDate.getUTCMonth() + 1,
            untilDate.getUTCDate(),
          );
        }
      }
      else {
        recurrenceEndType.value = "never";
      }
    }
    else {
      resetRecurrenceFields();
    }
  }
  catch (err) {
    consola.error("CalendarEventRecurrence: Error parsing iCal event:", err);
    resetRecurrenceFields();
  }
}

function resetRecurrenceFields(): void {
  isRecurring.value = false;
  recurrenceType.value = "weekly";
  recurrenceInterval.value = 1;
  recurrenceEndType.value = "never";
  recurrenceCount.value = 10;
  recurrenceUntil.value = new CalendarDate(2025, 12, 31);
  recurrenceDays.value = [];
  recurrenceMonthlyType.value = "day";
  recurrenceMonthlyWeekday.value = { week: 1, day: 1 };
  recurrenceYearlyType.value = "day";
  recurrenceYearlyWeekday.value = { week: 1, day: 1, month: 0 };
}

function buildICalEvent(start: Date, end: Date): ICalEvent {
  const startTime = ical.Time.fromJSDate(start, true);
  const endTime = ical.Time.fromJSDate(end, true);

  const event: ICalEvent = {
    type: "VEVENT",
    uid: "",
    summary: "",
    dtstart: startTime.toString(),
    dtend: endTime.toString(),
  };

  if (isRecurring.value) {
    const rruleObj: ICalEvent["rrule"] = {
      freq: recurrenceType.value.toUpperCase(),
      ...(recurrenceInterval.value > 1 && { interval: recurrenceInterval.value }),
    };

    const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

    if (recurrenceDays.value.length > 0) {
      const startDay = start.getUTCDay();
      const sortedDays = [...recurrenceDays.value].sort((a, b) => {
        const relativeA = a >= startDay ? a - startDay : 7 - startDay + a;
        const relativeB = b >= startDay ? b - startDay : 7 - startDay + b;
        return relativeA - relativeB;
      });

      const firstDay = sortedDays[0] ?? startDay;
      if (startDay !== firstDay) {
        const daysToAdd = firstDay >= startDay
          ? firstDay - startDay
          : 7 - startDay + firstDay;

        const adjustedStart = new Date(start.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        const adjustedEnd = new Date(end.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

        event.dtstart = ical.Time.fromJSDate(adjustedStart, true).toString();
        event.dtend = ical.Time.fromJSDate(adjustedEnd, true).toString();
      }
    }

    if (recurrenceType.value === "weekly" && recurrenceDays.value.length > 0) {
      rruleObj.byday = recurrenceDays.value
        .map(day => dayNames[day] || "SU")
        .filter((day): day is string => Boolean(day));
    }

    if (recurrenceType.value === "monthly" && recurrenceMonthlyType.value === "weekday") {
      const week = recurrenceMonthlyWeekday.value.week;
      const day = dayNames[recurrenceMonthlyWeekday.value.day];
      rruleObj.byday = [`${week}${day}`];
    }

    if (recurrenceType.value === "yearly" && recurrenceYearlyType.value === "weekday") {
      const week = recurrenceYearlyWeekday.value.week;
      const day = dayNames[recurrenceYearlyWeekday.value.day];
      const month = recurrenceYearlyWeekday.value.month + 1;
      rruleObj.byday = [`${week}${day}`];
      rruleObj.bymonth = [month];
    }

    if (recurrenceEndType.value === "count") {
      rruleObj.count = recurrenceCount.value;
    }
    else if (recurrenceEndType.value === "until" && recurrenceUntil.value) {
      const untilDate = recurrenceUntil.value.toDate(getLocalTimeZone());
      if (untilDate) {
        const endOfDay = new Date(untilDate);
        endOfDay.setHours(23, 59, 59, 999);
        const untilICal = ical.Time.fromJSDate(endOfDay, true);
        rruleObj.until = untilICal.toString();
      }
    }

    event.rrule = rruleObj;
  }

  return event;
}

// Parse incoming icalEvent prop whenever it changes (immediate: true avoids
// timing issues with the parent's props.event watcher firing during parent setup)
watch(() => props.icalEvent, (newIcalEvent) => {
  parseICalEvent(newIcalEvent);
}, { immediate: true });

// Validate recurrenceUntil stays at or after startDate when startDate changes
watch(() => props.startDate, (newStartDate) => {
  if (isRecurring.value && recurrenceEndType.value === "until") {
    const untilDate = recurrenceUntil.value.toDate(getLocalTimeZone());
    const startLocalDate = newStartDate.toDate(getLocalTimeZone());
    if (isBefore(untilDate, startLocalDate)) {
      recurrenceUntil.value = newStartDate;
    }
  }
});

// Validate recurrenceUntil stays at or after startDate when recurrenceUntil changes
let isUpdatingUntil = false;
watch(recurrenceUntil, () => {
  if (!isUpdatingUntil && isRecurring.value && recurrenceEndType.value === "until") {
    isUpdatingUntil = true;
    const untilDate = recurrenceUntil.value.toDate(getLocalTimeZone());
    const startLocalDate = props.startDate.toDate(getLocalTimeZone());

    if (isBefore(untilDate, startLocalDate)) {
      recurrenceUntil.value = props.startDate;
    }
    isUpdatingUntil = false;
  }
});

/**
 * Returns a plain, JSON-serialisable snapshot of all recurrence fields.
 *  Used by the parent's dirty-check so changes to interval/days/count/until
 *  are detected, not just the isRecurring boolean.
 */
function serializeRecurrence() {
  return {
    isRecurring: isRecurring.value,
    type: recurrenceType.value,
    interval: recurrenceInterval.value,
    endType: recurrenceEndType.value,
    count: recurrenceCount.value,
    until: recurrenceUntil.value?.toString() ?? null,
    days: [...recurrenceDays.value].sort((a, b) => a - b),
    monthlyType: recurrenceMonthlyType.value,
    monthlyWeekday: { ...recurrenceMonthlyWeekday.value },
    yearlyType: recurrenceYearlyType.value,
    yearlyWeekday: { ...recurrenceYearlyWeekday.value },
  };
}

defineExpose({ buildICalEvent, resetRecurrenceFields, isRecurring, recurrenceDays, serializeRecurrence });
</script>

<template>
  <div>
    <div class="flex items-center gap-2">
      <UCheckbox
        v-model="isRecurring"
        label="Repeat"
        :disabled="isReadOnly"
      />
    </div>
    <div v-if="isRecurring" class="space-y-4 p-4 bg-muted rounded-lg mt-4">
      <div class="flex gap-4">
        <div class="w-1/2 space-y-2">
          <label class="block text-sm font-medium text-highlighted">Repeat</label>
          <USelect
            v-model="recurrenceType"
            :items="recurrenceTypeOptions"
            option-attribute="label"
            value-attribute="value"
            class="w-full"
            :ui="{ base: 'w-full' }"
            :disabled="isReadOnly"
          />
        </div>
        <div class="w-1/2 space-y-2">
          <label class="block text-sm font-medium text-highlighted">Every</label>
          <UInput
            v-model.number="recurrenceInterval"
            type="number"
            min="1"
            max="99"
            class="w-full"
            :ui="{ base: 'w-full' }"
            :disabled="isReadOnly"
          />
        </div>
      </div>
      <div v-if="recurrenceType === 'weekly'" class="space-y-2">
        <label class="block text-sm font-medium text-highlighted">Repeat on</label>
        <div class="flex gap-1">
          <UButton
            v-for="day in dayOptions"
            :key="day.value"
            :variant="recurrenceDays.includes(day.value) ? 'solid' : 'outline'"
            size="sm"
            class="flex-1"
            :disabled="isReadOnly"
            @click="toggleRecurrenceDay(day.value)"
          >
            {{ day.label }}
          </UButton>
        </div>
        <div v-if="recurrenceDays.length > 0" class="text-sm text-warning">
          <div class="flex items-center justify-center gap-2">
            <span>
              Dates will be adjusted based on selected days
            </span>
          </div>
        </div>
      </div>
      <div v-if="recurrenceType === 'monthly'" class="space-y-4">
        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Repeat on</label>
          <USelect
            v-model="recurrenceMonthlyType"
            :items="monthlyTypeOptions"
            option-attribute="label"
            value-attribute="value"
            class="w-full"
            :ui="{ base: 'w-full' }"
            :disabled="isReadOnly"
          />
        </div>
        <div v-if="recurrenceMonthlyType === 'weekday'" class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Weekday</label>
          <div class="flex gap-2">
            <USelect
              v-model="recurrenceMonthlyWeekday.week"
              :items="weekOptions"
              option-attribute="label"
              value-attribute="value"
              class="flex-1"
              :ui="{ base: 'flex-1' }"
              :disabled="isReadOnly"
            />
            <USelect
              v-model="recurrenceMonthlyWeekday.day"
              :items="dayOptions"
              option-attribute="label"
              value-attribute="value"
              class="flex-1"
              :ui="{ base: 'flex-1' }"
              :disabled="isReadOnly"
            />
          </div>
        </div>
      </div>
      <div v-if="recurrenceType === 'yearly'" class="space-y-4">
        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Repeat on</label>
          <USelect
            v-model="recurrenceYearlyType"
            :items="yearlyTypeOptions"
            option-attribute="label"
            value-attribute="value"
            class="w-full"
            :ui="{ base: 'w-full' }"
            :disabled="isReadOnly"
          />
        </div>
        <div v-if="recurrenceYearlyType === 'weekday'" class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Weekday</label>
          <div class="flex gap-2">
            <USelect
              v-model="recurrenceYearlyWeekday.week"
              :items="weekOptions"
              option-attribute="label"
              value-attribute="value"
              class="flex-1"
              :ui="{ base: 'flex-1' }"
              :disabled="isReadOnly"
            />
            <USelect
              v-model="recurrenceYearlyWeekday.day"
              :items="dayOptions"
              option-attribute="label"
              value-attribute="value"
              class="flex-1"
              :ui="{ base: 'flex-1' }"
              :disabled="isReadOnly"
            />
            <USelect
              v-model="recurrenceYearlyWeekday.month"
              :items="monthOptions"
              option-attribute="label"
              value-attribute="value"
              class="flex-1"
              :ui="{ base: 'flex-1' }"
              :disabled="isReadOnly"
            />
          </div>
        </div>
      </div>
      <div class="space-y-2">
        <label class="block text-sm font-medium text-highlighted">Ends</label>
        <div class="flex gap-4">
          <USelect
            v-model="recurrenceEndType"
            :items="recurrenceEndTypeOptions"
            option-attribute="label"
            value-attribute="value"
            class="flex-1"
            :ui="{ base: 'flex-1' }"
            :disabled="isReadOnly"
          />
          <UInput
            v-if="recurrenceEndType === 'count'"
            v-model.number="recurrenceCount"
            type="number"
            min="1"
            max="999"
            placeholder="10"
            class="w-20"
            :ui="{ base: 'w-20' }"
            :disabled="isReadOnly"
          />
          <UPopover v-if="recurrenceEndType === 'until'">
            <UButton
              color="neutral"
              variant="subtle"
              icon="i-lucide-calendar"
              class="flex-1 justify-between"
              :disabled="isReadOnly"
            >
              <NuxtTime
                v-if="recurrenceUntil"
                :datetime="recurrenceUntil.toDate(getLocalTimeZone())"
                year="numeric"
                month="short"
                day="numeric"
              />
              <span v-else>Select date</span>
            </UButton>
            <template #content>
              <UCalendar
                :model-value="recurrenceUntil as DateValue"
                class="p-2"
                :disabled="isReadOnly"
                @update:model-value="(value) => { if (value) recurrenceUntil = value as DateValue }"
              />
            </template>
          </UPopover>
        </div>
      </div>
    </div>
  </div>
</template>
