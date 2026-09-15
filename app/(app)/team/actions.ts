"use server";

import { revalidatePath } from "next/cache";
import { createTeamMember, updateTeamMember } from "@/lib/data/team";
import { logActivity, getActivityActorId } from "@/lib/data/activity";
import { requireActor } from "@/lib/server/actor";
import { getMemberAccessSnapshot } from "@/lib/server/member-access";
import { checkMemberWrite } from "@/lib/team/member-write-policy";
import type { TeamMemberWriteInput, UserRole, UserStatus } from "@/lib/data/team.types";

export type SaveTeamMemberResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Persist a team member (create or update) and revalidate the affected routes.
 * Returns a tagged result so the client form can redirect on success or show the
 * error inline on failure — never throws to the client.
 *
 * Role, status and email are access fields: `checkMemberWrite` decides who may
 * change them, from the actor's and the target's DATABASE rows. On edit, any of
 * the three the payload leaves out is filled from the row, because the data
 * layer's defaults (role STAFF, status ACTIVE) would otherwise demote or
 * reactivate a member just by being omitted.
 */
export async function saveTeamMember(
  mode: "new" | "edit",
  input: TeamMemberWriteInput,
): Promise<SaveTeamMemberResult> {
  try {
    const actor = await requireActor();
    let payload = input;

    if (mode === "edit") {
      if (!input.id) return { ok: false, error: "A member id is required to update." };
      const target = await getMemberAccessSnapshot(actor.companyId, input.id);
      if (!target) return { ok: false, error: "That member is not in your company." };
      const decision = checkMemberWrite(actor, target, input);
      if (!decision.ok) return decision;
      payload = {
        ...input,
        role: input.role ?? (target.role as UserRole),
        status: input.status ?? (target.status as UserStatus),
        email: input.email || target.email,
      };
    } else {
      const decision = checkMemberWrite(actor, null, input);
      if (!decision.ok) return decision;
    }

    const id = mode === "new" ? await createTeamMember(payload) : await updateTeamMember(payload);
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
