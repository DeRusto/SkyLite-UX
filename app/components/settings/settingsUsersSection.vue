<script setup lang="ts">
import { consola } from "consola";

import type { CreateUserInput, User } from "~/types/database";

import SettingsUserDialog from "~/components/settings/settingsUserDialog.vue";
import { useAlertToast } from "~/composables/useAlertToast";

const emit = defineEmits<{
  userSaved: [];
}>();

const { showError, showSuccess } = useAlertToast();
const { users, loading, error, createUser, deleteUser, updateUser } = useUsers();

const selectedUser = ref<User | null>(null);
const isUserDialogOpen = ref(false);

async function handleUserSave(userData: CreateUserInput) {
  try {
    if (selectedUser.value?.id) {
      const { data: cachedUsers } = useNuxtData("users");
      const previousUsers = cachedUsers.value ? [...cachedUsers.value] : [];

      if (cachedUsers.value && Array.isArray(cachedUsers.value)) {
        const userIndex = cachedUsers.value.findIndex((u: User) => u.id === selectedUser.value!.id);
        if (userIndex !== -1) {
          cachedUsers.value[userIndex] = { ...cachedUsers.value[userIndex], ...userData };
        }
      }

      try {
        await updateUser(selectedUser.value.id, userData);
        consola.debug("Settings: User updated successfully");
        showSuccess("User Updated", "User profile has been updated successfully");
      }
      catch (err) {
        if (cachedUsers.value && previousUsers.length > 0) {
          cachedUsers.value.splice(0, cachedUsers.value.length, ...previousUsers);
        }
        throw err;
      }
    }
    else {
      await createUser(userData);
      consola.debug("Settings: User created successfully");
      showSuccess("User Created", "New user has been created successfully");
    }

    isUserDialogOpen.value = false;
    selectedUser.value = null;

    // Emit for parent to trigger calendar sync (e.g. update user-event color mapping)
    emit("userSaved");
  }
  catch (err) {
    consola.error("Settings: Failed to save user:", err);
    const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
    showError("Failed to Save User", errorMessage);
  }
}

async function handleUserDelete(userId: string) {
  try {
    const { data: cachedUsers } = useNuxtData("users");
    const previousUsers = cachedUsers.value ? [...cachedUsers.value] : [];

    if (cachedUsers.value && Array.isArray(cachedUsers.value)) {
      cachedUsers.value.splice(0, cachedUsers.value.length, ...cachedUsers.value.filter((u: User) => u.id !== userId));
    }

    try {
      await deleteUser(userId);
      consola.debug("Settings: User deleted successfully");
      showSuccess("User Deleted", "User has been removed successfully");
    }
    catch (err) {
      if (cachedUsers.value && previousUsers.length > 0) {
        cachedUsers.value.splice(0, cachedUsers.value.length, ...previousUsers);
      }
      throw err;
    }

    isUserDialogOpen.value = false;
    selectedUser.value = null;
  }
  catch (err) {
    consola.error("Settings: Failed to delete user:", err);
    const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
    showError("Failed to Delete User", errorMessage);
  }
}

function openUserDialog(user: User | null = null) {
  selectedUser.value = user;
  isUserDialogOpen.value = true;
}
</script>

<template>
  <div class="bg-default rounded-lg shadow-sm border border-default p-6 mb-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-lg font-semibold text-highlighted">
          Users
        </h2>
      </div>
      <UButton
        icon="i-lucide-user-plus"
        @click="openUserDialog()"
      >
        Add User
      </UButton>
    </div>

    <div v-if="loading" class="text-center py-8">
      <UIcon name="i-lucide-loader-2" class="animate-spin h-8 w-8 mx-auto" />
      <p class="text-default mt-2">
        Loading users...
      </p>
    </div>

    <div v-else-if="error" class="text-center py-8 text-error">
      {{ error }}
    </div>

    <div v-else-if="users.length === 0" class="text-center py-8">
      <div class="flex items-center justify-center gap-2 text-default">
        <UIcon name="i-lucide-frown" class="h-10 w-10" />
        <div class="text-center">
          <p class="text-lg">
            No users found
          </p>
          <p class="text-dimmed">
            Create your first user to get started
          </p>
        </div>
      </div>
    </div>

    <div v-else>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="user in users"
          :key="user.id"
          class="flex items-center gap-3 p-4 rounded-lg border border-default bg-muted"
        >
          <img
            :src="user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=${(user.color || '#06b6d4').replace('#', '')}&color=374151&size=96`"
            class="w-10 h-10 rounded-full object-cover border border-muted"
            :alt="user.name"
          >
          <div class="flex-1 min-w-0">
            <p class="font-medium text-highlighted truncate">
              {{ user.name }}
            </p>
            <p v-if="user.email" class="text-sm text-muted truncate">
              {{ user.email }}
            </p>
            <p v-else class="text-sm text-muted">
              No email
            </p>
          </div>
          <div class="flex items-center gap-2">
            <UButton
              variant="ghost"
              size="sm"
              icon="i-lucide-edit"
              :aria-label="`Edit ${user.name}`"
              @click="openUserDialog(user)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>

  <SettingsUserDialog
    :user="selectedUser"
    :is-open="isUserDialogOpen"
    @close="isUserDialogOpen = false"
    @save="handleUserSave"
    @delete="handleUserDelete"
  />
</template>
