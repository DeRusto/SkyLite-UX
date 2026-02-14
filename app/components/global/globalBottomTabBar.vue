<script setup lang="ts">
const route = useRoute();
const isMoreSheetOpen = ref(false);

function isActivePath(path: string) {
  return route.path === path;
}

function isListsActive() {
  return route.path === "/lists" || route.path === "/toDoLists" || route.path === "/shoppingLists";
}

function isMoreActive() {
  return route.path === "/rewards" || route.path === "/settings" || route.path === "/toDoLists";
}

const tabs = [
  { label: "Calendar", to: "/calendar", icon: "i-lucide-calendar-days" },
  { label: "Chores", to: "/chores", icon: "i-lucide-clipboard-list" },
  { label: "Lists", to: "/lists", icon: "i-lucide-list" },
  { label: "Meals", to: "/mealplanner", icon: "i-lucide-utensils" },
];

function getTabActive(tab: { label: string; to: string }) {
  if (tab.label === "Lists") {
    return isListsActive();
  }
  return isActivePath(tab.to);
}
</script>

<template>
  <nav class="fixed bottom-0 left-0 right-0 z-50 bg-default border-t border-default pb-safe">
    <div class="flex items-center h-14">
      <!-- Regular tabs -->
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
        :class="getTabActive(tab) ? 'text-primary' : 'text-muted'"
        :aria-label="tab.label"
      >
        <UIcon
          :name="tab.icon"
          class="w-5 h-5"
        />
        <span class="text-[10px] font-medium">{{ tab.label }}</span>
      </NuxtLink>

      <!-- More button -->
      <button
        type="button"
        class="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
        :class="isMoreActive() ? 'text-primary' : 'text-muted'"
        aria-label="More"
        @click="isMoreSheetOpen = true"
      >
        <UIcon
          name="i-lucide-ellipsis"
          class="w-5 h-5"
        />
        <span class="text-[10px] font-medium">More</span>
      </button>
    </div>

    <!-- More sheet -->
    <GlobalMoreSheet
      :is-open="isMoreSheetOpen"
      @close="isMoreSheetOpen = false"
    />
  </nav>
</template>
