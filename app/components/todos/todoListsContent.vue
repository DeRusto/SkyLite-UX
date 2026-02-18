<script setup lang="ts">
import { consola } from "consola";

import type { BaseListItem, Todo, TodoColumn, TodoList, TodoListItem } from "~/types/database";
import type { TodoListWithIntegration } from "~/types/ui";

import GlobalFloatingActionButton from "~/components/global/globalFloatingActionButton.vue";
import GlobalList from "~/components/global/globalList.vue";
import TodoColumnDialog from "~/components/todos/todoColumnDialog.vue";
import TodoItemDialog from "~/components/todos/todoItemDialog.vue";
import { useAlertToast } from "~/composables/useAlertToast";
import { useStableDate } from "~/composables/useStableDate";
import { useTodoColumns } from "~/composables/useTodoColumns";
import { useTodos } from "~/composables/useTodos";
import { getErrorMessage } from "~/utils/error";

const { showSuccess } = useAlertToast();
const { parseStableDate } = useStableDate();

const { data: todoColumns } = useNuxtData<TodoColumn[]>("todo-columns");
const { data: todos } = useNuxtData<Todo[]>("todos");
const { updateTodo, createTodo, deleteTodo, toggleTodo, reorderTodo, clearCompleted, loading: todosLoading } = useTodos();
const { updateTodoColumn, createTodoColumn, deleteTodoColumn, reorderTodoColumns, loading: columnsLoading } = useTodoColumns();

const mutableTodoColumns = computed(() => todoColumns.value?.map(col => ({
  ...col,
  user: col.user === null
    ? undefined
    : {
        id: col.user.id,
        name: col.user.name,
        avatar: col.user.avatar,
      },
})) || []);

const todoItemDialog = ref(false);
const todoColumnDialog = ref(false);
const editingTodo = ref<TodoListItem | null>(null);
const editingColumn = ref<TodoList | null>(null);
const reorderingTodos = ref(new Set<string>());
const reorderingColumns = ref(new Set<string>());

const editingTodoTyped = computed<TodoListItem | undefined>(() =>
  editingTodo.value as TodoListItem | undefined,
);

