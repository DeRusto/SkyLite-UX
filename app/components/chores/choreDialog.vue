<script setup lang="ts">
const props = defineProps<{
  isOpen: boolean;
  chore?: any | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "created"): void;
  (e: "updated"): void;
  (e: "deleted"): void;
}>();

type User = {
  id: string;
  name: string;
  avatar: string | null;
};

const { showError, showSuccess } = useAlertToast();

const name = ref("");
const description = ref("");
const pointValue = ref(10);
const recurrence = ref("NONE");
const assignedUserId = ref<string | null>(null);
const dueDate = ref<string | null>(null);
const icon = ref<string | null>(null);

const error = ref<string | null>(null);
const isSubmitting = ref(false);

const users = ref<User[]>([]);

const recurrenceOptions = [
  { value: "NONE", label: "One-time" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];

async function fetchUsers() {
  try {
    const data = await $fetch<User[]>("/api/users");
    users.value = data;
  }
  catch {
    // silently fail
  }
}

function resetForm() {
  name.value = "";
  description.value = "";
  pointValue.value = 10;
  recurrence.value = "NONE";
  assignedUserId.value = null;
  dueDate.value = null;
  icon.value = null;
  error.value = null;
  isSubmitting.value = false;
}

async function handleSave() {
  // Client-side validation
  if (!name.value.trim()) {
    error.value = "Chore name is required";
    return;
  }

  if (pointValue.value < 0) {
    error.value = "Point value must be a positive number";
    return;
  }

  try {
    isSubmitting.value = true;
    error.value = null;

    if (props.chore?.id) {
      await $fetch(`/api/chores/${props.chore.id}`, {
        method: "PUT" as any,
        body: {
          name: name.value.trim(),
          description: description.value.trim() || undefined,
          pointValue: pointValue.value,
          recurrence: recurrence.value,
          assignedUserId: assignedUserId.value || undefined,
          dueDate: dueDate.value || undefined,
          icon: icon.value || undefined,
        },
      });
      showSuccess("Chore Updated", `"${name.value}" has been updated.`);
      emit("updated");
    }
    else {
      await $fetch("/api/chores", {
        method: "POST",
        body: {
          name: name.value.trim(),
          description: description.value.trim() || undefined,
          pointValue: pointValue.value,
          recurrence: recurrence.value,
          assignedUserId: assignedUserId.value || undefined,
          dueDate: dueDate.value || undefined,
          icon: icon.value || undefined,
        },
      });
      showSuccess("Chore Created", `"${name.value}" has been created.`);
      emit("created");
    }

    resetForm();
    emit("close");
  }
  catch (err: unknown) {
    const fetchError = err as { data?: { message?: string } };
    error.value = fetchError.data?.message || "Failed to create chore";
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

async function handleDelete() {
  if (!props.chore?.id)
    return;

  try {
    isSubmitting.value = true;
    error.value = null;

    await $fetch(`/api/chores/${props.chore.id}`, {
      method: "DELETE" as any,
    });

    showSuccess("Chore Deleted", `"${name.value}" has been removed.`);
    emit("deleted");
    emit("close");
    resetForm();
  }
  catch (err: unknown) {
    const fetchError = err as { data?: { message?: string } };
    error.value = fetchError.data?.message || "Failed to delete chore";
    showError("Error", error.value);
  }
  finally {
    isSubmitting.value = false;
  }
}

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    fetchUsers();
    if (props.chore) {
      name.value = props.chore.name;
      description.value = props.chore.description || "";
      pointValue.value = props.chore.pointValue;
      recurrence.value = props.chore.recurrence;
      assignedUserId.value = props.chore.assignedUserId;
      // @ts-expect-error - dueDate might be undefined in chore object
      dueDate.value = props.chore.dueDate ? new Date(props.chore.dueDate).toISOString().split("T")[0] : null;
      icon.value = props.chore.icon || null;
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
    :title="chore ? 'Edit Chore' : 'Create Chore'"
    :is-submitting="isSubmitting"
    :save-label="chore ? 'Update Chore' : 'Create Chore'"
    :show-delete="!!chore"
    :error="error"
    @close="handleClose"
    @save="handleSave"
    @delete="handleDelete"
  >
    <div class="space-y-4">
      <UFormField label="Name" required>
        <UInput
          v-model="name"
          placeholder="Chore name"
          :class="{ 'border-error': error && !name.trim() }"
        />
      </UFormField>

      <UFormField label="Description">
        <UTextarea
          v-model="description"
          placeholder="Optional description"
          :rows="2"
        />
      </UFormField>

      <UFormField label="Point Value" required>
        <UInput
          v-model.number="pointValue"
          type="number"
          :min="1"
        />
      </UFormField>

      <UFormField label="Recurrence">
        <USelect
          v-model="recurrence"
          :items="recurrenceOptions"
          option-attribute="label"
          value-attribute="value"
        />
      </UFormField>

      <UFormField label="Assign To">
        <USelect
          v-model="assignedUserId"
          :items="[{ value: null, label: 'Anyone (open)' }, ...users.map(u => ({ value: u.id, label: u.name }))]"
          placeholder="Anyone can claim"
        />
      </UFormField>

      <UFormField v-if="recurrence === 'NONE'" label="Due Date">
        <UInput
          v-model="dueDate"
          type="date"
        />
      </UFormField>
    </div>
  </GlobalDialog>
</template>
