# Responsive Calendar UI — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make SkyLite-UX fully responsive with a mobile-first calendar experience (bottom tab bar, swipe gestures, view persistence) while preserving the existing desktop/wall-mounted layout unchanged.

**Architecture:** Three layout tiers (phone < 640px, tablet 640-1024px, desktop 1024px+). Desktop keeps letterbox + sidebar. Phone/tablet get full-screen layout + bottom tab bar. Calendar views adapt per breakpoint. Touch swipe replaces arrow navigation on mobile.

**Tech Stack:** Nuxt 4, Vue 3, Tailwind CSS, Nuxt UI v3, date-fns, localStorage

**Design doc:** `docs/plans/2026-02-14-responsive-calendar-design.md`

---

## Task 1: Conditional Letterbox in app.vue

**Files:**
- Modify: `app/app.vue`

**Context:** Currently the letterbox is always-on via CSS classes `.app-letterbox` and `.app-container-16-9`. We need it only at `lg+` (1024px+). Below that, the app fills the full screen.

**Step 1: Add a `useIsMobile` composable for reactive screen size**

Create `app/composables/useBreakpoint.ts`:

```typescript
export function useBreakpoint() {
  const isDesktop = ref(true);

  if (import.meta.client) {
    const query = window.matchMedia("(min-width: 1024px)");
    isDesktop.value = query.matches;

    const handler = (e: MediaQueryListEvent) => {
      isDesktop.value = e.matches;
    };
    query.addEventListener("change", handler);

    onScopeDispose(() => {
      query.removeEventListener("change", handler);
    });
  }

  const isMobile = computed(() => !isDesktop.value);

  return { isDesktop, isMobile };
}
```

**Step 2: Update app.vue to conditionally apply letterbox**

Replace the static letterbox classes with conditional classes:

```vue
<script setup lang="ts">
import GlobalAppLoading from "~/components/global/globalAppLoading.vue";
import GlobalDock from "~/components/global/globalDock.vue";

const dock = false;
const { isLoading, loadingMessage, setLoading } = useGlobalLoading();
const { isDesktop } = useBreakpoint();

setLoading(true);

onNuxtReady(() => {
  setLoading(false);
});
</script>

<template>
  <UApp>
    <div :class="isDesktop ? 'app-letterbox' : 'app-fullscreen'">
      <div :class="isDesktop ? 'app-container-16-9' : 'app-container-full'">
        <GlobalAppLoading :is-loading="isLoading" :loading-message="loadingMessage || ''" />

        <NuxtLayout>
          <div v-if="dock" class="flex h-full">
            <div class="flex flex-col flex-1">
              <div class="flex-1">
                <NuxtPage />
              </div>
              <GlobalDock />
            </div>
          </div>
          <NuxtPage v-else />
        </NuxtLayout>
      </div>
    </div>
  </UApp>
</template>
```

Add new CSS classes:

```css
/* Full-screen container for mobile/tablet */
.app-fullscreen {
  position: fixed;
  inset: 0;
  overflow: hidden;
}

.app-container-full {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: var(--ui-bg-default, #ffffff);
  overflow: hidden;
}

.dark .app-container-full {
  background-color: var(--ui-bg-default, #141f38);
}
```

**Step 3: Run type-check**

Run: `npm run type-check`
Expected: PASS

**Step 4: Run lint**

Run: `npm run lint`
Expected: PASS (fix any auto-fixable issues)

**Step 5: Commit**

```bash
git add app/composables/useBreakpoint.ts app/app.vue
git commit -m "feat: conditional letterbox — full-screen on mobile/tablet, 16:9 on desktop"
```

---

## Task 2: Bottom Tab Bar Component

**Files:**
- Create: `app/components/global/globalBottomTabBar.vue`
- Create: `app/components/global/globalMoreSheet.vue`

**Context:** The sidebar (`globalSideBar.vue`) has 6 links: Calendar, Chores, Rewards, Lists, Meals, Settings. On `< lg` screens, we replace it with a bottom tab bar showing 5 tabs: Calendar, Chores, Lists, Meals, More. "More" opens a sheet with Rewards, Settings, and To-Do Lists. Screensaver is excluded on mobile.

**Step 1: Create globalMoreSheet.vue**

