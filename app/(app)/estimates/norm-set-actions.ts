"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/server/actor";
import { addNormSetTask } from "@/lib/data/norm-set-add";
import { checkNormTaskDraft, type NormTaskDraft, type NormTaskField } from "@/lib/estimates/norm-task-draft";
import type { NormSetTask } from "@/lib/data/estimate-presets";

export type AddNormTaskResult =
  | { ok: true; task: NormSetTask }
  | { ok: false; error?: string; errors?: Partial<Record<NormTaskField, string>> };

/**
 * Take-Off "ADD NEW": add one task to the firm's Norm Set and return it with its
 * real id, so the take-off row can link to it and the link survives a reload.
 *
 * Requires a signed-in, active member — without a session the tenant scope does
 * not apply and the task would land in no practice. The draft is checked again
 * here with the same rules the form ran.
 */
export async function addNormSetTaskAction(draft: NormTaskDraft): Promise<AddNormTaskResult> {
  try {
    await requireActor();
    const check = checkNormTaskDraft(draft);
    if (!check.ok) return { ok: false, errors: check.errors };
    const task = await addNormSetTask(check.task);
    revalidatePath("/estimates");
    return { ok: true, task };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "The item could not be added." };
  }
}
