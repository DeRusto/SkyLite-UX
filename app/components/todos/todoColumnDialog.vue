<script setup lang="ts">
import type { TodoColumnBasic } from "~/types/database";

const props = defineProps<{
  isOpen: boolean;
  column?: TodoColumnBasic;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", column: { name: string }): void;
  (e: "delete", columnId: string): void;
}>();

const columnName = ref("");
const columnError = ref<string | null>(null);

const watchSource = computed(() => ({ isOpen: props.isOpen, column: props.column }));
watch(watchSource, ({ isOpen, column }) => {
  if (isOpen) {
    resetForm();
    if (column) {
      columnName.value = column.name || "";
    }
  }
}, { immediate: true });

function resetForm() {
  columnName.value = "";
  columnError.value = null;
}

function handleSave() {
  if (!columnName.value.trim()) {
    columnError.value = "Column name is required";
    return;
  }

  emit("save", { name: columnName.value.trim() });
  resetForm();
  emit("close");
}

function handleDelete() {
  if (props.column?.id) {
    emit("delete", props.column.id);
    emit("close");
  }
}
</script>

<template>
  <GlobalDialog
    :is-open="isOpen"
    :title="column?.id ? 'Edit Column' : 'Create Column'"
    :error="columnError"
    :show-delete="!!column?.id"
    :save-label="column?.id ? 'Update Column' : 'Create Column'"
    @close="emit('close')"
    @save="handleSave"
    @delete="handleDelete"
  >
    <div class="space-y-6">
      <div class="space-y-2">
        <label class="block text-sm font-medium text-highlighted">Column Name</label>
        <UInput
          v-model="columnName"
          placeholder="Enter column name"
          class="w-full"
          :ui="{ base: 'w-full' }"
          @keyup.enter="handleSave"
        />
      </div>
    </div>
  </GlobalDialog>
</template>
