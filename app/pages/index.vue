<script setup lang="ts">
const { currentUser } = useUsers();

// Redirect to user's default page or fallback to calendar
const destination = currentUser.value?.defaultPage || "/calendar";
await navigateTo(destination);
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-default">
    <div class="text-center">
      <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
      <p class="text-muted">Redirecting...</p>
    </div>
  </div>
</template>