```vue
<script setup lang="ts">
const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const route = useRoute();

function isActivePath(path: string) {
  return route.path === path;
}

function navigate() {
  emit("close");
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[90]"
        @click="emit('close')"
      >
        <div class="absolute inset-0 bg-black/40" />
        <div
          class="absolute bottom-0 left-0 right-0 bg-default rounded-t-2xl border-t border-default pb-safe"
          @click.stop
        >
          <div class="flex justify-center pt-2 pb-1">
            <div class="w-10 h-1 rounded-full bg-muted" />
          </div>
          <nav class="px-4 pb-4 pt-2 space-y-1">
            <NuxtLink
              to="/rewards"
              class="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
              :class="isActivePath('/rewards') ? 'text-primary bg-primary/10' : 'text-muted hover:text-highlighted hover:bg-muted/50'"
              @click="navigate"
            >
              <UIcon name="i-lucide-gift" class="w-5 h-5" />
              <span class="text-sm font-medium">Rewards</span>
            </NuxtLink>
            <NuxtLink
              to="/toDoLists"
              class="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
              :class="isActivePath('/toDoLists') ? 'text-primary bg-primary/10' : 'text-muted hover:text-highlighted hover:bg-muted/50'"
              @click="navigate"
            >
              <UIcon name="i-lucide-check-square" class="w-5 h-5" />
              <span class="text-sm font-medium">To-Do Lists</span>
            </NuxtLink>
            <NuxtLink
              to="/settings"
              class="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
              :class="isActivePath('/settings') ? 'text-primary bg-primary/10' : 'text-muted hover:text-highlighted hover:bg-muted/50'"
              @click="navigate"
            >
              <UIcon name="i-lucide-settings" class="w-5 h-5" />
              <span class="text-sm font-medium">Settings</span>
            </NuxtLink>
          </nav>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-enter-active,
.sheet-leave-active {
  transition: all 0.3s ease;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from > div:last-child,
.sheet-leave-to > div:last-child {
  transform: translateY(100%);
}
</style>
```

**Step 2: Create globalBottomTabBar.vue**

```vue
<script setup lang="ts">
const route = useRoute();
const moreSheetOpen = ref(false);

function isActivePath(path: string) {
  return route.path === path;
}

function isListsActive() {
  return route.path === "/lists" || route.path === "/toDoLists" || route.path === "/shoppingLists";
}

function isMoreActive() {
  return route.path === "/rewards" || route.path === "/settings" || route.path === "/toDoLists";
}
</script>

<template>
  <nav class="fixed bottom-0 left-0 right-0 z-50 bg-default border-t border-default pb-safe">
    <div class="flex items-center justify-around h-14">
      <NuxtLink
        to="/calendar"
        class="flex flex-col items-center justify-center gap-0.5 flex-1 py-1"
        :class="isActivePath('/calendar') ? 'text-primary' : 'text-muted'"
      >
        <UIcon name="i-lucide-calendar-days" class="w-5 h-5" />
        <span class="text-[10px] font-medium">Calendar</span>
      </NuxtLink>
      <NuxtLink
        to="/chores"
        class="flex flex-col items-center justify-center gap-0.5 flex-1 py-1"
        :class="isActivePath('/chores') ? 'text-primary' : 'text-muted'"
      >
        <UIcon name="i-lucide-clipboard-list" class="w-5 h-5" />
        <span class="text-[10px] font-medium">Chores</span>
      </NuxtLink>
      <NuxtLink
        to="/lists"
        class="flex flex-col items-center justify-center gap-0.5 flex-1 py-1"
        :class="isListsActive() ? 'text-primary' : 'text-muted'"
      >
        <UIcon name="i-lucide-list" class="w-5 h-5" />
        <span class="text-[10px] font-medium">Lists</span>
      </NuxtLink>
      <NuxtLink
        to="/mealplanner"
        class="flex flex-col items-center justify-center gap-0.5 flex-1 py-1"
        :class="isActivePath('/mealplanner') ? 'text-primary' : 'text-muted'"
      >
        <UIcon name="i-lucide-utensils" class="w-5 h-5" />
        <span class="text-[10px] font-medium">Meals</span>
      </NuxtLink>
      <button
        type="button"
        class="flex flex-col items-center justify-center gap-0.5 flex-1 py-1"
        :class="isMoreActive() ? 'text-primary' : 'text-muted'"
        @click="moreSheetOpen = true"
      >
        <UIcon name="i-lucide-ellipsis" class="w-5 h-5" />
        <span class="text-[10px] font-medium">More</span>
      </button>
    </div>
  </nav>
  <GlobalMoreSheet :is-open="moreSheetOpen" @close="moreSheetOpen = false" />
</template>
```

**Step 3: Run type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: PASS

**Step 4: Commit**

