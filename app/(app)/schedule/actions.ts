"use server";

import { revalidatePath } from "next/cache";
import { saveSchedule, type SaveScheduleInput } from "@/lib/data/schedule-db";

export type SaveScheduleResult = { ok: true; id: string } | { ok: false; error: string };

/** Persist a project's full Gantt programme (tasks + dependencies), then revalidate. */
export async function saveScheduleAction(input: SaveScheduleInput): Promise<SaveScheduleResult> {
  if (!input.projectId) return { ok: false, error: "Missing project id." };
  try {
    const { id } = await saveSchedule(input);
    revalidatePath("/schedule");
    revalidatePath(`/print/schedule/${input.projectId}`);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save the schedule." };
  }
}
