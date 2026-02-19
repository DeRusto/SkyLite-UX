import { consola } from "consola";

import type { CreateTodoInput, Todo, TodoWithOrder, UpdateTodoInput } from "~/types/database";

import { useAlertToast } from "~/composables/useAlertToast";
import { getErrorMessage } from "~/utils/error";
import { performOptimisticUpdate } from "~/utils/optimistic";

export function useTodos() {
  const loading = useState<boolean>("todos-loading", () => false);
  const error = useState<string | null>("todos-error", () => null);

  const { data: todos } = useNuxtData<TodoWithOrder[]>("todos");
  const { showError } = useAlertToast();

  const currentTodos = computed(() => todos.value || []);

  const fetchTodos = async () => {
    loading.value = true;
    error.value = null;
    try {
      await refreshNuxtData("todos");
      consola.debug("Use Todos: Todos refreshed successfully");
      return currentTodos.value;
    }
    catch (err) {
      error.value = getErrorMessage(err, "Failed to fetch todos");
      consola.error("Use Todos: Error fetching todos:", err);
      throw err;
    }
    finally {
      loading.value = false;
    }
  };

  const createTodo = async (todoData: CreateTodoInput) => {
    const previousTodos = structuredClone(todos.value ?? []);
    const tempId = crypto.randomUUID();

    const newTodo: TodoWithOrder = {
      id: tempId,
      title: todoData.title,
      description: todoData.description ?? null,
      priority: todoData.priority ?? "MEDIUM",
      dueDate: todoData.dueDate ?? null,
      completed: todoData.completed ?? false,
      order: todoData.order ?? 0,
      todoColumnId: todoData.todoColumnId ?? null,
      todoColumn: null, // Minimal stub for optimistic item
      createdAt: new Date().toISOString() as any, // Server returns ISO string, Prisma types say Date
      updatedAt: new Date().toISOString() as any,
    } as TodoWithOrder;

    try {
      const createdTodo = await performOptimisticUpdate(
        () => $fetch<TodoWithOrder>("/api/todos", {
          method: "POST",
          body: todoData,
        }),
        () => {
          if (todos.value && Array.isArray(todos.value)) {
            todos.value.push(newTodo);
          }
        },
        () => {
          if (todos.value) {
            todos.value.splice(0, todos.value.length, ...previousTodos);
          }
        },
      );

      if (todos.value && Array.isArray(todos.value)) {
        const tempIndex = todos.value.findIndex((t: Todo) => t.id === tempId);
        if (tempIndex !== -1) {
          todos.value[tempIndex] = createdTodo;
        }
      }

      return createdTodo;
    }
    catch (err) {
      const message = getErrorMessage(err, "Failed to create todo");
      showError("Error", message);
      throw err;
    }
  };

  const updateTodo = async (id: string, updates: UpdateTodoInput) => {
    const previousTodos = structuredClone(todos.value ?? []);

    try {
      const updatedTodoFromResponse = await performOptimisticUpdate(
        () => $fetch<TodoWithOrder>(`/api/todos/${id}`, {
          method: "PUT",
          body: updates,
        }),
        () => {
          if (todos.value && Array.isArray(todos.value)) {
            const todoIndex = todos.value.findIndex((t: Todo) => t.id === id);
            if (todoIndex !== -1) {
              todos.value[todoIndex] = { ...todos.value[todoIndex], ...updates } as any;
            }
          }
        },
        () => {
          if (todos.value) {
            todos.value.splice(0, todos.value.length, ...previousTodos);
          }
        },
      );

      // Reconciliation
      if (todos.value && Array.isArray(todos.value)) {
        const todoIndex = todos.value.findIndex((t: Todo) => t.id === id);
        if (todoIndex !== -1) {
          todos.value[todoIndex] = updatedTodoFromResponse;
        }
      }

      return updatedTodoFromResponse;
    }
    catch (err) {
      const message = getErrorMessage(err, "Failed to update todo");
      showError("Error", message);
      throw err;
    }
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    return updateTodo(id, { completed });
  };

  const deleteTodo = async (id: string) => {
    const previousTodos = structuredClone(todos.value ?? []);

    try {
      return await performOptimisticUpdate(
        async () => {
          await $fetch(`/api/todos/${id}`, {
            method: "DELETE" as any,
          });
          return true;
        },
        () => {
          if (todos.value && Array.isArray(todos.value)) {
            const index = todos.value.findIndex(t => t.id === id);
            if (index !== -1) {
              todos.value.splice(index, 1);
            }
          }
        },
        () => {
          if (todos.value) {
            todos.value.splice(0, todos.value.length, ...previousTodos);
          }
        },
      );
    }
    catch (err) {
      const message = getErrorMessage(err, "Failed to delete todo");
      showError("Error", message);
      throw err;
    }
  };

  const reorderTodo = async (todoId: string, direction: "up" | "down", todoColumnId: string | null) => {
    const previousTodos = structuredClone(todos.value ?? []);
    try {
      const currentTodo = currentTodos.value.find(t => t.id === todoId);
      if (!currentTodo)
        return;

      const sameSectionTodos = currentTodos.value
        .filter(t =>
          t.todoColumnId === todoColumnId
          && t.completed === currentTodo.completed,
        )
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      const currentIndex = sameSectionTodos.findIndex(t => t.id === todoId);
      if (currentIndex === -1)
        return;

      let targetIndex;
      if (direction === "up" && currentIndex > 0) {
        targetIndex = currentIndex - 1;
      }
      else if (direction === "down" && currentIndex < sameSectionTodos.length - 1) {
        targetIndex = currentIndex + 1;
      }
      else {
        return;
      }

      const targetTodo = sameSectionTodos[targetIndex];
      if (!targetTodo)
        return;

      await performOptimisticUpdate(
        () => $fetch("/api/todos/reorder", {
          method: "POST",
          body: { todoId, direction, todoColumnId },
        }),
        () => {
          if (todos.value && Array.isArray(todos.value)) {
            const currentTodoInCache = todos.value.find(t => t.id === todoId);
            const targetTodoInCache = todos.value.find(t => t.id === targetTodo.id);
            if (currentTodoInCache && targetTodoInCache) {
              const tempOrder = currentTodoInCache.order;
              currentTodoInCache.order = targetTodoInCache.order;
              targetTodoInCache.order = tempOrder;
            }
          }
        },
        () => {
          if (todos.value) {
            todos.value.splice(0, todos.value.length, ...previousTodos);
          }
        },
      );

      // We still need to refresh because reorder on server might affect more than just two items
      // but we do it after the optimistic update has finished.
      await refreshNuxtData("todos");
    }
    catch (err) {
      const message = getErrorMessage(err, "Failed to reorder todo");
      showError("Error", message);
      throw err;
    }
  };

  const clearCompleted = async (columnId: string) => {
    const previousTodos = structuredClone(todos.value ?? []);

    try {
      await performOptimisticUpdate(
        () => $fetch(`/api/todo-columns/${columnId}/todos/clear-completed`, {
          method: "POST",
          body: { action: "delete" },
        }),
        () => {
          if (todos.value && Array.isArray(todos.value)) {
            const updatedTodos = todos.value.filter((t: Todo) => !(t.todoColumnId === columnId && t.completed));
            todos.value.splice(0, todos.value.length, ...updatedTodos);
          }
        },
        () => {
          if (todos.value) {
            todos.value.splice(0, todos.value.length, ...previousTodos);
          }
        },
      );
    }
    catch (err) {
      const message = getErrorMessage(err, "Failed to clear completed todos");
      showError("Error", message);
      throw err;
    }
  };

  return {
    todos: readonly(currentTodos),
    loading: readonly(loading),
    error: readonly(error),
    fetchTodos,
    createTodo,
    updateTodo,
    toggleTodo,
    deleteTodo,
    reorderTodo,
    clearCompleted,
  };
}
