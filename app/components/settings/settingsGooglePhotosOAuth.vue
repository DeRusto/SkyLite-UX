<script setup lang="ts">
const isLoading = ref(false);

async function initiateOAuth() {
  isLoading.value = true;
  // Redirect to OAuth authorization endpoint for Google Photos
  window.location.href = "/api/integrations/google-photos/oauth/authorize";
}
</script>

<template>
  <div class="space-y-4">
    <UAlert
      color="info"
      variant="soft"
      title="Connect to Google Photos"
      description="You'll be redirected to Google to authorize SkyLite to access your photos for the screensaver feature."
    />

    <UButton
      color="primary"
      :loading="isLoading"
      block
      @click="initiateOAuth"
    >
      Connect with Google Photos
    </UButton>
  </div>
</template>
