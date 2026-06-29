/** Tasks module — client-safe types + labels (no Prisma import). */

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export const TASK_STATUSES: readonly TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"] as const;
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
};

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export const TASK_PRIORITIES: readonly TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export type TaskItem = {
  id: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assignee: string | null;
  createdAt: string;
};

export type TaskInput = {
  id?: string;
  title: string;
  notes?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  assignee?: string | null;
};
