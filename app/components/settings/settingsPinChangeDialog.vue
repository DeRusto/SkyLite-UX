<script setup lang="ts">
import { consola } from "consola";

const props = defineProps<{
  isOpen: boolean;
  currentPin?: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "saved"): void;
}>();

const currentPin = ref("");
const newPin = ref("");
const confirmPin = ref("");
const error = ref("");
const isSaving = ref(false);
const showPassword = ref(false);

const currentPinInput = ref<HTMLInputElement | null>(null);
const newPinInput = ref<HTMLInputElement | null>(null);
const confirmPinInput = ref<HTMLInputElement | null>(null);

watch(() => props.isOpen, (open) => {
  if (open) {
    currentPin.value = "";
    newPin.value = "";
    confirmPin.value = "";
    error.value = "";
    isSaving.value = false;
    showPassword.value = false;
    nextTick(() => {
      try {
        const el = (currentPinInput.value as unknown as { $el?: HTMLElement })?.$el?.querySelector("input");
        el?.focus();
      }
      catch {
        // Focus is non-critical, ignore errors
      }
    });
  }
});

async function handleSave() {
  if (!currentPin.value) {
    error.value = "Please enter your current PIN";
    return;
  }

  if (!newPin.value) {
    error.value = "Please enter a new PIN";
    return;
  }

  if (newPin.value.length < 4) {
    error.value = "PIN must be at least 4 digits";
    return;
  }

  if (newPin.value !== confirmPin.value) {
    error.value = "New PIN and confirmation do not match";
    return;
  }

  isSaving.value = true;
  error.value = "";

  try {
    const result = await $fetch<{ valid: boolean; message?: string }>("/api/household/verifyPin", {
      method: "POST",
      body: { pin: currentPin.value },
    });

    if (!result.valid) {
      error.value = result.message || "Current PIN is incorrect";
      isSaving.value = false;
      return;
    }

    // Current PIN is correct, now update to new PIN
    await $fetch("/api/household/settings", {
      method: "PUT",
      body: { parentPin: newPin.value },
    });

    consola.info("PIN changed successfully");
    emit("saved");
    emit("close");
  }
  catch (err) {
    consola.error("Failed to change PIN:", err);
    error.value = err instanceof Error ? err.message : "Failed to change PIN";
  }
  finally {
    isSaving.value = false;
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    handleSave();
  }
}
</script>

<template>
  <UModal
    :open="isOpen"
    @update:open="$emit('close')"
  >
    <template #content>
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-highlighted">
            <UIcon name="i-lucide-lock" class="h-4 w-4 inline mr-2" />
            Change Parent PIN
          </h3>
          <UButton
            variant="ghost"
            size="sm"
            icon="i-lucide-x"
            aria-label="Close"
            @click="$emit('close')"
          />
        </div>

        <p class="text-muted mb-4">
          Enter your current PIN and choose a new PIN for household security.
        </p>

        <div class="space-y-4">
          <div v-if="error" class="bg-error/10 text-error rounded-md px-3 py-2 text-sm mb-4">
            {{ error }}
          </div>

          <UFormField label="Current PIN" :error="error && !currentPin ? 'Required' : ''">
            <UInput
              ref="currentPinInput"
              v-model="currentPin"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Enter current PIN"
              :disabled="isSaving"
              autocomplete="off"
              @keydown="handleKeydown"
            >
              <template #trailing>
                <UButton
                  variant="ghost"
                  size="sm"
                  icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  aria-label="Toggle password visibility"
                  @click="showPassword = !showPassword"
                />
              </template>
            </uinput>
          </UFormField>

          <UFormField label="New PIN" :error="error && !newPin ? 'Required' : ''">
            <UInput
              ref="newPinInput"
              v-model="newPin"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Enter new PIN (min 4 digits)"
              :disabled="isSaving"
              autocomplete="new-password"
              @keydown.enter="confirmPinInput.focus()"
            >
              <template #trailing>
                <UButton
                  variant="ghost"
                  size="sm"
                  icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  aria-label="Toggle password visibility"
                  @click="showPassword = !showPassword"
                />
              </template>
            </uinput>
          </UFormField>

          <UFormField label="Confirm New PIN" :error="error && newPin !== confirmPin ? 'PINs must match' : ''">
            <UInput
              ref="confirmPinInput"
              v-model="confirmPin"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Confirm new PIN"
              :disabled="isSaving"
              autocomplete="new-password"
              @keydown="handleKeydown"
            >
              <template #trailing>
                <UButton
                  variant="ghost"
                  size="sm"
                  icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  aria-label="Toggle password visibility"
                  @click="showPassword = !showPassword"
                />
              </template>
            </uinput>
          </UFormField>

          <div class="flex gap-2 justify-end">
            <UButton
              variant="ghost"
              :disabled="isSaving"
              @click="$emit('close')"
            >
              Cancel
            </UButton>
            <UButton
              :loading="isSaving"
              @click="handleSave"
            >
              Change PIN
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
