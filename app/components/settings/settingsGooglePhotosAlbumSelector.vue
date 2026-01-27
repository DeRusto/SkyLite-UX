<script setup lang="ts">
defineProps<{
  integrationId?: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: string;
}>();

const emit = defineEmits<{
  (e: "albumsSelected", albums: { id: string; title: string }[]): void;
}>();
</script>

<template>
  <div class="p-4 text-center">
    <p>Google Photos Album Selector Placeholder</p>
  </div>
</template>
