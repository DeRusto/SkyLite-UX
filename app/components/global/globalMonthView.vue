<script setup lang="ts">
import { format } from "date-fns";
import { computed } from "vue";

import type { CalendarEvent } from "~/types/calendar";

import { useCalendar } from "~/composables/useCalendar";
import { useStableDate } from "~/composables/useStableDate";

const props = defineProps<{
  weeks: Date[][];
  events: CalendarEvent[];
  isCurrentMonth: boolean;
  cellId: string;
  remainingCount?: number;
  hasMore?: boolean;
  eventHeight?: number;
}>();

const emit = defineEmits<{
  (e: "eventCreate", date: Date): void;
  (e: "eventClick", event: CalendarEvent, mouseEvent: MouseEvent): void;
}>();

const { isToday, handleEventClick: _handleEventClick, scrollToDate, getAllEventsForDay, isPlaceholderEvent, sortEvents, computedEventHeight: getEventHeight } = useCalendar();

const { getStableDate } = useStableDate();

const { isDesktop } = useBreakpoint();

const selectedDay = ref<Date>(getStableDate());

const computedEventHeight = computed(() => getEventHeight("month", props.eventHeight));

const eventGap = 4;

const eventsByDay = computed(() => {
  const map = new Map<string, CalendarEvent[]>();
  for (const week of props.weeks) {
    for (const day of week) {
      const key = format(day, "yyyy-MM-dd");
      const events = getAllEventsForDay(props.events, day);
      map.set(key, sortEvents(events));
    }
  }
  return map;
});

function getEventsForDay(day: Date): CalendarEvent[] {
  const key = format(day, "yyyy-MM-dd");
  return eventsByDay.value.get(key) || [];
}

function selectDay(day: Date) {
  selectedDay.value = day;
}

const selectedDayEvents = computed(() => getEventsForDay(selectedDay.value));

function hasEventsOnDay(day: Date): boolean {
  return getEventsForDay(day).length > 0;
}

function isSelectedDay(day: Date): boolean {
  return format(day, "yyyy-MM-dd") === format(selectedDay.value, "yyyy-MM-dd");
}

const displayedMonth = computed(() => {
  if (props.weeks.length === 0)
    return -1;
  const midWeek = props.weeks[Math.floor(props.weeks.length / 2)];
  return midWeek?.[3]?.getMonth() ?? -1;
});

function isDayInDisplayedMonth(day: Date): boolean {
  return day.getMonth() === displayedMonth.value;
}

onMounted(() => {
  scrollToDate(getStableDate(), "month");
});

watch(() => props.weeks, () => {
  nextTick(() => {
    scrollToDate(getStableDate(), "month");
  });
});

function handleEventClick(event: CalendarEvent, e: MouseEvent) {
  _handleEventClick(event, e, emit);
}
</script>

