<script setup lang="ts">
import { useScreensaverSettings } from "~/composables/useScreensaverSettings";

const {
  settings,
  loading,
  people,
  pets,
  loadingPeople,
  peopleError,
  syncing,
  lastSync,
  immichIntegration,
  selectedPhotoIntegration,
  selectedImmichAlbums,
  selectedPeople,
  fetchSettings,
  saveSettings,
  updateIntegrationAlbums,
  handlePeopleSelected,
  fetchPeople,
  syncNow,
} = useScreensaverSettings();

onMounted(async () => {
  await fetchSettings();
  if (immichIntegration.value) {
    await fetchPeople();
  }
});

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
      <!-- Core timing and display controls -->
      <ScreensaverTimingControls
        :settings="settings"
        @save="saveSettings"
      />

      <!-- Photo source and album selection -->
      <ScreensaverPhotoSource
        :settings="settings"
        :syncing="syncing"
        :last-sync="lastSync"
        @photo-source-change="(id: string) => saveSettings({ selectedPhotoSource: id })"
        @immich-albums-selected="(ids: string[]) => updateIntegrationAlbums('immich', ids)"
        @google-photos-albums-selected="(ids: string[]) => updateIntegrationAlbums('google-photos', ids)"
        @sync-now="syncNow"
      />

      <!-- People & Pets selector (Immich only) -->
      <ScreensaverPeopleSelector
        v-if="immichIntegration && selectedPhotoIntegration?.service === 'immich'"
        :people="people"
        :pets="pets"
        :selected-people="selectedPeople"
        :loading="loadingPeople"
        :error="peopleError"
        :selected-albums="selectedImmichAlbums"
        @people-selected="handlePeopleSelected"
        @retry="fetchPeople"
      />
    </template>
  </div>
</template>
