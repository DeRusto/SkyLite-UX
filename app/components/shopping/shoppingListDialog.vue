<script setup lang="ts">
import type { CreateShoppingListInput, ShoppingList } from "~/types/database";

const props = defineProps<{
  isOpen: boolean;
  list?: ShoppingList | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", list: CreateShoppingListInput): void;
  (e: "delete"): void;
}>();

const name = ref("");
const error = ref<string | null>(null);

watch(() => [props.isOpen, props.list], ([isOpen, list]) => {
  if (isOpen) {
    resetForm();
    if (list && typeof list === "object" && "name" in list) {
      name.value = list.name || "";
    }
  }
}, { immediate: true });

function resetForm() {
  name.value = "";
  error.value = null;
}

function handleSave() {
  if (!name.value.trim()) {
    error.value = "List name is required";
    return;
  }

  emit("save", {
    name: name.value.trim(),
    order: 0,
  });
}

function handleDelete() {
  emit("delete");
}
</script>

<template>
  <GlobalDialog
    :is-open="isOpen"
    :title="list ? 'Edit Shopping List' : 'Create Shopping List'"
    :error="error"
    :show-delete="!!list"
    :save-label="list ? 'Update List' : 'Create List'"
    delete-label="Delete List"
    @close="emit('close')"
    @save="handleSave"
    @delete="handleDelete"
  >
    <div class="space-y-6">
      <div class="space-y-2">
        <label class="block text-sm font-medium text-highlighted">List Name</label>
        <UInput
          v-model="name"
          placeholder="Groceries, Hardware Store, etc."
          class="w-full"
          :ui="{ base: 'w-full' }"
          @keydown.enter="handleSave"
        />
      </div>

      <div v-if="!list" class="text-sm text-muted">
        You can add items to the list after creating it.
      </div>
    </div>
  </GlobalDialog>
</template>
