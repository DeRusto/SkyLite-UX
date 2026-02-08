<script setup lang="ts">
import { consola } from "consola";

import { useAlertToast } from "~/composables/useAlertToast";

const { showError, showSuccess } = useAlertToast();

type ImmichPerson = {
  id: string;
  name: string;
  birthDate: string | null;
  thumbnailUrl: string;
  type: "person" | "pet";
};

type ScreensaverSettingsData = {
  id: string;
  enabled: boolean;
  activationMode: string;
  idleTimeoutMinutes: number;
  scheduleStart: string | null;
  scheduleEnd: string | null;
  photoDisplaySeconds: number;
  transitionEffect: string;
  showClock: boolean;
  clockPosition: string;
  photoIntegrations: Array<{
    id: string;
    name: string;
    service: string;
    settings: Record<string, unknown> | null;
    enabled: boolean;
  }>;
};

// Screensaver settings state
const settings = ref<ScreensaverSettingsData | null>(null);
const loading = ref(true);
const saving = ref(false);

// People/Pets state
const people = ref<ImmichPerson[]>([]);
const pets = ref<ImmichPerson[]>([]);
const loadingPeople = ref(false);
const peopleError = ref<string | null>(null);

// Get the active Immich integration (if any)
const immichIntegration = computed(() => {
  if (!settings.value)
    return null;
  return settings.value.photoIntegrations.find(i => i.service === "immich") || null;
});

// Get selected albums from Immich integration settings
const selectedAlbums = computed(() => {
  if (!immichIntegration.value?.settings)
    return [];
  const s = immichIntegration.value.settings as Record<string, unknown>;
  return Array.isArray(s.selectedAlbums) ? s.selectedAlbums as string[] : [];
});

// Fetch screensaver settings
async function fetchSettings() {
  loading.value = true;
  try {
    const data = await $fetch<ScreensaverSettingsData>("/api/screensaver/settings");
    settings.value = data;
  }
  catch (err) {
    consola.error("Failed to fetch screensaver settings:", err);
    showError("Error", "Failed to load screensaver settings");
  }
  finally {
    loading.value = false;
  }
}

// Save screensaver settings
async function saveSettings(updates: Partial<ScreensaverSettingsData>) {
  saving.value = true;
  try {
    const data = await $fetch<ScreensaverSettingsData>("/api/screensaver/settings", {
      method: "PUT",
      body: updates,
    });
    if (settings.value) {
      Object.assign(settings.value, data);
    }
    showSuccess("Saved", "Screensaver settings updated");
  }
  catch (err) {
    consola.error("Failed to save screensaver settings:", err);
    showError("Error", "Failed to save screensaver settings");
  }
  finally {
    saving.value = false;
  }
}

// Handle album selection/deselection from the album selector
async function handleAlbumsSelected(albumIds: string[]) {
  if (!immichIntegration.value)
    return;

  try {
    // Update the integration settings with new album selection
    await $fetch(`/api/integrations/${immichIntegration.value.id}`, {
      method: "PUT",
      body: {
        settings: {
          ...(immichIntegration.value.settings as Record<string, unknown> || {}),
          selectedAlbums: albumIds,
        },
      },
    });

    // Update local state
    if (immichIntegration.value.settings) {
      (immichIntegration.value.settings as Record<string, unknown>).selectedAlbums = albumIds;
    }
    else {
      immichIntegration.value.settings = { selectedAlbums: albumIds } as Record<string, unknown>;
    }

    showSuccess("Albums Updated", `${albumIds.length} album${albumIds.length === 1 ? "" : "s"} selected for screensaver`);
  }
  catch (err) {
    consola.error("Failed to update album selection:", err);
    showError("Error", "Failed to save album selection");
  }
}

