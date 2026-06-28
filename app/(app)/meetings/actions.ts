"use server";

import { revalidatePath } from "next/cache";
import { createMeeting, updateMeeting } from "@/lib/data/meetings";
import { logActivity, getActivityActorId } from "@/lib/data/activity";
import type { MeetingWriteInput } from "@/lib/data/meetings.types";

export type SaveMeetingResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Persist a meeting (create or update) and revalidate the affected routes.
 * Returns a tagged result so the client form can redirect on success or show
 * the error inline on failure — never throws to the client.
 */
export async function saveMeeting(
  mode: "new" | "edit",
  input: MeetingWriteInput,
): Promise<SaveMeetingResult> {
  try {
    const id = mode === "new" ? await createMeeting(input) : await updateMeeting(input);
    revalidatePath("/meetings");
    revalidatePath(`/meetings/${id}`);
    const userId = await getActivityActorId();
    if (userId) {
      await logActivity({
        userId,
        action: mode === "new" ? "created" : "updated",
        entityType: "meeting",
        entityId: id,
        projectId: input.projectId ?? null,
        meta: input.title ? { label: input.title } : undefined,
      });
    }
    return { ok: true, id };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Failed to save meeting.";
    return { ok: false, error };
  }
}
