import type { Todo, TodoColumn } from "./database";

export type TodoListProps = {
  columns: readonly TodoColumn[];
  todos: readonly Todo[];
  loading: boolean;
};

export type TodoPayload = {
  id?: string;
  name: string;
  description: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate: Date | null;
  todoColumnId?: string;
  checked: boolean;
  order: number;
};
