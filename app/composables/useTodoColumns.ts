import { consola } from "consola";

import type { TodoColumn } from "~/types/database";

import { useAlertToast } from "~/composables/useAlertToast";
import { getErrorMessage } from "~/utils/error";
import { performOptimisticUpdate } from "~/utils/optimistic";

export function useTodoColumns() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  const { data: todoColumns } = useNuxtData<TodoColumn[]>("todo-columns");
  const { showError } = useAlertToast();

  const currentTodoColumns = computed(() => todoColumns.value || []);

  const fetchTodoColumns = async () => {
    loading.value = true;
    try {
      await refreshNuxtData("todo-columns");
      consola.debug("Use Todo Columns: Todo columns refreshed successfully");
    }
    catch (err) {
      error.value = getErrorMessage(err, "Failed to fetch todo columns");
      consola.error("Use Todo Columns: Failed to fetch todo columns:", err);
      throw err;
    }
    finally {
      loading.value = false;
    }
  };

  const createTodoColumn = async (columnData: {
    name: string;
    userId?: string;
    isDefault?: boolean;
  }) => {
    const previousColumns = todoColumns.value ? JSON.parse(JSON.stringify(todoColumns.value)) : [];
    const tempId = crypto.randomUUID();
    const newColumn: any = {
      id: tempId,
      name: columnData.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isDefault: columnData.isDefault ?? false,
      order: (todoColumns.value?.length || 0) + 1,
      userId: columnData.userId ?? null,
      user: null,
      _count: { todos: 0 },
    };

    try {
      const createdColumn = await performOptimisticUpdate(
        () => $fetch<TodoColumn>("/api/todo-columns", {
          method: "POST" as any,
          body: columnData,
        }),
        () => {
          if (todoColumns.value && Array.isArray(todoColumns.value)) {
            todoColumns.value.push(newColumn);
          }
        },
        () => {
          if (todoColumns.value) {
            todoColumns.value.splice(0, todoColumns.value.length, ...previousColumns);
          }
        },
      );

      if (todoColumns.value && Array.isArray(todoColumns.value)) {
        const tempIndex = todoColumns.value.findIndex((c: any) => c.id === tempId);
        if (tempIndex !== -1) {
          todoColumns.value[tempIndex] = createdColumn;
        }
      }

      error.value = null;
      return createdColumn;
    }
    catch (err) {
      error.value = getErrorMessage(err, "Failed to create todo column");
      showError("Error", error.value);
      throw err;
    }
  };

  const updateTodoColumn = async (columnId: string, updates: { name?: string }) => {
    const previousColumns = todoColumns.value ? JSON.parse(JSON.stringify(todoColumns.value)) : [];

    try {
      const updatedColumnFromResponse = await performOptimisticUpdate(
        () => $fetch<TodoColumn>(`/api/todo-columns/${columnId}`, {
          method: "PUT" as any,
          body: updates,
        } as any),
        () => {
          if (todoColumns.value && Array.isArray(todoColumns.value)) {
            const columnIndex = todoColumns.value.findIndex((c: TodoColumn) => c.id === columnId);
            if (columnIndex !== -1) {
              todoColumns.value[columnIndex] = { ...todoColumns.value[columnIndex], ...updates } as any;
            }
          }
        },
        () => {
          if (todoColumns.value) {
            todoColumns.value.splice(0, todoColumns.value.length, ...previousColumns);
          }
        },
      );

      // Reconciliation
      if (todoColumns.value && Array.isArray(todoColumns.value)) {
        const columnIndex = todoColumns.value.findIndex((c: TodoColumn) => c.id === columnId);
        if (columnIndex !== -1) {
          todoColumns.value[columnIndex] = updatedColumnFromResponse;
        }
      }

      error.value = null;
      return updatedColumnFromResponse;
    }
    catch (err) {
      error.value = getErrorMessage(err, "Failed to update todo column");
      showError("Error", error.value);
      throw err;
    }
  };

  const deleteTodoColumn = async (columnId: string) => {
    const previousColumns = todoColumns.value ? JSON.parse(JSON.stringify(todoColumns.value)) : [];

    try {
      return await performOptimisticUpdate(
        async () => {
          await $fetch(`/api/todo-columns/${columnId}`, {
            method: "DELETE" as any,
          } as any);
          return true;
        },
        () => {
          if (todoColumns.value && Array.isArray(todoColumns.value)) {
            const columnIndex = todoColumns.value.findIndex((c: any) => c.id === columnId);
            if (columnIndex !== -1) {
              todoColumns.value.splice(columnIndex, 1);
            }
          }
        },
        () => {
          if (todoColumns.value) {
            todoColumns.value.splice(0, todoColumns.value.length, ...previousColumns);
          }
        },
      );
    }
    catch (err) {
      error.value = getErrorMessage(err, "Failed to delete todo column");
      showError("Error", error.value);
      throw err;
    }
  };

  const reorderTodoColumns = async (fromIndex: number, toIndex: number) => {
    const previousColumns = todoColumns.value ? JSON.parse(JSON.stringify(todoColumns.value)) : [];
    if (fromIndex === toIndex)
      return;

    const columns = [...currentTodoColumns.value];
    const movedColumn = columns.splice(fromIndex, 1)[0];
    if (movedColumn) {
      columns.splice(toIndex, 0, movedColumn);
    }

    const updatedColumns = columns.map((column, index) => ({
      ...column,
      order: index,
    }));

    const reorders = updatedColumns.map(column => ({
      id: column.id,
      order: column.order,
    }));

    try {
      await performOptimisticUpdate(
        () => $fetch("/api/todo-columns/reorder", {
          method: "PUT" as any,
          body: { reorders },
        } as any),
        () => {
          if (todoColumns.value) {
            todoColumns.value.splice(0, todoColumns.value.length, ...updatedColumns as any);
          }
        },
        () => {
          if (todoColumns.value) {
            todoColumns.value.splice(0, todoColumns.value.length, ...previousColumns);
          }
        },
      );

      error.value = null;
    }
    catch (err) {
      error.value = getErrorMessage(err, "Failed to reorder todo columns");
      showError("Error", error.value);
      throw err;
    }
  };

  return {
    todoColumns: readonly(currentTodoColumns),
    loading: readonly(loading),
    error: readonly(error),
    fetchTodoColumns,
    createTodoColumn,
    updateTodoColumn,
    deleteTodoColumn,
    reorderTodoColumns,
  };
}