```bash
git add app/components/global/globalBottomTabBar.vue app/components/global/globalMoreSheet.vue
git commit -m "feat: add bottom tab bar and more sheet for mobile navigation"
```

---

## Task 3: Responsive Layout in default.vue

**Files:**
- Modify: `app/layouts/default.vue`
- Modify: `app/components/global/globalSideBar.vue`

**Context:** `default.vue` currently always renders the sidebar. We need to conditionally show sidebar on `lg+` and bottom tab bar on `< lg`. The sidebar itself should be hidden on mobile (handled by the layout, not the sidebar component).

**Step 1: Update default.vue**

```vue
<script setup lang="ts">
import GlobalSideBar from "~/components/global/globalSideBar.vue";
import GlobalBottomTabBar from "~/components/global/globalBottomTabBar.vue";

const { isDesktop } = useBreakpoint();
</script>

<template>
  <div class="flex h-full">
    <GlobalSideBar v-if="isDesktop" />
    <div class="flex flex-col flex-1 overflow-hidden">
      <div class="flex-1 overflow-auto" :class="{ 'pb-20': !isDesktop }">
        <slot />
      </div>
    </div>
    <GlobalBottomTabBar v-if="!isDesktop" />
  </div>
</template>
```

The `pb-20` (80px) on the content area prevents content from being hidden behind the bottom tab bar.

**Step 2: Run type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: PASS

**Step 3: Commit**

```bash
git add app/layouts/default.vue
git commit -m "feat: responsive layout — sidebar on desktop, bottom tab bar on mobile"
```

---

## Task 4: View Persistence via localStorage

**Files:**
- Modify: `app/components/calendar/calendarMainView.vue`
- Modify: `app/pages/calendar.vue`

**Context:** `calendarMainView.vue` line 30 currently hard-codes `const view = ref<CalendarView>(props.initialView || "week")`. We need to read from localStorage, falling back to a screen-size-based default. Save on every view change.

**Step 1: Add view persistence logic to calendarMainView.vue**

In the `<script setup>`, replace the view initialization:

```typescript
// Replace line 30:
// const view = ref<CalendarView>(props.initialView || "week");

// With:
const STORAGE_KEY = "skylite-calendar-view";
const validViews: CalendarView[] = ["month", "week", "day", "agenda"];

function getDefaultView(): CalendarView {
  // Check localStorage first
  if (import.meta.client) {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && validViews.includes(saved as CalendarView)) {
      return saved as CalendarView;
    }
  }
  // Screen-size based default
  if (import.meta.client && window.innerWidth < 640) {
    return "agenda";
  }
  return "month";
}

const view = ref<CalendarView>(getDefaultView());

// Persist on change
watch(view, (newView) => {
  if (import.meta.client) {
    localStorage.setItem(STORAGE_KEY, newView);
  }
});
```

**Step 2: Update calendar.vue to remove hard-coded initial-view**

In `app/pages/calendar.vue` line 209, change:

```vue
<!-- From: -->
initial-view="week"

<!-- To: remove the prop entirely (calendarMainView handles its own default now) -->
```

Remove the `initialView` prop from the template.

**Step 3: Run type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: PASS

**Step 4: Commit**

```bash
git add app/components/calendar/calendarMainView.vue app/pages/calendar.vue
git commit -m "feat: persist calendar view in localStorage with screen-size default"
```

---

## Task 5: Responsive Date Header

**Files:**
- Modify: `app/components/global/globalDateHeader.vue`

**Context:** The current header has: time display, weather, date, nav arrows, today button, view selector, export button, user filter badges. On `< lg`, we need a compact single row: today button (left), date label (center), view selector + filter icon (right). Hide arrows, time, weather, and export on mobile.

**Step 1: Update globalDateHeader.vue template**

Add breakpoint composable and restructure the template:

```typescript
// Add at top of script setup:
const { isDesktop } = useBreakpoint();
```

Wrap the desktop-only elements with `v-if="isDesktop"`:

- Time/weather section (lines 174-194): wrap in `<div v-if="isDesktop">`
- Nav arrows (lines 256-273): wrap in `<template v-if="isDesktop">`
- Export button (lines 294-305): wrap in `<div v-if="isDesktop">`
- User filter badges full section (lines 308-345): on mobile, replace with a compact filter icon button

Add mobile header layout:

