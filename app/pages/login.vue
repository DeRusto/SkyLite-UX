<script setup lang="ts">
import { consola } from "consola";
import type { User } from "~/types/database";

definePageMeta({
  layout: "screensaver",
});

const { users, selectUser } = useUsers();
const router = useRouter();

const isPinDialogOpen = ref(false);
const selectedUserForPin = ref<User | null>(null);

function handleUserClick(user: User) {
  if (user.role === "ADULT") {
    selectedUserForPin.value = user;
    isPinDialogOpen.value = true;
  } else {
    handleUserSelect(user);
  }
}

async function handlePinVerified() {
  if (selectedUserForPin.value) {
    await handleUserSelect(selectedUserForPin.value);
    isPinDialogOpen.value = false;
  }
}

async function handleUserSelect(user: User) {
  try {
    await selectUser(user);
    consola.info(`User selected: ${user.name}`);
    // Redirect to home which will then redirect to user's default page
    router.push("/");
  } catch (err) {
    consola.error("Failed to select user:", err);
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-default p-4">
    <div class="max-w-4xl w-full">
      <div class="text-center mb-12">
        <div class="flex justify-center mb-6">
          <div class="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <img src="/skylite.svg" alt="SkyLite UX Logo" class="w-12 h-12">
          </div>
        </div>
        <h1 class="text-4xl font-bold text-highlighted mb-2">Welcome Home</h1>
        <p class="text-xl text-muted">Who's using SkyLite today?</p>
      </div>

      <div v-if="users.length === 0" class="text-center py-12 bg-muted/30 rounded-2xl border border-default">
        <UIcon name="i-lucide-user-plus" class="w-16 h-16 text-muted mx-auto mb-4" />
        <p class="text-lg text-highlighted mb-4">No users found</p>
        <p class="text-muted mb-8">Please create a user profile in settings to get started.</p>
        <UButton to="/settings" size="lg" icon="i-lucide-settings">Go to Settings</UButton>
      </div>

      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        <button
          v-for="user in users"
          :key="user.id"
          class="group flex flex-col items-center gap-3 p-4 rounded-2xl transition-all hover:bg-muted/50 active:scale-95"
          @click="handleUserClick(user)"
        >
          <div class="relative">
            <img
              :src="user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=${(user.color || '#06b6d4').replace('#', '')}&color=374151&size=128`"
              class="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-transparent group-hover:border-primary transition-all shadow-lg"
              :alt="user.name"
            >
            <div
              class="absolute bottom-1 right-1 w-6 h-6 rounded-full border-4 border-default"
              :style="{ backgroundColor: user.color || '#06b6d4' }"
            ></div>
          </div>
          <span class="text-lg font-semibold text-highlighted group-hover:text-primary transition-colors truncate w-full text-center">
            {{ user.name }}
          </span>
        </button>
      </div>

      <div class="mt-16 text-center">
        <UButton
          to="/settings"
          variant="ghost"
          color="neutral"
          icon="i-lucide-settings"
          size="sm"
        >
          Settings
        </UButton>
      </div>
    </div>

    <SettingsPinDialog
      :is-open="isPinDialogOpen"
      @close="isPinDialogOpen = false; selectedUserForPin = null"
      @verified="handlePinVerified"
    />
  </div>
</template>
