<script setup lang="ts">
import type { CalendarDate, DateValue } from "@internationalized/date";

import { getLocalTimeZone, parseDate } from "@internationalized/date";

import type { Priority, TodoColumnBasic, TodoListItem } from "~/types/database";

import { useStableDate } from "~/composables/useStableDate";

const props = defineProps<{
  todo: TodoListItem | null;
  isOpen: boolean;
  todoColumns: TodoColumnBasic[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", todo: TodoListItem): void;
  (e: "delete", todoId: string): void;
}>();

const { parseStableDate } = useStableDate();

const todoTitle = ref("");
const todoDescription = ref("");
const todoPriority = ref<Priority>("MEDIUM");
const todoDueDate = ref<DateValue | null>(null);
const todoColumnId = ref<string | undefined>(undefined);
const todoError = ref<string | null>(null);

const priorityOptions = [
  { label: "Low", value: "LOW" },
  { label: "Medium", value: "MEDIUM" },
  { label: "High", value: "HIGH" },
  { label: "Urgent", value: "URGENT" },
];

watch(() => [props.isOpen, props.todo], ([isOpen, todo]) => {
  if (isOpen) {
    resetForm();
    if (todo && typeof todo === "object") {
      if ("name" in todo) {
        todoTitle.value = todo.name || "";
        todoDescription.value = todo.description || "";
        todoPriority.value = todo.priority || "MEDIUM";
        if (todo.dueDate) {
          const date = todo.dueDate instanceof Date ? todo.dueDate : parseStableDate(todo.dueDate);
          todoDueDate.value = parseDate(date.toISOString().split("T")[0]!);
        }
      }
      if ("todoColumnId" in todo) {
        todoColumnId.value = todo.todoColumnId || undefined;
      }
    }
  }
}, { immediate: true });

function resetForm() {
  todoTitle.value = "";
  todoDescription.value = "";
  todoPriority.value = "MEDIUM";
  todoDueDate.value = null;
  todoColumnId.value = undefined;
  todoError.value = null;
}

function handleSave() {
  if (!todoTitle.value.trim()) {
    todoError.value = "Title is required";
    return;
  }

  if (!todoColumnId.value && props.todoColumns.length > 0) {
    todoError.value = "Please select a column";
    return;
  }

  const todoData = {
    id: props.todo?.id,
    name: todoTitle.value.trim(),
    description: todoDescription.value.trim() || null,
    priority: todoPriority.value,
    dueDate: todoDueDate.value
      ? (() => {
          const date = todoDueDate.value!.toDate(getLocalTimeZone());
          date.setHours(23, 59, 59, 999);
          return date;
        })()
      : null,
    todoColumnId: todoColumnId.value || (props.todoColumns.length > 0 ? props.todoColumns[0]?.id ?? undefined : undefined),
    checked: props.todo?.checked || false,
    order: props.todo?.order || 0,
  };

  emit("save", todoData as unknown as TodoListItem);
  resetForm();
  emit("close");
}

function handleDelete() {
  if (props.todo?.id) {
    emit("delete", props.todo.id);
    emit("close");
  }
}
</script>

<template>
  <GlobalDialog
    :is-open="isOpen"
    :title="todo?.id ? 'Edit Todo' : 'Add Todo'"
    :error="todoError"
    :show-delete="!!todo?.id"
    :save-label="todo?.id ? 'Update Todo' : 'Add Todo'"
    @close="emit('close')"
    @save="handleSave"
    @delete="handleDelete"
  >
    <div class="space-y-6">
      <div class="space-y-2">
        <label for="todo-title" class="block text-sm font-medium text-highlighted">Title</label>
        <UInput
          id="todo-title"
          v-model="todoTitle"
          placeholder="Todo title"
          class="w-full"
          :ui="{ base: 'w-full' }"
          autofocus
        />
      </div>

      <div class="space-y-2">
        <label for="todo-description" class="block text-sm font-medium text-highlighted">Description</label>
        <UTextarea
          id="todo-description"
          v-model="todoDescription"
          placeholder="Todo description (optional)"
          :rows="3"
          class="w-full"
          :ui="{ base: 'w-full' }"
        />
      </div>

      <div class="flex gap-4">
        <div class="w-1/2 space-y-2">
          <label for="todo-priority" class="block text-sm font-medium text-highlighted">Priority</label>
          <USelect
            id="todo-priority"
            v-model="todoPriority"
            :items="priorityOptions"
            option-attribute="label"
            value-attribute="value"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
        </div>

        <div class="w-1/2 space-y-2">
          <label class="block text-sm font-medium text-highlighted">Due Date</label>
          <UPopover>
            <UButton
              color="neutral"
              variant="subtle"
              icon="i-lucide-calendar"
              class="w-full justify-between"
            >
              <NuxtTime
                v-if="todoDueDate"
                :datetime="todoDueDate.toDate(getLocalTimeZone())"
                year="numeric"
                month="short"
                day="numeric"
              />
              <span v-else>No due date</span>
            </UButton>

            <template #content>
              <div class="p-2 space-y-2">
                <UButton
                  v-if="todoDueDate"
                  color="neutral"
                  variant="ghost"
                  class="w-full justify-start"
                  @click="todoDueDate = null"
                >
                  <template #leading>
                    <UIcon name="i-lucide-x" />
                  </template>
                  Clear due date
                </UButton>
                <UCalendar
                  :model-value="todoDueDate as unknown as DateValue"
                  class="p-2"
                  @update:model-value="todoDueDate = $event as CalendarDate"
                />
              </div>
            </template>
          </UPopover>
        </div>
      </div>
    </div>
  </GlobalDialog>
</template>
