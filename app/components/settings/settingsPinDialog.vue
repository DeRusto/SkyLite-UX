<script setup lang="ts">
const props = defineProps<{
  isOpen: boolean;
  title?: string;
  userId?: string | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "verified"): void;
}>();

const pin = ref("");
const error = ref("");
const isVerifying = ref(false);

const pinInput = ref<HTMLInputElement | null>(null);

watch(() => props.isOpen, (open) => {
  if (open) {
    pin.value = "";
    error.value = "";
    isVerifying.value = false;
    nextTick(() => {
      try {
        const el = (pinInput.value as unknown as { $el?: HTMLElement })?.$el?.querySelector("input");
        el?.focus();
      }
      catch {
        // Focus is non-critical, ignore errors
      }
    });
  }
});

async function handleVerify() {
  if (!pin.value) {
    error.value = "Please enter a PIN";
    return;
  }

  isVerifying.value = true;
  error.value = "";

  try {
    const endpoint = props.userId ? "/api/users/verifyPin" : "/api/household/verifyPin";
    const body = props.userId ? { userId: props.userId, pin: pin.value } : { pin: pin.value };

    const result = await $fetch<{ valid: boolean }>(endpoint, {
      method: "POST",
      body,
    });

    if (result.valid) {
      emit("verified");
      emit("close");
    }
    else {
      error.value = "Incorrect PIN";
      pin.value = "";
      try {
        const el = (pinInput.value as unknown as { $el?: HTMLElement })?.$el?.querySelector("input");
        el?.focus();
      }
      catch {
        // Focus is non-critical, ignore errors
      }
    }
  }
  catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Verification failed";
    if (errorMessage.includes("No adult PIN")) {
      // No PIN set - allow access
      emit("verified");
      emit("close");
    }
    else {
      error.value = errorMessage;
    }
  }
  finally {
    isVerifying.value = false;
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    handleVerify();
  }
}
</script>

<template>
  <GlobalDialog
    :is-open="isOpen"
    :title="title || 'Adult Verification Required'"
    :is-submitting="isVerifying"
    save-label="Verify"
    @close="$emit('close')"
    @save="handleVerify"
  >
    <div class="space-y-4">
      <p class="text-muted mb-4">
        Enter the adult PIN to access this section.
      </p>

      <UFormField label="PIN" :error="error">
        <UInput
          ref="pinInput"
          v-model="pin"
          type="password"
          placeholder="Enter PIN"
          :disabled="isVerifying"
          autocomplete="off"
          @keydown="handleKeydown"
        />
      </UFormField>
    </div>
  </GlobalDialog>
</template>
