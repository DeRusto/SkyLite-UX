<script setup lang="ts">
const props = defineProps<{
  isOpen: boolean;
  title?: string;
  userId: string | null;
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
  if (!/^\d{4}$/.test(pin.value)) {
    error.value = "Enter a 4-digit PIN";
    return;
  }

  if (!props.userId) {
    error.value = "No user selected";
    return;
  }

  isVerifying.value = true;
  error.value = "";

  try {
    const result = await $fetch<{ valid: boolean }>("/api/users/verifyPin", {
      method: "POST",
      body: { userId: props.userId, pin: pin.value },
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
    error.value = err instanceof Error ? err.message : "Verification failed";
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
        Enter your adult profile PIN to access this section. If you haven't set a PIN, enter any 4 digits.
      </p>

      <UFormField label="PIN" :error="error">
        <UInput
          ref="pinInput"
          v-model="pin"
          type="password"
          placeholder="Enter PIN"
          :disabled="isVerifying"
          inputmode="numeric"
          maxlength="4"
          pattern="\d{4}"
          autocomplete="off"
          @keydown="handleKeydown"
        />
      </UFormField>
    </div>
  </GlobalDialog>
</template>