```vue
<!-- Mobile compact header (< lg) -->
<div v-if="!isDesktop && showNavigation" class="flex items-center justify-between px-3 py-2">
  <UButton
    color="primary"
    size="sm"
    @click="handleToday"
  >
    Today
  </UButton>

  <h2 class="font-semibold text-base text-highlighted text-center flex-1 mx-2">
    <!-- Same NuxtTime content from viewTitle computed, but smaller -->
    <NuxtTime
      v-if="viewTitle === 'month'"
      :datetime="currentDate"
      month="long"
      year="numeric"
    />
    <NuxtTime
      v-else-if="viewTitle === 'day'"
      :datetime="currentDate"
      month="short"
      day="numeric"
    />
    <NuxtTime
      v-else-if="viewTitle === 'week-same-month'"
      :datetime="startOfWeek(currentDate, { weekStartsOn: 0 })"
      month="long"
    />
    <span v-else-if="viewTitle === 'week-different-months'">
      <NuxtTime
        :datetime="startOfWeek(currentDate, { weekStartsOn: 0 })"
        month="short"
      /> -
      <NuxtTime
        :datetime="endOfWeek(currentDate, { weekStartsOn: 0 })"
        month="short"
      />
    </span>
    <NuxtTime
      v-else
      :datetime="currentDate"
      month="long"
      year="numeric"
    />
  </h2>

  <div class="flex items-center gap-1">
    <UDropdownMenu :items="items">
      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        trailing-icon="i-lucide-chevron-down"
      >
        <span class="capitalize">{{ view }}</span>
      </UButton>
    </UDropdownMenu>
    <UPopover v-if="showUserFilter && users && users.length > 0">
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-lucide-users"
        :class="{ 'text-primary': selectedUsers.length > 0 }"
      />
      <template #content>
        <div class="p-3 space-y-2">
          <button
            v-for="user in users"
            :key="user.id"
            type="button"
            class="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg transition-colors"
            :class="isUserSelected(user.id) ? 'bg-primary/10' : 'hover:bg-muted/50'"
            @click="toggleUserFilter(user.id)"
          >
            <UAvatar :src="user.avatar || undefined" :alt="user.name" size="xs" />
            <span class="text-sm">{{ user.name }}</span>
          </button>
          <button
            v-if="selectedUsers.length > 0"
            type="button"
            class="text-xs text-muted hover:text-highlighted underline w-full text-center pt-1"
            @click="clearUserFilter"
          >
            Clear filter
          </button>
        </div>
      </template>
    </UPopover>
  </div>
</div>
```

Wrap the existing desktop header in `<template v-if="isDesktop">`.

**Step 2: Run type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: PASS

**Step 3: Commit**

```bash
git add app/components/global/globalDateHeader.vue
git commit -m "feat: compact mobile date header with filter popover"
```

---

## Task 6: Swipe Gestures on Calendar Content

**Files:**
- Modify: `app/components/calendar/calendarMainView.vue`

**Context:** On `< lg` screens, the arrow buttons are hidden. We add horizontal swipe detection on the calendar content area to trigger previous/next navigation. Minimum 50px horizontal threshold. No swipe when the event dialog is open.

**Step 1: Add a `useSwipe` composable**

Create `app/composables/useSwipe.ts`:

```typescript
type SwipeCallbacks = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
};

export function useSwipe(el: Ref<HTMLElement | null>, callbacks: SwipeCallbacks, options?: { threshold?: number }) {
  const threshold = options?.threshold ?? 50;
  let startX = 0;
  let startY = 0;

  function onTouchStart(e: TouchEvent) {
    const touch = e.touches[0];
    if (touch) {
      startX = touch.clientX;
      startY = touch.clientY;
    }
  }

  function onTouchEnd(e: TouchEvent) {
    const touch = e.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    // Only trigger if horizontal movement exceeds vertical (prevent conflicts with scroll)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) >= threshold) {
      if (deltaX < 0) {
        callbacks.onSwipeLeft?.();
      } else {
        callbacks.onSwipeRight?.();
      }
    }
  }

  onMounted(() => {
    const element = el.value;
    if (element) {
      element.addEventListener("touchstart", onTouchStart, { passive: true });
      element.addEventListener("touchend", onTouchEnd, { passive: true });
    }
  });

  onUnmounted(() => {
    const element = el.value;
    if (element) {
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchend", onTouchEnd);
    }
  });
}
```

**Step 2: Wire swipe into calendarMainView.vue**

```typescript
// Add to script setup:
const { isDesktop } = useBreakpoint();
const calendarContentRef = ref<HTMLElement | null>(null);

useSwipe(calendarContentRef, {
  onSwipeLeft: () => {
    if (!isEventDialogOpen.value && !isDesktop.value) {
      handleNext();
    }
  },
  onSwipeRight: () => {
    if (!isEventDialogOpen.value && !isDesktop.value) {
      handlePrevious();
    }
  },
});
```