const todoLists = computed<TodoListWithIntegration[]>(() => {
  if (!todoColumns.value || !todos.value)
    return [];

  return todoColumns.value.map(column => ({
    id: column.id,
    name: column.name,
    order: column.order,
    createdAt: parseStableDate(column.createdAt),
    updatedAt: parseStableDate(column.updatedAt),
    isDefault: column.isDefault,
    source: "native" as const,
    items: todos.value!
      .filter(todo => todo.todoColumnId === column.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(todo => ({
        id: todo.id,
        name: todo.title,
        checked: todo.completed,
        order: todo.order,
        notes: todo.description,
        shoppingListId: todo.todoColumnId || "",
        priority: todo.priority,
        dueDate: todo.dueDate,
        description: todo.description ?? "",
        todoColumnId: todo.todoColumnId || "",
      })),
    _count: column._count ? { items: column._count.todos } : undefined,
  }));
});

function openCreateTodo(todoColumnId?: string) {
  editingTodo.value = { todoColumnId: todoColumnId ?? "" } as TodoListItem;
  todoItemDialog.value = true;
}

function openEditTodo(item: BaseListItem) {
  if (!todos.value)
    return;
  const todo = todos.value.find(t => t.id === item.id);
  if (!todo)
    return;

  editingTodo.value = {
    id: todo.id,
    name: todo.title,
    description: todo.description ?? "",
    priority: todo.priority,
    dueDate: todo.dueDate ? parseStableDate(todo.dueDate) : null,
    todoColumnId: todo.todoColumnId ?? "",
    checked: todo.completed,
    order: todo.order,
    shoppingListId: todo.todoColumnId || "",
    notes: todo.description,
  };
  todoItemDialog.value = true;
}

async function handleTodoSave(todoData: TodoListItem) {
  try {
    if (editingTodo.value?.id) {
      await updateTodo(editingTodo.value.id, {
        title: todoData.name,
        description: todoData.description,
        priority: todoData.priority,
        dueDate: todoData.dueDate,
        completed: todoData.checked,
        order: todoData.order,
        todoColumnId: todoData.todoColumnId,
      });
    }
    else {
      await createTodo({
        title: todoData.name,
        description: todoData.description,
        priority: todoData.priority,
        dueDate: todoData.dueDate,
        completed: todoData.checked,
        order: todoData.order,
        todoColumnId: todoData.todoColumnId,
      });
    }

    const wasEdit = Boolean(editingTodo.value?.id);
    todoItemDialog.value = false;
    editingTodo.value = null;
    showSuccess("Todo Saved", wasEdit ? "Todo updated successfully" : "Todo created successfully");
  }
  catch (err) {
    consola.error("Todo Lists: Failed to save todo:", getErrorMessage(err));
  }
}

async function handleTodoDelete(todoId: string) {
  try {
    await deleteTodo(todoId);
    consola.debug("Todo Lists: Todo deleted successfully");
    showSuccess("Todo Deleted", "Todo has been removed successfully");
    todoItemDialog.value = false;
    editingTodo.value = null;
  }
  catch (err) {
    consola.error("Todo Lists: Failed to delete todo:", getErrorMessage(err));
  }
}

async function handleColumnSave(columnData: { name: string }) {
  try {
    if (editingColumn.value?.id) {
      await updateTodoColumn(editingColumn.value.id, columnData);
    }
    else {
      await createTodoColumn(columnData);
    }

    const wasEdit = Boolean(editingColumn.value?.id);
    todoColumnDialog.value = false;
    editingColumn.value = null;
    showSuccess("Column Saved", wasEdit ? "Column updated successfully" : "Column created successfully");
  }
  catch (err) {
    consola.error("Todo Lists: Failed to save todo column:", getErrorMessage(err));
  }
}

async function handleColumnDelete(columnId: string) {
  try {
    await deleteTodoColumn(columnId);
    consola.debug("Todo Lists: Todo column deleted successfully");
    showSuccess("Column Deleted", "Column has been removed successfully");
    todoColumnDialog.value = false;
    editingColumn.value = null;
  }
  catch (err) {
    consola.error("Todo Lists: Failed to delete todo column:", getErrorMessage(err));
  }
}

async function handleReorderColumn(columnIndex: number, direction: "left" | "right") {
  if (!todoColumns.value)
    return;

  const column = todoColumns.value[columnIndex];
  if (!column)
    return;

  if (reorderingColumns.value.has(column.id))
    return;

  const targetIndex = direction === "left" ? columnIndex - 1 : columnIndex + 1;

  if (targetIndex < 0 || targetIndex >= todoColumns.value.length)
    return;

  reorderingColumns.value.add(column.id);

  try {
    await reorderTodoColumns(columnIndex, targetIndex);
    consola.debug("Todo Lists: Column reordered successfully");
  }
  catch (err) {
    consola.error("Todo Lists: Failed to reorder column:", getErrorMessage(err));
  }
  finally {
    reorderingColumns.value.delete(column.id);
  }
}

async function handleReorderTodo(itemId: string, direction: "up" | "down") {
  if (reorderingTodos.value.has(itemId))
    return;
  reorderingTodos.value.add(itemId);

  try {
    if (!todos.value)
      throw new Error("Todos not loaded");
    const item = todos.value.find(t => t.id === itemId);
    if (!item)
      throw new Error("Todo not found");

    await reorderTodo(itemId, direction, item.todoColumnId ?? null);
    consola.debug("Todo Lists: Todo reordered successfully");
  }
  catch (err) {
    consola.error("Todo Lists: Failed to reorder todo:", getErrorMessage(err));
  }
  finally {
    reorderingTodos.value.delete(itemId);
  }
}

async function handleClearCompleted(columnId: string) {
  try {
    await clearCompleted(columnId);
    consola.debug("Todo Lists: Completed todos cleared successfully");
    showSuccess("Completed Cleared", "Completed todos have been removed");
  }
  catch (err) {
    consola.error("Todo Lists: Failed to clear completed todos:", getErrorMessage(err));
  }
}

function openEditColumn(column: TodoListWithIntegration) {
  editingColumn.value = { ...column };
  todoColumnDialog.value = true;
}

async function handleToggleTodo(itemId: string, completed: boolean) {
  try {
    await toggleTodo(itemId, completed);
    consola.debug("Todo Lists: Todo toggled successfully");
  }
  catch (err) {
    consola.error("Todo Lists: Failed to toggle todo:", getErrorMessage(err));
  }
}
</script>

<template>
  <div class="flex h-full w-full flex-col">
    <div class="flex-1 overflow-y-auto p-4">
      <GlobalList
        :lists="todoLists"
        :loading="columnsLoading || todosLoading"
        empty-state-icon="i-lucide-list-todo"
        empty-state-title="No todo lists found"
        empty-state-description="Create your first todo column to get started"
        show-reorder
        :show-edit="(list) => 'isDefault' in list ? !list.isDefault : true"
        show-add
        show-edit-item
        show-completed
        show-progress
        show-integration-icons
        @create="todoColumnDialog = true; editingColumn = null"
        @edit="openEditColumn($event as TodoListWithIntegration)"
        @add-item="openCreateTodo($event)"
        @edit-item="openEditTodo($event)"
        @toggle-item="handleToggleTodo"
        @reorder-item="handleReorderTodo"
        @reorder-list="(listId, direction) => handleReorderColumn(todoLists.findIndex(l => l.id === listId), direction === 'up' ? 'left' : 'right')"
        @clear-completed="handleClearCompleted"
      />
    </div>

    <GlobalFloatingActionButton
      icon="i-lucide-plus"
      label="Add new todo column"
      color="primary"
      size="lg"
      position="bottom-right"
      @click="todoColumnDialog = true; editingColumn = null"
    />

    <TodoItemDialog
      :is-open="todoItemDialog"
      :todo-columns="mutableTodoColumns"
      :todo="editingTodoTyped || null"
      @close="todoItemDialog = false; editingTodo = null"
      @save="handleTodoSave"
      @delete="handleTodoDelete"
    />

    <TodoColumnDialog
      :is-open="todoColumnDialog"
      :column="editingColumn ?? undefined"
      @close="todoColumnDialog = false; editingColumn = null"
      @save="handleColumnSave"
      @delete="handleColumnDelete"
    />
  </div>
</template>
