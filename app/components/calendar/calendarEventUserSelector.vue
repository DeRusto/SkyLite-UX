<script setup lang="ts">
import type { User } from "~/types/database";

const props = defineProps<{
  users: User[];
  modelValue: string[];
  isReadOnly: boolean;
  isNewEvent: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string[]): void;
}>();

function toggleUser(userId: string) {
  if (props.isReadOnly)
    return;

  if (props.modelValue.includes(userId)) {
    emit("update:modelValue", props.modelValue.filter(id => id !== userId));
  }
  else {
    emit("update:modelValue", [...props.modelValue, userId]);
  }
}
</script>

<template>
  <div class="space-y-2">
    <label class="block text-sm font-medium text-highlighted">Users</label>
    <div class="space-y-2">
      <div class="text-sm text-muted mb-2">
        {{ isNewEvent ? 'Select users for this event:' : 'Edit users for this event:' }}
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="user in users"
          :key="user.id"
          variant="ghost"
          size="sm"
          class="p-1"
          :class="modelValue.includes(user.id) ? 'ring-2 ring-primary-500' : ''"
          :aria-pressed="modelValue.includes(user.id)"
          :disabled="isReadOnly"
          `@click`="toggleUser(user.id)"
        >
          <UAvatar
            :src="user.avatar || undefined"
            :alt="user.name"
            size="xl"
          />
        </UButton>
      </div>
      <div v-if="!users.length" class="text-sm text-muted">
        No users found! Please add some users in the <NuxtLink
          to="/settings"
          class="text-primary"
        >
          settings
        </NuxtLink> page.
      </div>
    </div>
  </div>
</template>