Add `ref="calendarContentRef"` to the calendar content `<div>` (currently line 246):

```vue
<div ref="calendarContentRef" class="flex flex-1 flex-col min-h-0">
```

**Step 3: Run type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: PASS

**Step 4: Commit**

```bash
git add app/composables/useSwipe.ts app/components/calendar/calendarMainView.vue
git commit -m "feat: swipe gestures for calendar navigation on mobile"
```

---

## Task 7: Responsive Month View

**Files:**
- Modify: `app/components/global/globalMonthView.vue`

**Context:** Desktop keeps the current 7-column grid unchanged. On `< lg`, show a stacked layout: compact mini month grid at top (colored dots for events), event list for selected day below. Tapping a day selects it and shows its events.

**Step 1: Add mobile state and breakpoint to globalMonthView.vue**

```typescript
// Add to script setup:
const { isDesktop } = useBreakpoint();
const selectedDay = ref<Date>(getStableDate());

const emit = defineEmits<{
  (e: "eventCreate", date: Date): void;
  (e: "eventClick", event: CalendarEvent, mouseEvent: MouseEvent): void;
  (e: "dateSelect", date: Date): void;  // NEW
}>();

function selectDay(day: Date) {
  selectedDay.value = day;
}

const selectedDayEvents = computed(() => {
  return getEventsForDay(selectedDay.value);
});

function hasEventsOnDay(day: Date): boolean {
  return getEventsForDay(day).length > 0;
}
```

**Step 2: Add mobile template alongside existing desktop template**

Wrap the existing template content in `<template v-if="isDesktop">`. Add a new mobile template:

```vue
<!-- Mobile: Stacked mini-month + event list -->
<div v-if="!isDesktop" class="flex flex-col h-full">
  <!-- Mini month grid -->
  <div class="px-3 pt-3 pb-2">
    <div class="grid grid-cols-7 gap-1 mb-1">
      <div
        v-for="day in ['S', 'M', 'T', 'W', 'T', 'F', 'S']"
        :key="day"
        class="text-center text-[10px] font-medium text-muted py-1"
      >
        {{ day }}
      </div>
    </div>
    <div class="grid grid-cols-7 gap-1">
      <button
        v-for="week in weeks"
        v-bind="{ key: undefined }"
        :key="'mobile-week'"
      />
      <template v-for="(week, weekIndex) in weeks" :key="weekIndex">
        <button
          v-for="day in week"
          :key="day.toString()"
          type="button"
          class="aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-colors relative"
          :class="{
            'bg-primary text-white font-semibold': isToday(day) && format(selectedDay, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'),
            'bg-primary/20 text-primary font-semibold': format(selectedDay, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') && !isToday(day),
            'text-info font-medium': isToday(day) && format(selectedDay, 'yyyy-MM-dd') !== format(day, 'yyyy-MM-dd'),
            'text-highlighted': !isToday(day) && isCurrentMonth,
            'text-dimmed': !isCurrentMonth,
          }"
          @click="selectDay(day)"
        >
          <NuxtTime :datetime="day" day="numeric" />
          <div
            v-if="hasEventsOnDay(day)"
            class="absolute bottom-0.5 w-1 h-1 rounded-full bg-primary"
          />
        </button>
      </template>
    </div>
  </div>

  <!-- Selected day header -->
  <div class="px-4 py-2 border-t border-default">
    <h3 class="text-sm font-semibold text-highlighted">
      <NuxtTime :datetime="selectedDay" weekday="long" month="long" day="numeric" />
    </h3>
  </div>

  <!-- Event list for selected day -->
  <div class="flex-1 overflow-y-auto px-4 pb-4">
    <div v-if="selectedDayEvents.length === 0" class="flex flex-col items-center justify-center py-12 text-muted">
      <UIcon name="i-lucide-calendar-off" class="w-8 h-8 mb-2" />
      <span class="text-sm">No events</span>
    </div>
    <div v-else class="space-y-2">
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
```

Note: Remove the duplicate `v-for` loop issue above — the template should iterate `weeks` then `week`:

```vue
<template v-for="(week, weekIndex) in weeks" :key="weekIndex">
  <button v-for="day in week" :key="day.toString()" ...>
```

**Step 3: Run type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: PASS

**Step 4: Commit**

