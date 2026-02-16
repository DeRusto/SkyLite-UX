<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type { CreateUserInput, User } from "~/types/database";

const props = defineProps<{
  user: User | null;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", user: CreateUserInput): void;
  (e: "delete", userId: string): void;
}>();

const name = ref("");
const email = ref("");
const color = ref("#3b82f6");
const avatar = ref("");
const role = ref<"PARENT" | "CHILD">("CHILD");
const error = ref<string | null>(null);

const chip = computed(() => ({ backgroundColor: color.value }));

const textColor = computed(() => {
  const hex = color.value.replace("#", "");
  if (hex.length !== 6)
    return "374151";

  const r = Number.parseInt(hex.substring(0, 2), 16);
  const g = Number.parseInt(hex.substring(2, 4), 16);
  const b = Number.parseInt(hex.substring(4, 6), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "374151" : "FFFFFF";
});

watch(() => props.user, (newUser) => {
  if (newUser) {
    name.value = newUser.name || "";
    email.value = newUser.email || "";
    color.value = newUser.color || "#06b6d4";
    avatar.value = newUser.avatar && !newUser.avatar.startsWith("https://ui-avatars.com/api/") ? newUser.avatar : "";
    role.value = (newUser as User & { role?: "PARENT" | "CHILD" }).role || "CHILD";
    error.value = null;
  }
  else {
    resetForm();
  }
}, { immediate: true });

watch(() => props.isOpen, (isOpen) => {
  if (!isOpen) {
    resetForm();
  }
});

function resetForm() {
  name.value = "";
  email.value = "";
  color.value = "#06b6d4";
  avatar.value = "";
  role.value = "CHILD";
  error.value = null;
}

function getDefaultAvatarUrl() {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name.value)}&background=${color.value.replace("#", "") || "E5E7EB"}&color=${textColor.value}&size=96`;
}

function handleSave() {
  if (!name.value.trim()) {
    error.value = "Name is required";
    return;
  }

  emit("save", {
    name: name.value.trim(),
    email: email.value?.trim() || "",
    color: color.value,
    avatar: avatar.value || getDefaultAvatarUrl(),
    role: role.value,
    todoOrder: 0,
  } as CreateUserInput);
}

function handleDelete() {
  if (props.user?.id) {
    emit("delete", props.user.id);
  }
}
</script>

<template>
  <GlobalDialog
    :is-open="isOpen"
    :title="user?.id ? 'Edit User' : 'Create User'"
    :error="error"
    :show-delete="!!user?.id"
    @close="emit('close')"
    @save="handleSave"
    @delete="handleDelete"
  >
    <div class="space-y-6">
      <div class="space-y-2">
        <label class="block text-sm font-medium text-highlighted">Name *</label>
        <UInput
          v-model="name"
          placeholder="Enter user name"
          class="w-full"
          :ui="{ base: 'w-full' }"
        />
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium text-highlighted">Email (optional)</label>
        <UInput
          v-model="email"
          placeholder="Enter email address"
          type="email"
          class="w-full"
          :ui="{ base: 'w-full' }"
        />
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium text-highlighted">Profile Color</label>
        <UPopover>
          <UButton
            label="Choose color"
            color="neutral"
            variant="outline"
          >
            <template #leading>
              <span :style="chip" class="size-3 rounded-full" />
            </template>
          </UButton>
          <template #content>
            <UColorPicker v-model="color" class="p-2" />
          </template>
        </UPopover>
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium text-highlighted">Avatar</label>
        <div class="flex items-center gap-4">
          <img
            :src="avatar || getDefaultAvatarUrl()"
            :alt="name ? `${name}'s avatar preview` : 'Avatar preview'"
            class="w-12 h-12 rounded-full border border-default"
          >
          <UInput
            v-model="avatar"
            placeholder="Optional: Paste image URL"
            type="url"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
        </div>
      </div>
    </div>
  </GlobalDialog>
</template>