// Fetch people/pets from Immich
async function fetchPeople() {
  if (!immichIntegration.value)
    return;

  loadingPeople.value = true;
  peopleError.value = null;

  try {
    const data = await $fetch<{
      people: ImmichPerson[];
      pets: ImmichPerson[];
      total: number;
    }>("/api/integrations/immich/people", {
      query: { integrationId: immichIntegration.value.id },
    });

    people.value = data.people || [];
    pets.value = data.pets || [];
  }
  catch (err: unknown) {
    consola.error("Failed to fetch people from Immich:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to fetch people from Immich";
    peopleError.value = errorMessage;
  }
  finally {
    loadingPeople.value = false;
  }
}

// Fetch on mount
onMounted(async () => {
  await fetchSettings();
  if (immichIntegration.value) {
    await fetchPeople();
  }
});

// Fetch people when immich integration becomes available
watch(immichIntegration, (newVal) => {
  if (newVal) {
    fetchPeople();
  }
});
</script>

<template>
  <div class="space-y-6">
    <!-- Loading state -->
    <div v-if="loading" class="text-center py-8">
      <UIcon name="i-lucide-loader-2" class="animate-spin h-8 w-8 mx-auto" />
      <p class="text-default mt-2">
        Loading screensaver settings...
      </p>
    </div>

    <template v-else-if="settings">
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
          :model-value="settings.enabled"
          color="primary"
          checked-icon="i-lucide-monitor"
          unchecked-icon="i-lucide-monitor-off"
          size="xl"
          aria-label="Toggle screensaver"
          @update:model-value="(val: boolean) => saveSettings({ enabled: val })"
        />
      </div>

      <!-- Photo Display Duration -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <label class="block text-sm font-medium text-highlighted">Photo Display Duration</label>
          <span class="text-sm text-muted">{{ settings.photoDisplaySeconds }}s</span>
        </div>
        <input
          type="range"
          :value="settings.photoDisplaySeconds"
          min="5"
          max="60"
          step="5"
          class="w-full accent-primary"
          @change="(e: Event) => saveSettings({ photoDisplaySeconds: Number((e.target as HTMLInputElement).value) })"
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
          <span class="text-sm text-muted">{{ settings.idleTimeoutMinutes }} min</span>
        </div>
        <input
          type="range"
          :value="settings.idleTimeoutMinutes"
          min="1"
          max="60"
          step="1"
          class="w-full accent-primary"
          @change="(e: Event) => saveSettings({ idleTimeoutMinutes: Number((e.target as HTMLInputElement).value) })"
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
          :model-value="settings.transitionEffect"
          :items="[
            { label: 'Fade', value: 'FADE' },
            { label: 'Slide', value: 'SLIDE' },
            { label: 'Zoom', value: 'ZOOM' },
            { label: 'None', value: 'NONE' },
          ]"
          class="w-full"
          @update:model-value="(val: string) => saveSettings({ transitionEffect: val })"
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
          :model-value="settings.showClock"
          color="primary"
          checked-icon="i-lucide-clock"
          unchecked-icon="i-lucide-clock"
          size="xl"
          aria-label="Toggle clock overlay"
          @update:model-value="(val: boolean) => saveSettings({ showClock: val })"
        />
      </div>

      <!-- Photo Source Section -->
      <div class="border-t border-default pt-6">
        <h3 class="text-base font-semibold text-highlighted mb-4">
          <UIcon name="i-lucide-image" class="h-4 w-4 inline mr-1" />
          Photo Source
        </h3>

        <div v-if="!immichIntegration" class="text-center py-6 bg-muted/20 rounded-lg">
          <UIcon name="i-lucide-image-off" class="h-10 w-10 mx-auto mb-3 text-muted" />
          <p class="text-sm text-muted">
            No photo integration configured.
          </p>
          <p class="text-xs text-muted mt-1">
            Add an Immich or Google Photos integration in the Integrations section above.
          </p>
        </div>

        <template v-else>
          <div class="mb-4 p-3 bg-muted/20 rounded-lg flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <UIcon name="i-lucide-camera" class="h-4 w-4 text-primary" />
            </div>
            <div>
              <p class="font-medium text-highlighted text-sm">
                {{ immichIntegration.name }}
              </p>
              <p class="text-xs text-muted capitalize">
                {{ immichIntegration.service }}
              </p>
            </div>
          </div>

          <!-- Album Selection -->
          <SettingsImmichAlbumSelector
            :integration-id="immichIntegration.id"
            :selected-albums="selectedAlbums"
            @albums-selected="handleAlbumsSelected"
          />
        </template>
      </div>

      <!-- People / Pets Section -->
      <div v-if="immichIntegration" class="border-t border-default pt-6">
        <h3 class="text-base font-semibold text-highlighted mb-4">
          <UIcon name="i-lucide-users" class="h-4 w-4 inline mr-1" />
          People & Pets
        </h3>

        <p class="text-sm text-muted mb-4">
          People and pets identified by Immich facial recognition. These can be used to filter photos for the screensaver.
        </p>

        <!-- Loading state -->
        <div v-if="loadingPeople" class="text-center py-6">
          <UIcon name="i-lucide-loader-2" class="animate-spin h-6 w-6 mx-auto mb-2 text-primary" />
          <p class="text-sm text-muted">
            Loading people from Immich...
          </p>
        </div>

        <!-- Error state -->
        <div
          v-else-if="peopleError"
          role="alert"
          class="bg-error/10 text-error rounded-md px-3 py-2 text-sm flex items-center gap-2"
        >
          <UIcon name="i-lucide-alert-circle" class="h-4 w-4 flex-shrink-0" />
          {{ peopleError }}
          <UButton
            size="xs"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            class="ml-auto"
            @click="fetchPeople"
          >
            Retry
          </UButton>
        </div>

        <template v-else>
          <!-- People Section -->
          <div v-if="people.length > 0" class="mb-6">
            <h4 class="text-sm font-medium text-highlighted mb-3">
              <UIcon name="i-lucide-user" class="h-3.5 w-3.5 inline mr-1" />
              People ({{ people.length }})
            </h4>
            <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              <div
                v-for="person in people"
                :key="person.id"
                class="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-muted/20 transition-colors"
              >
                <img
                  :src="person.thumbnailUrl"
                  :alt="person.name"
                  class="w-14 h-14 rounded-full object-cover border-2 border-default shadow-sm"
                  loading="lazy"
                  @error="(e: Event) => (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(person.name)}&size=56&background=6BCBCB&color=fff`"
                >
                <p class="text-xs text-highlighted text-center truncate w-full">
                  {{ person.name }}
                </p>
              </div>
            </div>
          </div>

          <!-- Pets Section -->
          <div v-if="pets.length > 0" class="mb-4">
            <h4 class="text-sm font-medium text-highlighted mb-3">
              <UIcon name="i-lucide-paw-print" class="h-3.5 w-3.5 inline mr-1" />
              Pets ({{ pets.length }})
            </h4>
            <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              <div
                v-for="pet in pets"
                :key="pet.id"
                class="flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-muted/20 transition-colors"
              >
                <img
                  :src="pet.thumbnailUrl"
                  :alt="pet.name"
                  class="w-14 h-14 rounded-full object-cover border-2 border-default shadow-sm"
                  loading="lazy"
                  @error="(e: Event) => (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(pet.name)}&size=56&background=FFD93D&color=fff`"
                >
                <p class="text-xs text-highlighted text-center truncate w-full">
                  {{ pet.name }}
                </p>
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <div v-if="people.length === 0 && pets.length === 0" class="text-center py-6 bg-muted/20 rounded-lg">
            <UIcon name="i-lucide-user-x" class="h-10 w-10 mx-auto mb-3 text-muted" />
            <p class="text-sm text-muted">
              No people or pets found in your Immich library.
            </p>
            <p class="text-xs text-muted mt-1">
              Immich will identify faces automatically as it processes your photos.
            </p>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>
