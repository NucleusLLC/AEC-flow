"use server";

import { revalidatePath } from "next/cache";
import { createTeamMember, updateTeamMember } from "@/lib/data/team";
import { logActivity, getActivityActorId } from "@/lib/data/activity";
import type { TeamMemberWriteInput } from "@/lib/data/team.types";

export type SaveTeamMemberResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Persist a team member (create or update) and revalidate the affected routes.
 * Returns a tagged result so the client form can redirect on success or show the
 * error inline on failure — never throws to the client.
 */
export async function saveTeamMember(
  mode: "new" | "edit",
  input: TeamMemberWriteInput,
): Promise<SaveTeamMemberResult> {
  try {
    const id =
      mode === "new" ? await createTeamMember(input) : await updateTeamMember(input);
    revalidatePath("/team");
    revalidatePath(`/team/${id}`);
    const actorId = await getActivityActorId();
    if (actorId) {
      await logActivity({
        userId: actorId,
        action: mode === "new" ? "created" : "updated",
        entityType: "team member",
        entityId: id,
        meta: input.name ? { label: input.name } : undefined,
      });
    }
    return { ok: true, id };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Failed to save team member.";
    return { ok: false, error };
  }
}
