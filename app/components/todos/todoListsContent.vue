<script setup lang="ts">
import { consola } from "consola";

import type { Todo, TodoColumn } from "~/types/database";

const props = defineProps<{
  columns: TodoColumn[];
  todos: Todo[];
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: "addColumn"): void;
  (e: "editColumn", column: TodoColumn): void;
  (e: "reorderColumn", columnId: string, direction: "up" | "down"): void;
  (e: "addTodo", columnId: string): void;
  (e: "editTodo", todo: Todo): void;
  (e: "toggleTodo", todoId: string, completed: boolean): void;
  (e: "reorderTodo", todoId: string, direction: "up" | "down"): void;
  (e: "moveTodo", todoId: string, newColumnId: string): void;
}>();

function onDragStart(event: DragEvent, todo: Todo) {
  if (event.dataTransfer) {
    event.dataTransfer.setData("application/json", JSON.stringify(todo));
    event.dataTransfer.effectAllowed = "move";
  }
}

function onDrop(event: DragEvent, columnId: string) {
  event.preventDefault();
  const data = event.dataTransfer?.getData("application/json");
  if (data) {
    try {
      const todo = JSON.parse(data) as Todo;
      if (todo.todoColumnId !== columnId) {
        emit("moveTodo", todo.id, columnId);
      }
    }
    catch (err) {
      consola.error("Failed to parse dropped todo", err);
    }
  }
}

const getColumnTodos = (columnId: string) => {
  return props.todos.filter(todo => todo.todoColumnId === columnId);
};
</script>

<template>
  <div class="flex-1 overflow-x-auto overflow-y-hidden">
    <div class="flex h-full min-w-max p-4 gap-4 items-start">
      <div
        v-for="column in columns"
        :key="column.id"
        class="w-80 h-full flex flex-col bg-slate-50 dark:bg-slate-900 rounded-xl border border-default shadow-sm group/column"
        @dragover.prevent
        @drop="onDrop($event, column.id)"
      >
        <div class="p-3 flex items-center justify-between border-b border-default bg-white/50 dark:bg-black/50 rounded-t-xl shrink-0">
          <div class="flex items-center gap-2 overflow-hidden">
            <h3 class="font-bold text-sm text-slate-700 dark:text-slate-300 truncate">
              {{ column.name }}
            </h3>
            <span class="px-2 py-0.5 rounded-full bg-slate-200/50 dark:bg-slate-800/50 text-[10px] font-bold text-slate-500 shrink-0">
              {{ getColumnTodos(column.id).length }}
            </span>
          </div>
          <div class="flex items-center gap-1 opacity-0 group-hover/column:opacity-100 transition-opacity">
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-arrow-left"
              size="xs"
              class="hidden sm:flex"
              :disabled="loading"
              @click="emit('reorderColumn', column.id, 'up')"
            />
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-arrow-right"
              size="xs"
              class="hidden sm:flex"
              :disabled="loading"
              @click="emit('reorderColumn', column.id, 'down')"
            />
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-pencil"
              size="xs"
              @click="emit('editColumn', column)"
            />
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-plus"
              size="xs"
              @click="emit('addTodo', column.id)"
            />
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar min-h-0">
          <div
            v-for="todo in getColumnTodos(column.id)"
            :key="todo.id"
            draggable="true"
            class="bg-white dark:bg-slate-800 p-3 rounded-lg border border-default shadow-sm hover:shadow-md hover:border-primary-500/50 transition-all cursor-grab active:cursor-grabbing group/todo"
            @dragstart="onDragStart($event, todo)"
          >
            <div class="flex items-start gap-3">
              <UCheckbox
                :model-value="todo.completed"
                class="mt-0.5"
                @update:model-value="(val) => emit('toggleTodo', todo.id, !!val)"
              />
              <div
                class="flex-1 min-w-0"
                @click="emit('editTodo', todo)"
              >
                <div
                  class="text-sm font-medium leading-tight mb-1 truncate"
                  :class="{ 'line-through text-slate-400': todo.completed }"
                >
                  {{ todo.title }}
                </div>
                <div
                  v-if="todo.description"
                  class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed"
                >
                  {{ todo.description }}
                </div>
              </div>
            </div>

            <div class="mt-2 flex items-center justify-end gap-1 opacity-0 group-hover/todo:opacity-100 transition-opacity h-6">
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-arrow-up"
                size="xs"
                :disabled="loading"
                @click.stop="emit('reorderTodo', todo.id, 'up')"
              />
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-arrow-down"
                size="xs"
                :disabled="loading"
                @click.stop="emit('reorderTodo', todo.id, 'down')"
              />
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-pencil"
                size="xs"
                @click.stop="emit('editTodo', todo)"
              />
            </div>
          </div>

          <button
            class="w-full py-2 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-400 hover:text-primary-500 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-950/20 transition-all flex items-center justify-center gap-1 group"
            @click="emit('addTodo', column.id)"
          >
            <UIcon
              name="i-lucide-plus"
              class="w-3.5 h-3.5"
            />
            Add Task
          </button>
        </div>
      </div>

      <button
        class="w-80 h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400 hover:text-primary-500 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-950/20 transition-all gap-2 group"
        @click="emit('addColumn')"
      >
        <div class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary-100 dark:group-hover:bg-primary-900 transition-colors">
          <UIcon
            name="i-lucide-plus"
            class="w-6 h-6"
          />
        </div>
        <span class="font-bold text-sm">Add New Column</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
}
</style>