```bash
git add app/components/global/globalMonthView.vue
git commit -m "feat: stacked mini-month + event list for mobile month view"
```

---

## Task 8: Responsive Week View

**Files:**
- Modify: `app/components/global/globalWeekView.vue`

**Context:** Desktop: current 4-column grid unchanged. Tablet (`sm` to `lg`): show current week as scrollable columns. Phone (`< sm`): single day shown with date chip row at top for switching days.

**Step 1: Add breakpoint and selected day state**

```typescript
// Add to script setup:
const { isDesktop } = useBreakpoint();
const isPhone = computed(() => import.meta.client && window.innerWidth < 640);
const selectedDayIndex = ref(0); // Index into weekDays

const selectedWeekDay = computed(() => weekDays.value[selectedDayIndex.value] || weekDays.value[0]);
```

**Step 2: Add mobile template**

Wrap existing template in `<template v-if="isDesktop">`. Add:

```vue
<!-- Phone: day carousel with date chips -->
<div v-else-if="isPhone" class="flex flex-col h-full">
  <!-- Date chips row -->
  <div class="flex gap-1 px-2 py-2 border-b border-default overflow-x-auto">
    <button
      v-for="(day, index) in weekDays"
      :key="day.toISOString()"
      type="button"
      class="flex flex-col items-center px-3 py-1.5 rounded-xl text-xs font-medium transition-colors flex-shrink-0"
      :class="{
        'bg-primary text-white': index === selectedDayIndex,
        'text-muted hover:bg-muted/50': index !== selectedDayIndex,
        'ring-2 ring-info': isToday(day) && index !== selectedDayIndex,
      }"
      @click="selectedDayIndex = index"
    >
      <NuxtTime :datetime="day" weekday="short" />
      <NuxtTime :datetime="day" day="numeric" />
    </button>
  </div>

  <!-- Single day events -->
  <div class="flex-1 overflow-y-auto px-4 py-2">
    <div
      v-if="getAllEventsForDay(events, selectedWeekDay).length === 0"
      class="flex flex-col items-center justify-center py-12 text-muted"
    >
      <UIcon name="i-lucide-calendar-off" class="w-8 h-8 mb-2" />
      <span class="text-sm">{{ isToday(selectedWeekDay) ? 'No events today' : 'No events' }}</span>
    </div>
    <div v-else class="space-y-2">
      <CalendarEventItem
        v-for="event in getAllEventsForDay(events, selectedWeekDay)"
        :key="event.id"
        :event="event"
        view="agenda"
        :current-day="selectedWeekDay"
        @click="(e) => handleEventClick(event, e)"
      />
    </div>
  </div>
</div>

<!-- Tablet: 3-4 day columns -->
<div v-else class="w-full">
  <div class="grid grid-cols-3 sm:grid-cols-4 border border-default">
    <div
      v-for="day in weekDays.slice(0, 4)"
      :key="day.toISOString()"
      class="border-r border-default last:border-r-0 flex flex-col"
      style="height: 300px;"
      :class="{
        'bg-info/10': isToday(day),
        'bg-muted/25': !isToday(day),
      }"
    >
      <div class="flex items-center justify-between p-2 border-b border-default flex-shrink-0">
        <div class="text-xs font-medium text-muted">
          <NuxtTime :datetime="day" weekday="short" />
        </div>
        <div
          class="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
          :class="{
            'bg-primary text-white': isToday(day),
            'text-muted': !isToday(day),
          }"
        >
          <NuxtTime :datetime="day" day="numeric" />
        </div>
      </div>
      <div class="overflow-y-auto px-1 py-1 space-y-1 flex-1">
        <CalendarEventItem
          v-for="event in getAllEventsForDay(events, day)"
          :key="event.id"
          :event="event"
          view="week"
          :current-day="day"
          @click="(e) => handleEventClick(event, e)"
        />
      </div>
    </div>
  </div>
</div>
```

**Step 3: Run type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: PASS

**Step 4: Commit**

```bash
git add app/components/global/globalWeekView.vue
git commit -m "feat: responsive week view — day carousel on phone, 3-4 cols on tablet"
```

---

## Task 9: Responsive Day View

**Files:**
- Modify: `app/components/global/globalDayView.vue`

**Context:** Desktop: current 40/60 split with mini calendar unchanged. Phone (`< sm`): hide the mini calendar sidebar, show full-width event list only. Tablet: keep the split.

**Step 1: Update globalDayView.vue**

```typescript
// Add to script setup:
const { isDesktop } = useBreakpoint();
const isPhone = computed(() => import.meta.client && window.innerWidth < 640);
```

