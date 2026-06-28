"use server";

import { revalidatePath } from "next/cache";
import { createProposal, updateProposal } from "@/lib/data/proposals";
import { logActivity, getActivityActorId } from "@/lib/data/activity";
import type { ProposalWriteInput } from "@/lib/data/proposals.types";

export type SaveProposalResult =
  | { ok: true; ref: string }
  | { ok: false; error: string };

/**
 * Persist a proposal (create or update) and revalidate the affected routes.
 * Returns a tagged result so the client form can redirect on success or show
 * the error inline on failure — never throws to the client.
 */
export async function saveProposal(
  mode: "new" | "edit",
  input: ProposalWriteInput,
): Promise<SaveProposalResult> {
  try {
    const ref = mode === "new" ? await createProposal(input) : await updateProposal(input);
    revalidatePath("/proposals");
    revalidatePath(`/proposals/${ref}`);
    const userId = await getActivityActorId();
    if (userId) {
      await logActivity({
        userId,
        action: mode === "new" ? "created" : "updated",
        entityType: "proposal",
        entityId: ref,
        clientId: input.clientId ?? null,
        meta: input.title ? { label: input.title } : undefined,
      });
    }
    return { ok: true, ref };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Failed to save proposal.";
    return { ok: false, error };
  }
}
