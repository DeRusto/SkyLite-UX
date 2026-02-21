<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type { AvailableCalendar } from "~/types/calendar";
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
const role = ref<"ADULT" | "CHILD">("CHILD");
const pin = ref("");
const calendarId = ref<string | null>(null);
const calendarIntegrationId = ref<string | null>(null);
const calendarService = ref<string | null>(null);
const error = ref<string | null>(null);

const { data: calendarData, refresh: refreshCalendars } = useFetch<{ calendars: AvailableCalendar[] }>("/api/calendars", {
  immediate: false,
});

const availableCalendars = computed(() => calendarData.value?.calendars || []);

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
    role.value = newUser.role;
    pin.value = ""; // Don't populate PIN for security
    calendarId.value = newUser.calendarId || null;
    calendarIntegrationId.value = newUser.calendarIntegrationId || null;
    calendarService.value = newUser.calendarService || null;
    error.value = null;
  }
  else {
    resetForm();
  }
}, { immediate: true });

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    refreshCalendars();
  }
  else {
    resetForm();
  }
});

watch(role, (newRole) => {
  if (newRole === "CHILD") {
    pin.value = "";
  }
});

function handleCalendarSelect(val: string | null) {
  const selected = availableCalendars.value.find(c => c.id === val);
  if (selected) {
    calendarId.value = selected.id;
    calendarIntegrationId.value = selected.integrationId;
    calendarService.value = selected.service;
  }
  else {
    calendarId.value = null;
    calendarIntegrationId.value = null;
    calendarService.value = null;
  }
}

function resetForm() {
  name.value = "";
  email.value = "";
  color.value = "#06b6d4";
  avatar.value = "";
  role.value = "CHILD";
  pin.value = "";
  calendarId.value = null;
  calendarIntegrationId.value = null;
  calendarService.value = null;
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

  if (role.value === "ADULT" && pin.value && !/^\d{4}$/.test(pin.value)) {
    error.value = "PIN must be exactly 4 digits";
    return;
  }

  emit("save", {
    name: name.value.trim(),
    email: email.value?.trim() || "",
    color: color.value,
    avatar: avatar.value || getDefaultAvatarUrl(),
    role: role.value,
    pin: role.value === "CHILD" ? undefined : (pin.value || undefined),
    calendarId: calendarId.value,
    calendarIntegrationId: calendarIntegrationId.value,
    calendarService: calendarService.value,
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

      <div class="space-y-2">
        <label class="block text-sm font-medium text-highlighted">User Type</label>
        <UButtonGroup class="w-full">
          <UButton
            :variant="role === 'ADULT' ? 'solid' : 'outline'"
            class="flex-1 justify-center"
            @click="role = 'ADULT'"
          >
            Adult
          </UButton>
          <UButton
            :variant="role === 'CHILD' ? 'solid' : 'outline'"
            class="flex-1 justify-center"
            @click="role = 'CHILD'"
          >
            Child
          </UButton>
        </UButtonGroup>
      </div>

      <div v-if="role === 'ADULT'" class="space-y-2">
        <label class="block text-sm font-medium text-highlighted">PIN (4 digits)</label>
        <UInput
          v-model="pin"
          placeholder="Enter 4-digit PIN"
          type="password"
          maxlength="4"
          pattern="[0-9]*"
          inputmode="numeric"
          class="w-full"
          :ui="{ base: 'w-full' }"
        />
        <p class="text-xs text-muted">
          Used to unlock adult features like managing chores and rewards.
        </p>
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium text-highlighted">Linked Calendar</label>
        <p class="text-xs text-muted mb-2">
          Associate this user with a specific calendar to automatically route their events and enable filtering.
        </p>
        <div v-if="availableCalendars.length > 0">
          <USelect
            :model-value="calendarId"
            :items="[
              { label: 'None', value: null },
              ...availableCalendars.map(cal => ({ label: `${cal.integrationName}: ${cal.summary}`, value: cal.id })),
            ]"
            placeholder="Select a calendar"
            class="w-full"
            @update:model-value="handleCalendarSelect"
          />
        </div>
        <div v-else class="text-sm text-muted py-2 bg-muted/30 rounded px-3">
          No calendar integrations found. Connect a Google Calendar or iCal in Settings > Integrations first.
        </div>
      </div>
    </div>
  </GlobalDialog>
</template>
