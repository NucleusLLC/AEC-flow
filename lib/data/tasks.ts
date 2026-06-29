/**
 * Tasks data-access layer (Prisma-backed). SERVER-ONLY — imports @/lib/db;
 * client components use ./tasks.types.
 */
import { prisma } from "@/lib/db";

export * from "./tasks.types";
import type { TaskInput, TaskItem, TaskStatus } from "./tasks.types";

function ymd(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

type TaskRow = {
  id: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  dueDate: Date | null;
  assignee: string | null;
  createdAt: Date;
};

function toItem(t: TaskRow): TaskItem {
  return {
    id: t.id,
    title: t.title,
    notes: t.notes,
    status: t.status,
    priority: t.priority,
    dueDate: ymd(t.dueDate),
    assignee: t.assignee,
    createdAt: t.createdAt.toISOString(),
  };
}

export async function getTasks(): Promise<TaskItem[]> {
  try {
    const rows = await prisma.task.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return rows.map(toItem);
  } catch (e) {
    console.error("[tasks] getTasks failed; returning empty list:", e);
    return [];
  }
}

export async function createTask(input: TaskInput): Promise<string> {
  const title = input.title.trim();
  if (!title) throw new Error("A task title is required.");
  const created = await prisma.task.create({
    data: {
      title,
      notes: input.notes?.trim() || null,
      status: input.status ?? "TODO",
      priority: input.priority ?? "MEDIUM",
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      assignee: input.assignee?.trim() || null,
    },
    select: { id: true },
  });
  return created.id;
}

export async function updateTask(input: TaskInput): Promise<string> {
  if (!input.id) throw new Error("Task id is required to update.");
  const title = input.title.trim();
  if (!title) throw new Error("A task title is required.");
  await prisma.task.update({
    where: { id: input.id },
    data: {
      title,
      notes: input.notes?.trim() || null,
      status: input.status ?? undefined,
      priority: input.priority ?? undefined,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      assignee: input.assignee?.trim() || null,
    },
  });
  return input.id;
}

export async function setTaskStatus(id: string, status: TaskStatus): Promise<void> {
  await prisma.task.update({ where: { id }, data: { status } });
}

export async function deleteTask(id: string): Promise<void> {
  await prisma.task.delete({ where: { id } });
}
