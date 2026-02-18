import { consola } from "consola";

import type { CreateTodoInput, Todo, TodoWithOrder, UpdateTodoInput } from "~/types/database";

import { useAlertToast } from "~/composables/useAlertToast";
import { getErrorMessage } from "~/utils/error";
import { performOptimisticUpdate } from "~/utils/optimistic";

export function useTodos() {
  const loading = ref(false);
  const error = ref<string | null>(null);

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
    const previousTodos = todos.value ? JSON.parse(JSON.stringify(todos.value)) : [];
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
      todoColumn: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any; // Cast because todoColumn expects full object or null

    try {
      const createdTodo = await performOptimisticUpdate(
        () => $fetch<TodoWithOrder>("/api/todos", {
          method: "POST" as any,
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
    const previousTodos = todos.value ? JSON.parse(JSON.stringify(todos.value)) : [];

    try {
      const updatedTodoFromResponse = await performOptimisticUpdate(
        () => $fetch<TodoWithOrder>(`/api/todos/${id}`, {
          method: "PUT" as any,
          body: updates,
        } as any),
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
    const previousTodos = todos.value ? JSON.parse(JSON.stringify(todos.value)) : [];

    try {
      return await performOptimisticUpdate(
        async () => {
          await $fetch(`/api/todos/${id}`, {
            method: "DELETE" as any,
          } as any);
          return true;
        },
        () => {
          if (todos.value && Array.isArray(todos.value)) {
            const updatedTodos = todos.value.filter((t: Todo) => t.id !== id);
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
      const message = getErrorMessage(err, "Failed to delete todo");
      showError("Error", message);
      throw err;
    }
  };

  const reorderTodo = async (todoId: string, direction: "up" | "down", todoColumnId: string | null) => {
    const previousTodos = todos.value ? JSON.parse(JSON.stringify(todos.value)) : [];
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
          method: "POST" as any,
          body: { todoId, direction, todoColumnId },
        } as any),
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

      // Reconciliation
      await refreshNuxtData("todos");
    }
    catch (err) {
      const message = getErrorMessage(err, "Failed to reorder todo");
      showError("Error", message);
      throw err;
    }
  };

  const clearCompleted = async (columnId: string) => {
    const previousTodos = todos.value ? JSON.parse(JSON.stringify(todos.value)) : [];

    try {
      await performOptimisticUpdate(
        () => $fetch(`/api/todo-columns/${columnId}/todos/clear-completed`, {
          method: "POST" as any,
          body: { action: "delete" },
        } as any),
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
