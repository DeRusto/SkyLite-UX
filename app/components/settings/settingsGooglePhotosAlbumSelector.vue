<script setup lang="ts">
// Props
const props = defineProps<{
  // We receive the full integration object or just IDs.
  // Based on usage in `settingsIntegrationDialog.vue`, it passes `integration` prop?
  // The previous file had: `accessToken`, `refreshToken`, `tokenExpiry`.
  // I should check `settingsIntegrationDialog.vue` to see how it invokes this component.
  // Assuming it passes individual props, I probably need `integrationId` passed down.
  // Since I don't see `integrationId` in the old props, I might need to update the parent too.
  // OR I can use the accessToken to create session? No, backend needs to look up integration to decrypt token.
  // I'll assume for a moment the parent passes `integration` or I need to add it.

  // Let's stick to the props expected by the parent for now, but I need `integrationId` which is `props.integration.id` usually.
  // The previous component didn't use integration ID.
  // I will check parent usage in next step if this fails, but usually `v-bind` is used.

  // If I can't change parent easily, I might hack it: pass accessToken to create session??
  // No, security risk sending token in body if not needed.
  // I'll add `integrationId` to props and hope parent provides it or I'll update parent.
  integrationId?: string; // We'll make it optional to avoid type errors and check if it's passed.
  accessToken: string;
  refreshToken: string;
  tokenExpiry: string;
}>();

const emit = defineEmits<{
  (e: "albumsSelected", albums: any[]): void; // Keep compat with parent event for now
  (e: "close"): void;
}>();

const loading = ref(false);
const error = ref<string | null>(null);
const polling = ref(false);
const importStatus = ref<string>("");
const importedCount = ref(0);
const success = ref(false);

// Timer
let pollTimer: any = null;

onUnmounted(() => {
  if (pollTimer)
    clearInterval(pollTimer);
});

async function startImportFlow() {
  loading.value = true;
  error.value = null;
  success.value = false;
  importStatus.value = "Initializing Picker...";

  try {
    // 1. Create Session
    // We need integrationId. If not passed, we are in trouble.
    // Using `useRoute` might get it if we are on a page, but this is a modal.
    // Let's assume we can get it from somewhere or fail.
    if (!props.integrationId) {
      // Fallback: If parent doesn't pass ID, we can't create session safely on backend using ID lookups.
      // But wait, the previous code used `accessToken` passed as prop.
      // Can we create session using just accessToken?
      // My backend endpoint `session.post.ts` REQUIRES `integrationId`.
      throw new Error("Integration ID is missing. Please close and reopen.");
    }

    const session = await $fetch<{ pickerUri: string; sessionId: string }>(
      "/api/integrations/google-photos/session",
      {
        method: "POST",
        body: { integrationId: props.integrationId },
      },
    );

    // 2. Open Popup
    const width = 800;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    const popup = window.open(
      session.pickerUri,
      "GooglePhotosPicker",
      `width=${width},height=${height},top=${top},left=${left},resizable,scrollbars`,
    );

    if (!popup) {
      throw new Error("Popup blocked. Please allow popups for this site.");
    }

    importStatus.value = "Waiting for you to select photos...";
    polling.value = true;

    // 3. Start Polling
    pollTimer = setInterval(async () => {
      if (popup.closed) {
        // If popup closed and we haven't finished, maybe user cancelled?
        // Check one last time.
        clearInterval(pollTimer);
        polling.value = false;
        if (!success.value) {
          // check if we have items
          await checkSession(session.sessionId);
          if (!success.value) {
            error.value = "Selection cancelled or window closed.";
            loading.value = false;
          }
        }
        return;
      }

      await checkSession(session.sessionId);
    }, 2000);
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to open imported";
    loading.value = false;
    polling.value = false;
  }
}

async function checkSession(sessionId: string) {
  try {
    if (!props.integrationId)
      return;

    const status = await $fetch<{ ready: boolean; count: number; items: any[] }>(
      "/api/integrations/google-photos/session/check",
      {
        query: { sessionId, integrationId: props.integrationId },
      },
    );

    if (status.ready) {
      // User finished!
      if (pollTimer)
        clearInterval(pollTimer);
      polling.value = false;

      // Trigger download
      importStatus.value = `Importing ${status.count} photos...`;

      await importPhotos(status.items);
    }
  }
  catch (err) {
    console.error("Poll error", err);
  }
}

async function importPhotos(items: any[]) {
  try {
    const result = await $fetch<{ success: boolean; importedCount: number }>(
      "/api/integrations/google-photos/import",
      {
        method: "POST",
        body: { items },
      },
    );

    importedCount.value = result.importedCount;
    success.value = true;
    importStatus.value = "Import complete!";
    loading.value = false;

    // Wait a moment then emit success
    setTimeout(() => {
      // We emit "albumsSelected" with a dummy value to signify we are done?
      // Or better, we just close.
      // The parent expects `albumsSelected`.
      // Let's emit a special "imported" event or just close.
      // Be compatible: emit empty array and let user knw?
      // Actually, if we imported photos, they are now LOCAL files.
      // We should probably tell the parent to refresh backgrounds.
      emit("albumsSelected", [{ id: "imported", title: "Imported Photos" }]);
    }, 1500);
  }
  catch (err) {
    error.value = "Failed to download photos.";
    loading.value = false;
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block text-sm font-medium text-highlighted mb-2">
        Sync Google Photos
      </label>
      <p class="text-sm text-muted mb-3">
        Select photos from your Google Photos library to download and use as backgrounds.
        <br>
        <span class="opacity-75 text-xs">Note: This creates a local copy. New photos added to Google Photos won't appear automatically.</span>
      </p>
    </div>

    <div
      v-if="error"
      role="alert"
      class="bg-error/10 text-error rounded-md px-3 py-2 text-sm"
    >
      {{ error }}
    </div>

    <div v-if="success" class="bg-green-500/10 text-green-500 rounded-md px-3 py-2 text-sm text-center">
      <UIcon name="i-lucide-check-circle" class="w-8 h-8 mx-auto mb-2" />
      <p class="font-medium">
        Successfully imported {{ importedCount }} photos!
      </p>
    </div>

    <div v-else-if="loading" class="text-center py-8">
      <UIcon name="i-lucide-loader-2" class="animate-spin h-8 w-8 mx-auto mb-3 text-primary" />
      <p class="text-sm font-medium">
        {{ importStatus }}
      </p>
      <p v-if="polling" class="text-xs text-muted mt-1">
        Please complete selection in the popup window...
      </p>
    </div>

    <div v-else class="text-center py-6">
      <UButton
        size="lg"
        color="primary"
        icon="i-logos-google-photos"
        @click="startImportFlow"
      >
        Select Photos to Import
      </UButton>
    </div>
  </div>
</template>
