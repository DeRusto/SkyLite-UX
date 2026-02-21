<script setup lang="ts">
const props = defineProps<{
  isOpen: boolean;
  reward?: any | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "created"): void;
  (e: "updated"): void;
  (e: "deleted"): void;
}>();

const { showError, showSuccess } = useAlertToast();

const name = ref("");
const description = ref("");
const pointCost = ref(10);
const quantityAvailable = ref<number | null>(null);
const expiresAt = ref<string | null>(null);
const icon = ref<string | null>(null);

const error = ref<string | null>(null);
const isSubmitting = ref(false);

function resetForm() {
  name.value = "";
  description.value = "";
  pointCost.value = 10;
  quantityAvailable.value = null;
  expiresAt.value = null;
  icon.value = null;
  error.value = null;
  isSubmitting.value = false;
}

async function handleSave() {
  if (!name.value.trim()) {
    error.value = "Reward name is required";
    return;
  }

  if (pointCost.value < 1) {
    error.value = "Point cost must be at least 1";
    return;
  }

  try {
    isSubmitting.value = true;
    error.value = null;

    const payload = {
      name: name.value.trim(),
      description: description.value.trim() || undefined,
      pointCost: pointCost.value,
      quantityAvailable: quantityAvailable.value,
      expiresAt: expiresAt.value || undefined,
      icon: icon.value || undefined,
    };

    if (props.reward?.id) {
      await $fetch(`/api/rewards/${props.reward.id}`, {
        method: "PUT" as any,
        body: payload,
      });
      showSuccess("Reward Updated", `"${name.value}" has been updated.`);
      emit("updated");
    }
    else {
      await $fetch("/api/rewards", {
        method: "POST",
        body: payload,
      });
      showSuccess("Reward Created", `"${name.value}" has been created.`);
      emit("created");
    }

    resetForm();
    emit("close");
  }
  catch (err: unknown) {
    const fetchError = err as { data?: { message?: string } };
    error.value = fetchError.data?.message || "Failed to save reward";
    showError("Error", error.value);
  }
  finally {
    isSubmitting.value = false;
  }
}

async function handleDelete() {
  if (!props.reward?.id)
    return;

  try {
    isSubmitting.value = true;
    error.value = null;

    await $fetch(`/api/rewards/${props.reward.id}`, {
      method: "DELETE" as any,
    });

    showSuccess("Reward Deleted", `"${name.value}" has been removed.`);
    emit("deleted");
    emit("close");
    resetForm();
  }
  catch (err: unknown) {
    const fetchError = err as { data?: { message?: string } };
    error.value = fetchError.data?.message || "Failed to delete reward";
    showError("Error", error.value);
  }
  finally {
    isSubmitting.value = false;
  }
}

function handleClose() {
  resetForm();
  emit("close");
}

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    if (props.reward) {
      name.value = props.reward.name;
      description.value = props.reward.description || "";
      pointCost.value = props.reward.pointCost;
      quantityAvailable.value = props.reward.quantityAvailable;
      // @ts-expect-error - expiresAt might be undefined in reward object
      expiresAt.value = props.reward.expiresAt ? new Date(props.reward.expiresAt).toISOString().split("T")[0] : null;
      icon.value = props.reward.icon || null;
    }
    else {
      resetForm();
    }
  }
});
</script>

<template>
  <GlobalDialog
    :is-open="isOpen"
    :title="reward ? 'Edit Reward' : 'Create Reward'"
    :is-submitting="isSubmitting"
    :save-label="reward ? 'Update Reward' : 'Create Reward'"
    :show-delete="!!reward"
    :error="error"
    @close="handleClose"
    @save="handleSave"
    @delete="handleDelete"
  >
    <div class="space-y-4">
      <UFormField label="Name" required>
        <UInput
          v-model="name"
          placeholder="Reward name"
        />
      </UFormField>

      <UFormField label="Description">
        <UTextarea
          v-model="description"
          placeholder="Optional description"
          :rows="2"
        />
      </UFormField>

      <UFormField label="Point Cost" required>
        <UInput
          v-model.number="pointCost"
          type="number"
          :min="1"
        />
      </UFormField>

      <UFormField label="Quantity Available">
        <UInput
          v-model.number="quantityAvailable"
          type="number"
          :min="0"
          placeholder="Leave empty for unlimited"
        />
      </UFormField>

      <UFormField label="Expiration Date">
        <UInput
          v-model="expiresAt"
          type="date"
        />
      </UFormField>
    </div>
  </GlobalDialog>
</template>
