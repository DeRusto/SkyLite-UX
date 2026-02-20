<script setup lang="ts">
import { consola } from "consola";

import type { Todo, TodoColumn, TodoListItem } from "~/types/database";

import { useAlertToast } from "~/composables/useAlertToast";

const {
  todos,
  loading: todosLoading,
  createTodo,
  updateTodo,
  deleteTodo,
  reorderTodo,
} = useTodos();

const {
  todoColumns,
  loading: columnsLoading,
  createTodoColumn,
  updateTodoColumn,
  deleteTodoColumn,
  reorderTodoColumns,
} = useTodoColumns();

const { showSuccess } = useAlertToast();

const isReordering = ref(false);
const columnDialog = ref(false);
const todoDialog = ref(false);
const editingColumn = ref<TodoColumn | null>(null);
const editingTodo = ref<Todo | null>(null);
const selectedColumnId = ref<string>("");

const isLoading = computed(() => todosLoading.value || columnsLoading.value);

function openCreateColumn() {
  editingColumn.value = null;
  columnDialog.value = true;
}

function openEditColumn(column: TodoColumn) {
  editingColumn.value = { ...column };
  columnDialog.value = true;
}

function openCreateTodo(columnId: string) {
  selectedColumnId.value = columnId;
  editingTodo.value = null;
  todoDialog.value = true;
}

function openEditTodo(todo: Todo) {
  editingTodo.value = { ...todo };
  todoDialog.value = true;
}

async function handleColumnSave(data: { name: string; order?: number }) {
  try {
    if (editingColumn.value) {
      await updateTodoColumn(editingColumn.value.id, data);
      showSuccess("Column Updated", "The column has been updated.");
    }
    else {
      await createTodoColumn(data);
      showSuccess("Column Created", "The column has been created.");
    }
  }
  catch (err) {
    consola.error("Failed to save column", err);
  }
  finally {
    columnDialog.value = false;
    editingColumn.value = null;
  }
}

async function handleColumnDelete(id: string) {
  try {
    await deleteTodoColumn(id);
    showSuccess("Column Deleted", "The column has been deleted.");
    columnDialog.value = false;
    editingColumn.value = null;
  }
  catch (err) {
    consola.error("Failed to delete column", err);
  }
}

async function handleTodoSave(data: TodoListItem) {
  try {
    const todoData = {
      title: data.name,
      description: data.description,
      todoColumnId: data.todoColumnId || selectedColumnId.value,
      priority: data.priority,
      dueDate: data.dueDate,
    };

    if (editingTodo.value) {
      await updateTodo(editingTodo.value.id, todoData);
      showSuccess("Todo Updated", "The task has been updated.");
    }
    else {
      await createTodo(todoData as any);
      showSuccess("Todo Created", "The task has been created.");
    }
  }
  catch (err) {
    consola.error("Failed to save todo", err);
  }
  finally {
    todoDialog.value = false;
    editingTodo.value = null;
    selectedColumnId.value = "";
  }
}

async function handleTodoDelete(id: string) {
  try {
    await deleteTodo(id);
    showSuccess("Todo Deleted", "The task has been deleted.");
    todoDialog.value = false;
    editingTodo.value = null;
  }
  catch (err) {
    consola.error("Failed to delete todo", err);
  }
}

async function handleTodoToggle(todoId: string, completed: boolean) {
  try {
    await updateTodo(todoId, { completed });
  }
  catch (err) {
    consola.error("Failed to toggle todo", err);
  }
}

async function handleColumnReorder(columnId: string, direction: "up" | "down") {
  if (isReordering.value)
    return;
  isReordering.value = true;
  try {
    const columnsArr = todoColumns.value;
    const currentIdx = columnsArr.findIndex(c => c.id === columnId);
    if (currentIdx === -1)
      return;
    const targetIdx = direction === "up" ? currentIdx - 1 : currentIdx + 1;
    if (targetIdx < 0 || targetIdx >= columnsArr.length)
      return;
    await reorderTodoColumns(currentIdx, targetIdx);
  }
  catch (err) {
    consola.error("Failed to reorder column", err);
  }
  finally {
    isReordering.value = false;
  }
}

async function handleTodoReorder(todoId: string, direction: "up" | "down") {
  if (isReordering.value)
    return;
  isReordering.value = true;
  try {
    const todo = todos.value.find(t => t.id === todoId);
    if (!todo)
      return;
    await reorderTodo(todoId, direction, todo.todoColumnId);
  }
  catch (err) {
    consola.error("Failed to reorder todo", err);
  }
  finally {
    isReordering.value = false;
  }
}

async function handleTodoMove(todoId: string, newColumnId: string) {
  try {
    await updateTodo(todoId, { todoColumnId: newColumnId });
  }
  catch (err) {
    consola.error("Failed to move todo", err);
  }
}
</script>

<template>
  <div class="flex h-[calc(100vh-2rem)] w-full flex-col rounded-lg overflow-hidden">
    <div class="py-5 sm:px-4 shrink-0 bg-default border-b border-default z-40">
      <GlobalDateHeader />
    </div>

    <TodoListsContent
      :columns="(todoColumns as any)"
      :todos="(todos as any)"
      :loading="isLoading"
      @add-column="openCreateColumn"
      @edit-column="openEditColumn"
      @reorder-column="handleColumnReorder"
      @add-todo="openCreateTodo"
      @edit-todo="openEditTodo"
      @toggle-todo="handleTodoToggle"
      @reorder-todo="handleTodoReorder"
      @move-todo="handleTodoMove"
    />

    <TodoColumnDialog
      v-model:is-open="columnDialog"
      :column="(editingColumn as any)"
      @save="handleColumnSave"
      @delete="handleColumnDelete"
      @close="columnDialog = false; editingColumn = null"
    />

    <TodoItemDialog
      :is-open="todoDialog"
      :todo="(editingTodo as any)"
      :todo-columns="(todoColumns as any)"
      @save="handleTodoSave"
      @delete="handleTodoDelete"
      @close="todoDialog = false; editingTodo = null; selectedColumnId = ''"
    />
  </div>
</template>
