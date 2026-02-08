<script setup lang="ts">
import type { ImmichAlbum } from "~/integrations/immich/immichPhotos";

const props = defineProps<{
  integrationId: string;
  selectedAlbums?: string[];
}>();

const emit = defineEmits<{
  (e: "albumsSelected", albumIds: string[]): void;
}>();

const loading = ref(false);
const error = ref<string | null>(null);
const albums = ref<ImmichAlbum[]>([]);
const selectedAlbumIds = ref<string[]>(props.selectedAlbums || []);

// Watch for prop changes
watch(() => props.selectedAlbums, (newVal) => {
  if (newVal) {
    selectedAlbumIds.value = [...newVal];
  }
}, { immediate: true });

// Fetch albums on mount
onMounted(async () => {
  await fetchAlbums();
});

async function fetchAlbums() {
  if (!props.integrationId) {
    error.value = "Integration ID is required";
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const response = await $fetch<{ albums: ImmichAlbum[] }>(
      "/api/integrations/immich/albums",
      {
        query: { integrationId: props.integrationId },
      },
    );
    albums.value = response.albums;
  }
  catch (err) {
    console.error("Failed to fetch Immich albums:", err);
    error.value = err instanceof Error ? err.message : "Failed to fetch albums from Immich";
  }
  finally {
    loading.value = false;
  }
}

function getThumbnailUrl(album: ImmichAlbum): string | null {
  if (!album.thumbnailAssetId)
    return null;
  return `/api/integrations/immich/thumbnail?integrationId=${props.integrationId}&assetId=${album.thumbnailAssetId}`;
}

function toggleAlbum(albumId: string) {
  const index = selectedAlbumIds.value.indexOf(albumId);
  if (index === -1) {
    selectedAlbumIds.value.push(albumId);
  }
  else {
    selectedAlbumIds.value.splice(index, 1);
  }
  emit("albumsSelected", selectedAlbumIds.value);
}

function isSelected(albumId: string): boolean {
  return selectedAlbumIds.value.includes(albumId);
}

function selectAll() {
  selectedAlbumIds.value = albums.value.map(a => a.id);
  emit("albumsSelected", selectedAlbumIds.value);
}

function deselectAll() {
  selectedAlbumIds.value = [];
  emit("albumsSelected", selectedAlbumIds.value);
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <label class="block text-sm font-medium text-highlighted">
        Select Albums for Screensaver
      </label>
      <div class="flex gap-2">
        <UButton
          v-if="albums.length > 0"
          size="xs"
          variant="ghost"
          @click="selectAll"
        >
          Select All
        </UButton>
        <UButton
          v-if="selectedAlbumIds.length > 0"
          size="xs"
          variant="ghost"
          @click="deselectAll"
        >
          Clear
        </UButton>
      </div>
    </div>

    <p class="text-sm text-muted">
      Choose which Immich albums to use for the screensaver slideshow.
    </p>

    <div
      v-if="error"
      role="alert"
      class="bg-error/10 text-error rounded-md px-3 py-2 text-sm flex items-center gap-2"
    >
      <UIcon name="i-lucide-alert-circle" class="h-4 w-4 flex-shrink-0" />
      {{ error }}
    </div>

    <div v-if="loading" class="text-center py-8">
      <UIcon name="i-lucide-loader-2" class="animate-spin h-8 w-8 mx-auto mb-3 text-primary" />
      <p class="text-sm text-muted">
        Loading albums from Immich...
      </p>
    </div>

    <div v-else-if="albums.length === 0 && !error" class="text-center py-8">
      <UIcon name="i-lucide-folder-open" class="h-12 w-12 mx-auto mb-3 text-muted" />
      <p class="text-sm text-muted">
        No albums found in your Immich library.
      </p>
      <p class="text-xs text-muted mt-1">
        Create albums in Immich to use them here.
      </p>
    </div>

    <!-- Album Grid with Thumbnails -->
    <div v-else class="max-h-80 overflow-y-auto">
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div
          v-for="album in albums"
          :key="album.id"
          class="relative rounded-lg border-2 overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md"
          :class="[
            isSelected(album.id)
              ? 'border-primary ring-2 ring-primary/30 shadow-sm'
              : 'border-default hover:border-muted',
          ]"
          role="checkbox"
          :aria-checked="isSelected(album.id)"
          :aria-label="`${album.title} - ${album.assetCount} photos`"
          tabindex="0"
          @click="toggleAlbum(album.id)"
          @keydown.enter.prevent="toggleAlbum(album.id)"
          @keydown.space.prevent="toggleAlbum(album.id)"
        >
          <!-- Thumbnail Image -->
          <div class="aspect-square bg-muted/30 relative">
            <img
              v-if="getThumbnailUrl(album)"
              :src="getThumbnailUrl(album)!"
              :alt="album.title"
              class="w-full h-full object-cover"
              loading="lazy"
            >
            <div
              v-else
              class="w-full h-full flex items-center justify-center"
            >
              <UIcon name="i-lucide-image" class="h-10 w-10 text-muted/50" />
            </div>

            <!-- Selection Checkmark Overlay -->
            <div
              v-if="isSelected(album.id)"
              class="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow"
            >
              <UIcon name="i-lucide-check" class="h-4 w-4 text-white" />
            </div>
          </div>

          <!-- Album Info -->
          <div class="p-2">
            <p class="font-medium text-highlighted text-sm truncate" :title="album.title">
              {{ album.title }}
            </p>
            <p class="text-xs text-muted">
              {{ album.assetCount }} {{ album.assetCount === 1 ? 'photo' : 'photos' }}
              <span v-if="album.shared" class="ml-1 text-info">
                <UIcon name="i-lucide-users" class="h-3 w-3 inline" /> Shared
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="selectedAlbumIds.length > 0" class="text-sm text-muted">
      {{ selectedAlbumIds.length }} {{ selectedAlbumIds.length === 1 ? 'album' : 'albums' }} selected
    </div>
  </div>
</template>
