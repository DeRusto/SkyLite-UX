<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";

import { addDays, endOfWeek, isSameMonth, startOfWeek } from "date-fns";

import type { CalendarView } from "~/types/calendar";
import type { TodoDueRange, TodoSortMode } from "~/types/ui";

import { useStableDate } from "~/composables/useStableDate";
import { useUsers } from "~/composables/useUsers";
import { TODO_DUE_RANGE_OPTIONS, TODO_SORT_OPTIONS } from "~/types/ui";

const props = defineProps<{
  showNavigation?: boolean;
  showViewSelector?: boolean;
  showExport?: boolean;
  showUserFilter?: boolean;
  showTodoSortSelector?: boolean;
  showTodoFilterSelector?: boolean;
  currentDate?: Date;
  view?: CalendarView;
  todoSortBy?: TodoSortMode;
  todoDueRange?: TodoDueRange;
  className?: string;
  selectedUserIds?: string[];
}>();

const emit = defineEmits<{
  (e: "previous"): void;
  (e: "next"): void;
  (e: "today"): void;
  (e: "viewChange", view: CalendarView): void;
  (e: "dateChange", date: Date): void;
  (e: "export"): void;
  (e: "userFilterChange", userIds: string[]): void;
  (e: "todoSortChange", mode: TodoSortMode): void;
  (e: "todoDueRangeChange", range: TodoDueRange): void;
}>();

const isExporting = ref(false);

async function handleExport() {
  isExporting.value = true;
  try {
    // Trigger file download by navigating to the export endpoint
    const link = document.createElement("a");
    link.href = "/api/calendar-events/export";
    link.download = "skylite-calendar.ics";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    emit("export");
  }
  finally {
    isExporting.value = false;
  }
}

const { isDesktop } = useBreakpoint();
const { getStableDate } = useStableDate();
const { users, fetchUsers } = useUsers();

// Fetch users on mount
onMounted(() => {
  fetchUsers();
});

const selectedUsers = computed(() => props.selectedUserIds || []);

function isUserSelected(userId: string) {
  return selectedUsers.value.length === 0 || selectedUsers.value.includes(userId);
}

function toggleUserFilter(userId: string) {
  const currentSelection = [...selectedUsers.value];
  const index = currentSelection.indexOf(userId);

  if (index === -1) {
    // Add user to filter
    currentSelection.push(userId);
  }
  else {
    // Remove user from filter
    currentSelection.splice(index, 1);
  }

  emit("userFilterChange", currentSelection);
}

function clearUserFilter() {
  emit("userFilterChange", []);
}

const currentDate = computed(() => props.currentDate || getStableDate());
const view = computed(() => props.view || "week");

const now = ref(new Date());

onMounted(() => {
  const interval = setInterval(() => {
    now.value = new Date();
  }, 30000);

  onBeforeUnmount(() => {
    clearInterval(interval);
  });
});

const viewTitle = computed(() => {
  if (view.value === "month") {
    return "month";
  }
  else if (view.value === "week") {
    const start = startOfWeek(currentDate.value, { weekStartsOn: 0 });
    const end = endOfWeek(currentDate.value, { weekStartsOn: 0 });
    if (isSameMonth(start, end)) {
      return "week-same-month";
    }
    else {
      return "week-different-months";
    }
  }
  else if (view.value === "day") {
    return "day";
  }
  else if (view.value === "agenda") {
    const start = currentDate.value;
    const end = addDays(currentDate.value, 30 - 1);
    if (isSameMonth(start, end)) {
      return "agenda-same-month";
    }
    else {
      return "agenda-different-months";
    }
  }
  return "month";
});

const items: DropdownMenuItem[][] = [
  [
    {
      label: "Month",
      icon: "i-lucide-calendar-days",
      onSelect: () => emit("viewChange", "month"),
    },
    {
      label: "Week",
      icon: "i-lucide-calendar-range",
      onSelect: () => {
        emit("viewChange", "week");
        emit("dateChange", getStableDate());
      },
    },
    {
      label: "Day",
      icon: "i-lucide-calendar-1",
      onSelect: () => emit("viewChange", "day"),
    },
    {
      label: "Agenda",
      icon: "i-lucide-list",
      onSelect: () => emit("viewChange", "agenda"),
    },
  ],
];

const todoSortItems: DropdownMenuItem[][] = [
  TODO_SORT_OPTIONS.map(opt => ({
    label: opt.label,
    onSelect: () => emit("todoSortChange", opt.value),
  })),
];

const todoSortLabel = computed(() =>
  TODO_SORT_OPTIONS.find(o => o.value === (props.todoSortBy ?? "date"))?.label ?? "Date",
);

const todoDueRangeItems: DropdownMenuItem[][] = [
  TODO_DUE_RANGE_OPTIONS.map(opt => ({
    label: opt.label,
    onSelect: () => emit("todoDueRangeChange", opt.value),
  })),
];

const todoDueRangeLabel = computed(() =>
  TODO_DUE_RANGE_OPTIONS.find(o => o.value === (props.todoDueRange ?? "all"))?.label ?? "All",
);