Update the template to conditionally show the mini calendar:

```vue
<template>
  <div class="flex h-full w-full">
    <!-- Mini calendar sidebar: hidden on phone -->
    <div v-if="!isPhone" class="w-[40%] flex-shrink-0 border-r border-default">
      <!-- existing mini calendar content unchanged -->
    </div>
    <!-- Events panel: full width on phone, 60% on tablet/desktop -->
    <div :class="isPhone ? 'w-full' : 'w-[60%] flex-1'">
      <!-- existing events content unchanged -->
    </div>
  </div>
</template>
```

**Step 2: Run type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: PASS

**Step 3: Commit**

```bash
git add app/components/global/globalDayView.vue
git commit -m "feat: full-width day view on phone, keep mini calendar on tablet/desktop"
```

---

## Task 10: Responsive Agenda View

**Files:**
- Modify: `app/components/global/globalAgendaView.vue`

**Context:** The agenda view is already mostly mobile-friendly. Main changes: tighten spacing on mobile, make sticky day headers more prominent.

**Step 1: Update globalAgendaView.vue**

The existing agenda view uses `px-4` and `my-12` margins. On mobile, reduce spacing:

```vue
<!-- Update the day container (line 59): -->
<div
  v-for="day in days"
  :key="day.toString()"
  :data-date="format(day, 'yyyy-MM-dd')"
  class="border-default relative border-t border-r"
  :class="isDesktop ? 'my-12' : 'my-6'"
>
```

Add `isDesktop` to script:

```typescript
const { isDesktop } = useBreakpoint();
```

Make the day header sticky on mobile:

```vue
<span class="bg-default absolute -top-3 left-0 flex h-6 items-center pe-4 text-[10px] uppercase sm:pe-4 sm:text-xs"
  :class="{ 'sticky top-0 z-10': !isDesktop }"
>
```

**Step 2: Run type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: PASS

**Step 3: Commit**

```bash
git add app/components/global/globalAgendaView.vue
git commit -m "feat: tighter spacing and sticky headers in mobile agenda view"
```

---

## Task 11: Full-Screen Event Dialog on Mobile

**Files:**
- Modify: `app/components/calendar/calendarEventDialog.vue`

**Context:** Desktop: current centered modal unchanged. On `< lg`: full-screen sheet sliding from bottom. Top bar: Cancel (left), title (center), Save (right). Delete button at bottom.

**Step 1: Add breakpoint and update dialog container**

```typescript
// Add to script setup:
const { isDesktop } = useBreakpoint();
```

**Step 2: Update dialog template**

The dialog is currently at lines 1118-1583. Replace the outer container with conditional layout:

For mobile (`!isDesktop`): replace the centered modal with a full-screen bottom sheet:

```vue
<div
  v-if="isOpen"
  class="fixed inset-0 z-[100]"
  :class="isDesktop ? 'flex items-center justify-center bg-black/50' : 'bg-default'"
  @click="isDesktop ? handleClose() : undefined"
>
  <div
    :class="isDesktop
      ? 'w-full max-w-[425px] mx-4 max-h-[90vh] overflow-y-auto bg-default rounded-lg border border-default shadow-lg'
      : 'h-full flex flex-col'"
    @click.stop
  >
    <!-- Mobile top bar -->
    <div v-if="!isDesktop" class="flex items-center justify-between px-4 py-3 border-b border-default flex-shrink-0 safe-area-top">
      <UButton color="neutral" variant="ghost" size="sm" @click="handleClose">
        Cancel
      </UButton>
      <h2 class="text-sm font-semibold">
        {{ event?.id ? 'Edit Event' : 'New Event' }}
      </h2>
      <UButton
        v-if="!isReadOnly"
        color="primary"
        size="sm"
        :loading="isSubmitting"
        :disabled="isSubmitting"
        @click="handleSave"
      >
        Save
      </UButton>
      <span v-else class="w-12" />
    </div>

    <!-- Desktop header (existing) -->
    <div v-if="isDesktop" class="flex items-center justify-between p-4 border-b border-default">
      <!-- existing header content -->
    </div>

    <!-- Form content -->
    <div :class="isDesktop ? 'p-4 space-y-6' : 'flex-1 overflow-y-auto p-4 space-y-6'">
      <!-- existing form fields unchanged -->
    </div>

    <!-- Desktop footer (existing) -->
    <div v-if="isDesktop" class="flex justify-between p-4 border-t border-default">
      <!-- existing footer content -->
    </div>

    <!-- Mobile footer: delete button at bottom -->
    <div v-if="!isDesktop && event?.id && canDelete" class="p-4 border-t border-default flex-shrink-0 pb-safe">
      <UButton
        color="error"
        variant="ghost"
        icon="i-lucide-trash"
        class="w-full"
        :loading="isDeleting"
        :disabled="isDeleting"
        @click="handleDelete"
      >
        Delete Event
      </UButton>
    </div>
  </div>
</div>
```

