<script setup lang="ts">
defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const route = useRoute();

const moreLinks = [
  { label: "Rewards", to: "/rewards", icon: "i-lucide-gift" },
  { label: "To-Do Lists", to: "/toDoLists", icon: "i-lucide-check-square" },
  { label: "Settings", to: "/settings", icon: "i-lucide-settings" },
];

function isActivePath(path: string) {
  return route.path === path;
}

function handleNavigate() {
  emit("close");
}
</script>

<template>
  <Teleport to="body">
    <Transition name="more-sheet">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[90]"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/40"
          @click="emit('close')"
        />

        <!-- Sheet -->
        <div class="absolute bottom-0 left-0 right-0 bg-default rounded-t-2xl border-t border-default pb-safe">
          <!-- Drag handle -->
          <div class="flex justify-center pt-3 pb-2">
            <div class="w-10 h-1 rounded-full bg-muted" />
          </div>

          <!-- Navigation links -->
          <nav class="px-4 pb-4">
            <NuxtLink
              v-for="link in moreLinks"
              :key="link.to"
              :to="link.to"
              class="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
              :class="isActivePath(link.to) ? 'text-primary bg-primary/10' : 'text-default hover:bg-muted'"
              @click="handleNavigate"
            >
              <UIcon
                :name="link.icon"
                class="w-5 h-5"
              />
              <span class="text-sm font-medium">{{ link.label }}</span>
            </NuxtLink>
          </nav>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.more-sheet-enter-active,
.more-sheet-leave-active {
  transition: opacity 0.2s ease;
}

.more-sheet-enter-active > div:last-child,
.more-sheet-leave-active > div:last-child {
  transition: transform 0.2s ease;
}

.more-sheet-enter-from,
.more-sheet-leave-to {
  opacity: 0;
}

.more-sheet-enter-from > div:last-child,
.more-sheet-leave-to > div:last-child {
  transform: translateY(100%);
}
</style>