function handlePrevious() {
  emit("previous");
}

function handleNext() {
  emit("next");
}

function handleToday() {
  emit("today");
}
</script>

<template>
  <div :class="className">
    <!-- Mobile Header -->
    <div
      v-if="!isDesktop && showNavigation"
      class="flex items-center justify-between gap-2 px-2 py-1.5"
    >
      <UButton
        color="primary"
        size="sm"
        @click="handleToday"
      >
        Today
      </UButton>

      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Previous"
        @click="handlePrevious"
      />

      <h2 class="font-semibold text-base text-highlighted text-center flex-1 min-w-0 truncate">
        <NuxtTime
          v-if="viewTitle === 'month'"
          :datetime="currentDate"
          month="long"
          year="numeric"
        />
        <NuxtTime
          v-else-if="viewTitle === 'week-same-month'"
          :datetime="startOfWeek(currentDate, { weekStartsOn: 0 })"
          month="long"
          year="numeric"
        />
        <span v-else-if="viewTitle === 'week-different-months'">
          <NuxtTime
            :datetime="startOfWeek(currentDate, { weekStartsOn: 0 })"
            month="short"
          /> -
          <NuxtTime
            :datetime="endOfWeek(currentDate, { weekStartsOn: 0 })"
            month="short"
            year="numeric"
          />
        </span>
        <NuxtTime
          v-else-if="viewTitle === 'day'"
          :datetime="currentDate"
          month="long"
          day="numeric"
          year="numeric"
        />
        <NuxtTime
          v-else-if="viewTitle === 'agenda-same-month'"
          :datetime="currentDate"
          month="long"
          year="numeric"
        />
        <span v-else-if="viewTitle === 'agenda-different-months'">
          <NuxtTime
            :datetime="currentDate"
            month="short"
          /> -
          <NuxtTime
            :datetime="addDays(currentDate, 30 - 1)"
            month="short"
            year="numeric"
          />
        </span>
        <NuxtTime
          v-else
          :datetime="currentDate"
          month="long"
          year="numeric"
        />
      </h2>

      <UButton
        icon="i-lucide-chevron-right"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Next"
        @click="handleNext"
      />

      <div class="flex items-center gap-1">
        <UPopover
          v-if="showUserFilter && users && users.length > 0"
          :popper="{ placement: 'bottom-end' }"
        >
          <UButton
            icon="i-lucide-users"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Filter by user"
            :class="selectedUsers.length > 0 ? 'text-primary' : ''"
          />
          <template #content>
            <div class="p-3 flex flex-col gap-2 min-w-48">
              <button
                v-for="user in users"
                :key="user.id"
                type="button"
                class="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-medium transition-all"
                :class="isUserSelected(user.id)
                  ? 'opacity-100 bg-elevated'
                  : 'opacity-50 hover:opacity-80'"
                :aria-label="`Filter by ${user.name}`"
                :aria-pressed="isUserSelected(user.id)"
                @click="toggleUserFilter(user.id)"
              >
                <UAvatar
                  :src="user.avatar || undefined"
                  :alt="user.name"
                  size="xs"
                  :style="{ backgroundColor: user.color || '#22d3ee' }"
                />
                <span>{{ user.name }}</span>
              </button>
              <button
                v-if="selectedUsers.length > 0"
                type="button"
                class="text-xs text-muted hover:text-highlighted underline mt-1"
                aria-label="Clear user filter"
                @click="clearUserFilter"
              >
                Clear filter
              </button>
            </div>
          </template>
        </UPopover>

        <UDropdownMenu
          v-if="showViewSelector"
          :items="items"
        >
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            trailing-icon="i-lucide-chevron-down"
          >
            <span class="capitalize">{{ view }}</span>
          </UButton>
        </UDropdownMenu>
      </div>
    </div>

    <!-- Todo sort/filter controls (shown on both layouts) -->
    <div
      v-if="showTodoSortSelector || showTodoFilterSelector"
      class="flex flex-wrap items-center justify-end gap-2 px-2 py-1.5"
    >
      <UDropdownMenu
        v-if="showTodoSortSelector"
        :items="todoSortItems"
      >
        <UButton
          color="neutral"
          variant="outline"
          size="xl"
          icon="i-lucide-arrow-down-wide-narrow"
          trailing-icon="i-lucide-chevron-down"
          :aria-label="`Sort todos by ${todoSortLabel}`"
        >
          Sort: {{ todoSortLabel }}
        </UButton>
      </UDropdownMenu>
      <UDropdownMenu
        v-if="showTodoFilterSelector"
        :items="todoDueRangeItems"
      >
        <UButton
          color="neutral"
          variant="outline"
          size="xl"
          icon="i-lucide-filter"
          trailing-icon="i-lucide-chevron-down"
          :aria-label="`Filter todos by due date: ${todoDueRangeLabel}`"
        >
          Due: {{ todoDueRangeLabel }}
        </UButton>
      </UDropdownMenu>
    </div>

    <!-- Desktop Header -->
    <div
      v-if="isDesktop"
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
    >
      <div class="flex sm:flex-col max-sm:items-center justify-between gap-1.5">
        <div class="flex items-center gap-3">
          <h1 class="font-bold text-5xl text-highlighted">
            <NuxtTime
              :datetime="now"
              hour="numeric"
              minute="2-digit"
              :hour12="true"
            />
          </h1>
          <!-- Weather Display -->
          <WeatherDisplay />
        </div>
        <div class="text-base text-muted">
          <NuxtTime
            :datetime="now"
            weekday="long"
            month="long"
            day="numeric"
          />
        </div>
      </div>

      <div
        v-if="showNavigation"
        class="flex items-center justify-center flex-1"
      >
        <h2 class="font-semibold text-2xl text-highlighted">
          <NuxtTime
            v-if="viewTitle === 'month'"
            :datetime="currentDate"
            month="long"
            year="numeric"
          />
          <NuxtTime
            v-else-if="viewTitle === 'week-same-month'"
            :datetime="startOfWeek(currentDate, { weekStartsOn: 0 })"
            month="long"
            year="numeric"
          />
          <span v-else-if="viewTitle === 'week-different-months'">
            <NuxtTime
              :datetime="startOfWeek(currentDate, { weekStartsOn: 0 })"
              month="short"
            /> -
            <NuxtTime
              :datetime="endOfWeek(currentDate, { weekStartsOn: 0 })"
              month="short"
              year="numeric"
            />
          </span>
          <NuxtTime
            v-else-if="viewTitle === 'day'"
            :datetime="currentDate"
            month="long"
            day="numeric"
            year="numeric"
          />
          <NuxtTime
            v-else-if="viewTitle === 'agenda-same-month'"
            :datetime="currentDate"
            month="long"
            year="numeric"
          />
          <span v-else-if="viewTitle === 'agenda-different-months'">
            <NuxtTime
              :datetime="currentDate"
              month="short"
            /> -
            <NuxtTime
              :datetime="addDays(currentDate, 30 - 1)"
              month="short"
              year="numeric"
            />
          </span>
          <NuxtTime
            v-else
            :datetime="currentDate"
            month="long"
            year="numeric"
          />
        </h2>
      </div>

      <!-- User Filter Badges -->
      <div
        v-if="showUserFilter && users && users.length > 0"
        class="flex items-center gap-2 mt-2 sm:mt-0"
      >
        <div class="flex items-center gap-1 flex-wrap">
          <button
            v-for="user in users"
            :key="user.id"
            type="button"
            class="flex items-center gap-1.5 px-2 py-1 rounded-full text-sm font-medium transition-all border-2"
            :class="isUserSelected(user.id)
              ? 'opacity-100 shadow-sm'
              : 'opacity-40 hover:opacity-70'"
            :style="{
              backgroundColor: isUserSelected(user.id) ? `${user.color || '#22d3ee'}20` : 'transparent',
              borderColor: user.color || '#22d3ee',
              color: user.color || '#22d3ee',
            }"
            :aria-label="`Filter by ${user.name}`"
            :aria-pressed="isUserSelected(user.id)"
            @click="toggleUserFilter(user.id)"
          >
            <UAvatar
              :src="user.avatar || undefined"
              :alt="user.name"
              size="xs"
              :style="{ backgroundColor: user.color || '#22d3ee' }"
            />
            <span>{{ user.name }}</span>
          </button>
          <button
            v-if="selectedUsers.length > 0"
            type="button"
            class="text-xs text-muted hover:text-highlighted underline ml-1"
            aria-label="Clear user filter"
            @click="clearUserFilter"
          >
            Clear
          </button>
        </div>
      </div>

      <div
        v-if="showNavigation"
        class="flex items-center justify-between gap-2"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center sm:gap-2 max-sm:order-1">
            <UButton
              icon="i-lucide-chevron-left"
              color="neutral"
              variant="ghost"
              size="xl"
              aria-label="Previous"
              @click="handlePrevious"
            />
            <UButton
              icon="i-lucide-chevron-right"
              color="neutral"
              variant="ghost"
              size="xl"
              aria-label="Next"
              @click="handleNext"
            />
          </div>
          <UButton
            color="primary"
            size="xl"
            @click="handleToday"
          >
            Today
          </UButton>
        </div>
        <div
          v-if="showViewSelector"
          class="flex items-center justify-between gap-2"
        >
          <UDropdownMenu :items="items">
            <UButton
              color="neutral"
              variant="outline"
              size="xl"
              trailing-icon="i-lucide-chevron-down"
            >
              <span class="capitalize">{{ view }}</span>
            </UButton>
          </UDropdownMenu>
        </div>
        <div
          v-if="showExport"
          class="flex items-center"
        >
          <UButton
            icon="i-lucide-download"
            color="neutral"
            variant="ghost"
            size="xl"
            aria-label="Export calendar to ICS"
            :loading="isExporting"
            @click="handleExport"
          />
        </div>
      </div>
    </div>
  </div>
</template>
