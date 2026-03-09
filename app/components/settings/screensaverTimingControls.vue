<script setup lang="ts">
import type { ScreensaverSettingsData } from "~/types/screensaver";

const props = defineProps<{
  settings: ScreensaverSettingsData;
}>();

const emit = defineEmits<{
  save: [updates: Partial<ScreensaverSettingsData>];
}>();

function handleSave(updates: Partial<ScreensaverSettingsData>) {
  emit("save", updates);
}
</script>

<template>
  <div class="space-y-6">
    <!-- Screensaver Enable/Disable -->
    <div class="flex items-center justify-between">
      <div>
        <p class="font-medium text-highlighted">
          Enable Screensaver
        </p>
        <p class="text-sm text-muted">
          Show a photo slideshow when the display is idle
        </p>
      </div>
      <USwitch
        :model-value="props.settings.enabled"
        color="primary"
        checked-icon="i-lucide-monitor"
        unchecked-icon="i-lucide-monitor-off"
        size="xl"
        aria-label="Toggle screensaver"
        @update:model-value="(val: boolean) => handleSave({ enabled: val })"
      />
    </div>

    <!-- Photo Display Duration -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <label class="block text-sm font-medium text-highlighted">Photo Display Duration</label>
        <span class="text-sm text-muted">{{ props.settings.photoDisplaySeconds }}s</span>
      </div>
      <input
        type="range"
        :value="props.settings.photoDisplaySeconds"
        min="5"
        max="60"
        step="5"
        class="w-full accent-primary"
        @change="(e: Event) => handleSave({ photoDisplaySeconds: Number((e.target as HTMLInputElement).value) })"
      >
      <div class="flex justify-between text-xs text-muted">
        <span>5s</span>
        <span>60s</span>
      </div>
    </div>

    <!-- Idle Timeout -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <label class="block text-sm font-medium text-highlighted">Idle Timeout</label>
        <span class="text-sm text-muted">{{ props.settings.idleTimeoutMinutes }} min</span>
      </div>
      <input
        type="range"
        :value="props.settings.idleTimeoutMinutes"
        min="1"
        max="60"
        step="1"
        class="w-full accent-primary"
        @change="(e: Event) => handleSave({ idleTimeoutMinutes: Number((e.target as HTMLInputElement).value) })"
      >
      <div class="flex justify-between text-xs text-muted">
        <span>1 min</span>
        <span>60 min</span>
      </div>
    </div>

    <!-- Transition Effect -->
    <div class="space-y-2">
      <label class="block text-sm font-medium text-highlighted">Transition Effect</label>
      <USelect
        :model-value="props.settings.transitionEffect"
        :items="[
          { label: 'Fade', value: 'FADE' },
          { label: 'Slide', value: 'SLIDE' },
          { label: 'Zoom', value: 'ZOOM' },
          { label: 'None', value: 'NONE' },
        ]"
        class="w-full"
        @update:model-value="(val: string) => handleSave({ transitionEffect: val })"
      />
    </div>

    <!-- Show Clock -->
    <div class="flex items-center justify-between">
      <div>
        <p class="font-medium text-highlighted">
          Show Clock
        </p>
        <p class="text-sm text-muted">
          Display time and date overlay on screensaver
        </p>
      </div>
      <USwitch
        :model-value="props.settings.showClock"
        color="primary"
        checked-icon="i-lucide-clock"
        unchecked-icon="i-lucide-clock"
        size="xl"
        aria-label="Toggle clock overlay"
        @update:model-value="(val: boolean) => handleSave({ showClock: val })"
      />
    </div>
  </div>
</template>