**Step 3: Run type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: PASS

**Step 4: Commit**

```bash
git add app/components/calendar/calendarEventDialog.vue
git commit -m "feat: full-screen bottom sheet event dialog on mobile"
```

---

## Task 12: Safe Area & Tailwind Config

**Files:**
- Modify: `app/assets/css/main.css`

**Context:** iOS devices need `env(safe-area-inset-bottom)` for the home indicator. We need utility classes for safe area padding.

**Step 1: Add safe area utilities to main.css**

```css
/* Safe area utilities for iOS */
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.safe-area-top {
  padding-top: env(safe-area-inset-top, 0px);
}
```

**Step 2: Ensure viewport meta tag handles safe areas**

Check `nuxt.config.ts` or `app/app.vue` for the viewport meta tag. If not present, add to `nuxt.config.ts`:

```typescript
app: {
  head: {
    meta: [
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }
    ]
  }
}
```

The `viewport-fit=cover` is required for `env(safe-area-inset-*)` to work on iOS.

**Step 3: Run lint**

Run: `npm run lint`
Expected: PASS

**Step 4: Commit**

```bash
git add app/assets/css/main.css nuxt.config.ts
git commit -m "feat: add safe area CSS utilities for iOS home indicator"
```

---

## Task 13: FAB Positioning on Mobile

**Files:**
- Modify: `app/components/global/globalFloatingActionButton.vue`

**Context:** The FAB currently uses `bottom-6 right-6`. On mobile, it needs to be above the bottom tab bar (`bottom-24` to clear 56px tab bar + safe area).

**Step 1: Update FAB positioning**

```typescript
// Add to script setup:
const { isDesktop } = useBreakpoint();
```

Update `positionClasses` computed:

```typescript
const positionClasses = computed(() => {
  const baseClasses = "fixed z-50 rounded-full shadow-lg transition-all duration-200 hover:shadow-xl flex items-center justify-center";
  const bottomOffset = isDesktop.value ? "bottom-6" : "bottom-24";

  switch (props.position) {
    case "bottom-left":
      return `${baseClasses} ${bottomOffset} left-6`;
    case "top-right":
      return `${baseClasses} top-6 right-6`;
    case "top-left":
      return `${baseClasses} top-6 left-6`;
    case "bottom-right":
    default:
      return `${baseClasses} ${bottomOffset} right-6`;
  }
});
```

**Step 2: Run type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: PASS

**Step 3: Commit**

```bash
git add app/components/global/globalFloatingActionButton.vue
git commit -m "feat: position FAB above bottom tab bar on mobile"
```

---

## Task 14: Build Verification

**Step 1: Run full type-check**

Run: `npm run type-check`
Expected: PASS with 0 errors

**Step 2: Run full lint**

Run: `npm run lint`
Expected: PASS

**Step 3: Run build**

Run: `npm run build`
Expected: PASS — successful production build

**Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address build/lint issues from responsive calendar implementation"
```

---

## Task Summary

| Task | Description | Files |
|------|------------|-------|
| 1 | Conditional letterbox | `app.vue`, `useBreakpoint.ts` (new) |
| 2 | Bottom tab bar + More sheet | `globalBottomTabBar.vue` (new), `globalMoreSheet.vue` (new) |
| 3 | Responsive layout | `default.vue` |
| 4 | View persistence | `calendarMainView.vue`, `calendar.vue` |
| 5 | Responsive date header | `globalDateHeader.vue` |
| 6 | Swipe gestures | `useSwipe.ts` (new), `calendarMainView.vue` |
| 7 | Responsive month view | `globalMonthView.vue` |
| 8 | Responsive week view | `globalWeekView.vue` |
| 9 | Responsive day view | `globalDayView.vue` |
| 10 | Responsive agenda view | `globalAgendaView.vue` |
| 11 | Mobile event dialog | `calendarEventDialog.vue` |
| 12 | Safe area CSS | `main.css`, `nuxt.config.ts` |
| 13 | FAB positioning | `globalFloatingActionButton.vue` |
| 14 | Build verification | All files |
