import { consola } from "consola";

import type { Todo, TodoColumn, TodoListItem } from "~/types/database";

import { useAlertToast } from "~/composables/useAlertToast";

export function useTodoHandlers() {
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

  const isLoadingTodos = computed(() => todosLoading.value || columnsLoading.value);

  const editingTodoAsListItem = computed(() => {
    if (!editingTodo.value)
      return null;
    return {
      ...editingTodo.value,
      name: editingTodo.value.title,
      checked: editingTodo.value.completed,
      notes: editingTodo.value.description,
    } as any;
  });

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

  return {
    todos,
    todoColumns,
    isLoadingTodos,
    isReordering,
    columnDialog,
    todoDialog,
    editingColumn,
    editingTodo,
    selectedColumnId,
    openCreateColumn,
    openEditColumn,
    openCreateTodo,
    openEditTodo,
    handleColumnSave,
    handleColumnDelete,
    editingTodoAsListItem,
    handleTodoSave,
    handleTodoDelete,
    handleTodoToggle,
    handleColumnReorder,
    handleTodoReorder,
    handleTodoMove,
  };
}
