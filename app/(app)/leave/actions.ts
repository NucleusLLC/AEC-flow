"use server";

import { revalidatePath } from "next/cache";
import { createLeaveRequest, updateLeaveRequest } from "@/lib/data/leave";
import { logActivity, getActivityActorId } from "@/lib/data/activity";
import type { LeaveWriteInput } from "@/lib/data/leave.types";

export type SaveLeaveResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Persist a leave request (create or update) and revalidate the leave overview.
 * Returns a tagged result so the client form can redirect on success or show the
 * error inline on failure — never throws to the client.
 */
export async function saveLeaveRequest(
  mode: "new" | "edit",
  input: LeaveWriteInput,
): Promise<SaveLeaveResult> {
  try {
    const id =
      mode === "new" ? await createLeaveRequest(input) : await updateLeaveRequest(input);
    revalidatePath("/leave");
    const userId = await getActivityActorId();
    if (userId) {
      await logActivity({
        userId,
        action: mode === "new" ? "created" : "updated",
        entityType: "leave request",
        entityId: id,
      });
    }
    return { ok: true, id };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Failed to save leave request.";
    return { ok: false, error };
  }
}
