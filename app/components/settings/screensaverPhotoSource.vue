<script setup lang="ts">
import type { ScreensaverSettingsData } from "~/types/screensaver";

const props = defineProps<{
  settings: ScreensaverSettingsData;
  syncing: boolean;
  lastSync: Date | null;
}>();

const emit = defineEmits<{
  photoSourceChange: [integrationId: string];
  immichAlbumsSelected: [albumIds: string[]];
  googlePhotosAlbumsSelected: [albumIds: string[]];
  syncNow: [];
}>();

const photoIntegrations = computed(() => props.settings.photoIntegrations);

const selectedPhotoIntegration = computed(() => {
  if (!props.settings.selectedPhotoSource)
    return photoIntegrations.value[0] || null;
  return photoIntegrations.value.find(i => i.id === props.settings.selectedPhotoSource) || photoIntegrations.value[0] || null;
});

const immichIntegration = computed(() => {
  return photoIntegrations.value.find(i => i.service === "immich") || null;
});

const googlePhotosIntegration = computed(() => {
  return photoIntegrations.value.find(i => i.service === "google-photos") || null;
});

const selectedImmichAlbums = computed(() => {
  if (!immichIntegration.value?.settings)
    return [];
  const s = immichIntegration.value.settings as Record<string, unknown>;
  return Array.isArray(s.selectedAlbums) ? s.selectedAlbums as string[] : [];
});

const selectedGooglePhotosAlbums = computed(() => {
  if (!googlePhotosIntegration.value?.settings)
    return [];
  const s = googlePhotosIntegration.value.settings as Record<string, unknown>;
  return Array.isArray(s.selectedAlbums) ? s.selectedAlbums as string[] : [];
});

function formatLastSync(date: Date | null): string {
  if (!date)
    return "Never";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) {
    return "Just now";
  }
  else if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  }
  else if (diffMins < 1440) {
    const hours = Math.floor(diffMins / 60);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  else {
    return date.toLocaleDateString();
  }
}
</script>