<template>
  <div class="h-full w-full">
    <!-- Mobile: Stacked mini-month + event list -->
    <div v-if="!isDesktop" class="flex flex-col h-full">
      <div class="px-3 pt-3 pb-2">
        <div class="grid grid-cols-7 gap-1 mb-1">
          <div
            v-for="dayLabel in ['S', 'M', 'T', 'W', 'T', 'F', 'S']"
            :key="dayLabel"
            class="text-center text-[10px] font-medium text-muted py-1"
          >
            {{ dayLabel }}
          </div>
        </div>
        <div class="grid grid-cols-7 gap-1">
          <template
            v-for="(week, weekIndex) in weeks"
            :key="weekIndex"
          >
            <button
              v-for="day in week"
              :key="day.toString()"
              type="button"
              class="aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-colors relative"
              :class="{
                'bg-primary text-white font-semibold': isSelectedDay(day) && isToday(day),
                'bg-primary/20 text-primary font-semibold': isSelectedDay(day) && !isToday(day),
                'text-info font-medium': isToday(day) && !isSelectedDay(day),
                'text-highlighted': !isToday(day) && !isSelectedDay(day) && isDayInDisplayedMonth(day),
                'text-dimmed': !isDayInDisplayedMonth(day) && !isSelectedDay(day),
              }"
              @click="selectDay(day)"
            >
              <NuxtTime
                :datetime="day"
                day="numeric"
              />
              <div
                v-if="hasEventsOnDay(day)"
                class="absolute bottom-0.5 w-1 h-1 rounded-full bg-primary"
              />
            </button>
          </template>
        </div>
      </div>

      <div class="px-4 py-2 border-t border-default">
        <h3 class="text-sm font-semibold text-highlighted">
          <NuxtTime
            :datetime="selectedDay"
            weekday="long"
            month="long"
            day="numeric"
          />
        </h3>
      </div>

      <div class="flex-1 overflow-y-auto px-4 pb-4">
        <div
          v-if="selectedDayEvents.length === 0"
          class="flex flex-col items-center justify-center py-12 text-muted"
        >
          <UIcon
            name="i-lucide-calendar-off"
            class="w-8 h-8 mb-2"
          />
          <span class="text-sm">No events</span>
        </div>
        <div
          v-else
          class="space-y-2"
        >
          <CalendarEventItem
            v-for="event in selectedDayEvents"
            v-show="!isPlaceholderEvent(event)"
            :key="event.id"
            :event="event"
            view="agenda"
            @click="(e) => handleEventClick(event, e)"
          />
        </div>
      </div>
    </div>

    <!-- Desktop: Full 7-column grid -->
    <div class="sticky top-[80px] z-30 grid grid-cols-7 border-b border-default bg-muted/80 backdrop-blur-md" v-if="isDesktop">
      <div
        v-for="day in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']"
        :key="day"
        class="py-2 text-center text-sm font-medium text-muted"
      >
        {{ day }}
      </div>
    </div>
    <div v-if="isDesktop" class="grid h-full w-full grid-cols-7">
      <div
        v-for="(week, weekIndex) in weeks"
        :key="weekIndex"
        class="contents"
      >
        <div
          v-for="day in week"
          :key="day.toString()"
          :data-date="format(day, 'yyyy-MM-dd')"
          class="group flex h-full flex-col border border-default last:border-r-0"
          :class="{
            'bg-muted/25 text-muted': !isCurrentMonth,
            'bg-info/10': isToday(day),
          }"
        >
          <div class="flex justify-end items-center p-0.5">
            <div
              class="inline-flex h-6 w-6 items-center justify-center rounded-full text-sm"
              :class="{
                'bg-primary text-white': isToday(day),
                'text-muted': !isToday(day),
              }"
            >
              <NuxtTime :datetime="day" day="numeric" />
            </div>
          </div>
          <div class="border-b border-default mb-1" />
          <div
            class="overflow-y-auto px-2 py-1 space-y-1 relative z-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col"
            :style="{ height: `${(computedEventHeight + eventGap) * 3}px` }"
          >
            <div
              v-for="event in getEventsForDay(day)"
              v-show="!isPlaceholderEvent(event)"
              :key="`${event.id}-${day.toISOString().slice(0, 10)}`"
              class="rounded"
            >
              <CalendarEventItem
                :event="event"
                view="month"
                :current-day="day"
                class="rounded"
                @click="(e) => handleEventClick(event, e)"
              />
            </div>

            <div v-show="getEventsForDay(day).length === 0" class="flex flex-col items-center justify-center gap-1 text-muted flex-1">
              <UIcon name="i-lucide-calendar-off" class="w-6 h-6" />
              <span class="text-md text-muted">
                {{ isToday(day) ? 'No events today' : 'No events' }}
              </span>
            </div>
            <UPopover v-if="hasMore">
              <UButton
                variant="ghost"
                class="w-full justify-start px-1 text-[10px] sm:px-2 sm:text-xs text-muted hover:bg-accented rounded-md transition-colors"
                :style="{ marginTop: `${eventGap}px`, height: `${computedEventHeight}px` }"
                @click.stop
              >
                <span>
                  + {{ remainingCount }}
                  <span class="max-sm:sr-only">more</span>
                </span>
              </UButton>
              <template #panel>
                <div
                  class="w-52 p-3 bg-default rounded-lg shadow-lg border border-default"
                >
                  <div class="space-y-2">
                    <div class="text-sm font-medium">
                      <NuxtTime
                        :datetime="day"
                        weekday="short"
                        day="numeric"
                      />
                    </div>
                    <div class="space-y-1">
                      <div
                        v-for="event in getEventsForDay(day)"
                        v-show="!isPlaceholderEvent(event)"
                        :key="event.id"
                      >
                        <CalendarEventItem
                          :event="event"
                          view="month"
                          :current-day="day"
                          @click="(e) => handleEventClick(event, e)"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </UPopover>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
