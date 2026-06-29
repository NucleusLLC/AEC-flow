"use server";

import { revalidatePath } from "next/cache";
import { createTask, updateTask, setTaskStatus, deleteTask } from "@/lib/data/tasks";
import type { TaskInput, TaskStatus } from "@/lib/data/tasks.types";

export type SaveTaskResult = { ok: true; id: string } | { ok: false; error: string };

export async function saveTask(mode: "new" | "edit", input: TaskInput): Promise<SaveTaskResult> {
  try {
    if (!input.title?.trim()) return { ok: false, error: "A task title is required." };
    const id = mode === "new" ? await createTask(input) : await updateTask(input);
    revalidatePath("/tasks");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save the task." };
  }
}

export async function moveTask(id: string, status: TaskStatus): Promise<{ ok: boolean }> {
  try {
    await setTaskStatus(id, status);
    revalidatePath("/tasks");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function removeTask(id: string): Promise<{ ok: boolean }> {
  try {
    await deleteTask(id);
    revalidatePath("/tasks");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