<template>
  <div class="border-t border-default pt-6">
    <h3 class="text-base font-semibold text-highlighted mb-4">
      <UIcon name="i-lucide-image" class="h-4 w-4 inline mr-1" />
      Photo Source
    </h3>

    <div v-if="photoIntegrations.length === 0" class="text-center py-6 bg-muted/20 rounded-lg">
      <UIcon name="i-lucide-image-off" class="h-10 w-10 mx-auto mb-3 text-muted" />
      <p class="text-sm text-muted">
        No photo integration configured.
      </p>
      <p class="text-xs text-muted mt-1">
        Add an Immich or Google Photos integration in the Integrations section above.
      </p>
    </div>

    <!-- Photo Source Selector (multiple integrations) -->
    <template v-else-if="photoIntegrations.length > 1">
      <p class="text-sm text-muted mb-3">
        Select which photo service to use for the screensaver:
      </p>
      <div class="space-y-2 mb-4">
        <div
          v-for="integration in photoIntegrations"
          :key="integration.id"
          class="p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 flex items-center gap-3"
          :class="
            selectedPhotoIntegration?.id === integration.id
              ? 'border-primary bg-primary/5'
              : 'border-default hover:border-muted'
          "
          @click="emit('photoSourceChange', integration.id)"
        >
          <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <UIcon :name="integration.service === 'immich' ? 'i-lucide-camera' : 'i-lucide-image'" class="h-4 w-4 text-primary" />
          </div>
          <div class="flex-1">
            <p class="font-medium text-highlighted text-sm">
              {{ integration.name }}
            </p>
            <p class="text-xs text-muted capitalize">
              {{ integration.service === 'google-photos' ? 'Google Photos' : integration.service }}
            </p>
          </div>
          <div v-if="selectedPhotoIntegration?.id === integration.id">
            <UIcon name="i-lucide-check-circle" class="h-5 w-5 text-primary" />
          </div>
        </div>
      </div>

      <!-- Sync Now Button for selected Immich integration -->
      <div v-if="selectedPhotoIntegration?.service === 'immich'" class="mb-4 p-3 bg-muted/20 rounded-lg flex items-center gap-3">
        <div class="flex-1">
          <p class="text-sm text-muted">
            Sync with Immich to fetch new photos
          </p>
        </div>
        <UButton
          size="sm"
          variant="ghost"
          color="primary"
          icon="i-lucide-refresh-cw"
          :loading="props.syncing"
          :disabled="props.syncing"
          @click="emit('syncNow')"
        >
          Sync Now
        </UButton>
      </div>

      <!-- Last Sync Status -->
      <div v-if="selectedPhotoIntegration?.service === 'immich' && (props.lastSync || props.syncing)" class="mb-4 text-xs text-muted flex items-center gap-2">
        <UIcon
          :name="props.syncing ? 'i-lucide-loader-2' : 'i-lucide-check-circle'"
          :class="{ 'animate-spin': props.syncing }"
          class="h-3 w-3"
        />
        <span>
          {{ props.syncing ? "Syncing..." : `Last synced: ${formatLastSync(props.lastSync)}` }}
        </span>
      </div>

      <!-- Album Selection for selected integration -->
      <SettingsImmichAlbumSelector
        v-if="selectedPhotoIntegration?.service === 'immich' && immichIntegration"
        :integration-id="immichIntegration.id"
        :selected-albums="selectedImmichAlbums"
        @albums-selected="(ids: string[]) => emit('immichAlbumsSelected', ids)"
      />

      <!-- Google Photos Album Selector -->
      <div v-else-if="selectedPhotoIntegration?.service === 'google-photos'" class="space-y-4">
        <div class="flex items-center justify-between">
          <label class="block text-sm font-medium text-highlighted">
            Select Albums for Screensaver
          </label>
          <div class="flex gap-2">
            <UButton
              size="xs"
              variant="ghost"
              @click="emit('googlePhotosAlbumsSelected', [])"
            >
              Clear
            </UButton>
          </div>
        </div>
        <p class="text-sm text-muted">
          Google Photos albums will appear here once you've authenticated with Google Photos.
          <br>
          <span class="text-xs opacity-75">Note: Album selection for Google Photos screensaver is coming soon.</span>
        </p>
        <div v-if="selectedGooglePhotosAlbums.length > 0" class="text-sm text-muted">
          {{ selectedGooglePhotosAlbums.length }} {{ selectedGooglePhotosAlbums.length === 1 ? 'album' : 'albums' }} selected
        </div>
      </div>
    </template>

    <!-- Single Photo Integration Display -->
    <template v-else>
      <div class="mb-4 p-3 bg-muted/20 rounded-lg flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <UIcon :name="photoIntegrations[0]?.service === 'immich' ? 'i-lucide-camera' : 'i-lucide-image'" class="h-4 w-4 text-primary" />
        </div>
        <div class="flex-1">
          <p class="font-medium text-highlighted text-sm">
            {{ photoIntegrations[0]?.name }}
          </p>
          <p class="text-xs text-muted capitalize">
            {{ photoIntegrations[0]?.service === 'google-photos' ? 'Google Photos' : photoIntegrations[0]?.service }}
          </p>
        </div>
        <UButton
          size="sm"
          variant="ghost"
          color="primary"
          icon="i-lucide-refresh-cw"
          :loading="props.syncing"
          :disabled="props.syncing"
          @click="emit('syncNow')"
        >
          Sync Now
        </UButton>
      </div>

      <!-- Last Sync Status -->
      <div v-if="props.lastSync || props.syncing" class="mb-4 text-xs text-muted flex items-center gap-2">
        <UIcon
          :name="props.syncing ? 'i-lucide-loader-2' : 'i-lucide-check-circle'"
          :class="{ 'animate-spin': props.syncing }"
          class="h-3 w-3"
        />
        <span>
          {{ props.syncing ? "Syncing..." : `Last synced: ${formatLastSync(props.lastSync)}` }}
        </span>
      </div>

      <!-- Album Selection - Immich -->
      <SettingsImmichAlbumSelector
        v-if="selectedPhotoIntegration?.service === 'immich'"
        :integration-id="immichIntegration!.id"
        :selected-albums="selectedImmichAlbums"
        @albums-selected="(ids: string[]) => emit('immichAlbumsSelected', ids)"
      />

      <!-- Album Selection - Google Photos -->
      <div v-else-if="selectedPhotoIntegration?.service === 'google-photos'" class="space-y-4">
        <div class="flex items-center justify-between">
          <label class="block text-sm font-medium text-highlighted">
            Select Albums for Screensaver
          </label>
          <div class="flex gap-2">
            <UButton
              size="xs"
              variant="ghost"
              @click="emit('googlePhotosAlbumsSelected', [])"
            >
              Clear
            </UButton>
          </div>
        </div>
        <p class="text-sm text-muted">
          Google Photos albums will appear here once you've authenticated with Google Photos.
          <br>
          <span class="text-xs opacity-75">Note: Album selection for Google Photos screensaver is coming soon.</span>
        </p>
        <div v-if="selectedGooglePhotosAlbums.length > 0" class="text-sm text-muted">
          {{ selectedGooglePhotosAlbums.length }} {{ selectedGooglePhotosAlbums.length === 1 ? 'album' : 'albums' }} selected
        </div>
      </div>
    </template>
  </div>
</template>
