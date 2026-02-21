<script setup lang="ts">
import { useTodoHandlers } from "~/composables/useTodoHandlers";

const {
  todos,
  todoColumns,
  isLoadingTodos,
  columnDialog,
  todoDialog,
  editingColumn,
  editingTodo,
  editingTodoAsListItem,
  selectedColumnId,
  openCreateColumn,
  openEditColumn,
  openCreateTodo,
  openEditTodo,
  handleColumnSave,
  handleColumnDelete,
  handleTodoSave,
  handleTodoDelete,
  handleTodoToggle,
  handleColumnReorder,
  handleTodoReorder,
  handleTodoMove,
} = useTodoHandlers();
</script>

<template>
  <div class="flex h-[calc(100vh-2rem)] w-full flex-col rounded-lg overflow-hidden">
    <div class="py-5 sm:px-4 shrink-0 bg-default border-b border-default z-40">
      <GlobalDateHeader />
    </div>

    <TodoListsContent
      :columns="todoColumns"
      :todos="todos"
      :loading="isLoadingTodos"
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
      :is-open="columnDialog"
      :column="editingColumn ?? undefined"
      @save="handleColumnSave"
      @delete="handleColumnDelete"
      @close="columnDialog = false; editingColumn = null"
    />

    <TodoItemDialog
      :is-open="todoDialog"
      :todo="editingTodoAsListItem"
      :todo-columns="todoColumns"
      @save="handleTodoSave"
      @delete="handleTodoDelete"
      @close="todoDialog = false; editingTodo = null; selectedColumnId = ''"
    />
  </div>
</template>
