"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createServiceProposal,
  updateServiceProposal,
  deleteServiceProposal,
  transitionStatus,
  issueServiceProposal,
  reviseServiceProposal,
  duplicateServiceProposal,
  getServiceProposal,
  ProposalNumberInUseError,
} from "@/lib/data/service-proposals";
import { parseServiceProposalInput } from "@/lib/proposals/schema/proposal";
import { assertCan, type ProposalActor } from "@/lib/proposals/permissions";
import { NUMBER_IN_USE_MESSAGE } from "@/lib/proposals/duplicate";
import type { ServiceProposalStatus } from "@/lib/proposals/engine/status";

export type SaveResult =
  | { ok: true; id: string; number: string }
  | { ok: false; error: string; fieldIssues?: { path: string; message: string }[] };

/**
 * Turn a rejected write into a response the form can render.
 *
 * A clashing proposal number comes back as an issue on the `number` PATH — the same shape zod
 * issues use — so the existing inline-error machinery in the form paints that one input red
 * without a special case or a toast.
 */
function saveFailure(e: unknown, fallback: string): SaveResult {
  if (e instanceof ProposalNumberInUseError) {
    return {
      ok: false,
      error: NUMBER_IN_USE_MESSAGE,
      fieldIssues: [{ path: "number", message: NUMBER_IN_USE_MESSAGE }],
    };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

/** The signed-in actor for permission checks. Falls back to VIEWER when unknown, so a missing
 *  session can only ever reduce privilege, never grant it. */
async function currentActor(): Promise<ProposalActor> {
  const session = await getServerSession(authOptions);
  return { role: session?.user?.role ?? "VIEWER", userId: session?.user?.id ?? null };
}

async function subjectStatus(id: string): Promise<ServiceProposalStatus | null> {
  const p = await getServiceProposal(id);
  return p?.status ?? null;
}

export async function createServiceProposalAction(data: unknown): Promise<SaveResult> {
  const actor = await currentActor();
  try {
    assertCan(actor, "create");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not permitted." };
  }
  const parsed = parseServiceProposalInput(data);
  if (!parsed.ok) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldIssues: parsed.issues };
  }
  try {
    const p = await createServiceProposal(parsed.value);
    revalidatePath("/design/service-proposals");
    return { ok: true, id: p.id, number: p.number };
  } catch (e) {
    return saveFailure(e, "Failed to create proposal.");
  }
}

export async function updateServiceProposalAction(id: string, data: unknown): Promise<SaveResult> {
  const actor = await currentActor();
  const status = await subjectStatus(id);
  try {
    assertCan(actor, "edit", status ? { status } : undefined);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not permitted." };
  }
  const parsed = parseServiceProposalInput(data);
  if (!parsed.ok) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldIssues: parsed.issues };
  }
  try {
    const p = await updateServiceProposal(id, parsed.value);
    revalidatePath("/design/service-proposals");
    revalidatePath(`/design/service-proposals/${id}`);
    return { ok: true, id: p.id, number: p.number };
  } catch (e) {
    return saveFailure(e, "Failed to update proposal.");
  }
}

export async function deleteServiceProposalAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const actor = await currentActor();
  const status = await subjectStatus(id);
  try {
    assertCan(actor, "delete", status ? { status } : undefined);
    await deleteServiceProposal(id);
    revalidatePath("/design/service-proposals");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete proposal." };
  }
}

export async function issueServiceProposalAction(id: string): Promise<SaveResult> {
  const actor = await currentActor();
  try {
    assertCan(actor, "issue");
    const p = await issueServiceProposal(id);
    revalidatePath("/design/service-proposals");
    revalidatePath(`/design/service-proposals/${id}`);
    return { ok: true, id: p.id, number: p.number };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to issue proposal." };
  }
}

export async function transitionServiceProposalAction(
  id: string,
  to: ServiceProposalStatus,
  reason?: string,
): Promise<SaveResult> {
  const actor = await currentActor();
  // Accepting and converting are separately gated; everything else needs at least edit rights.
  const action = to === "ACCEPTED" || to === "PARTIALLY_ACCEPTED" ? "accept" : to === "CONVERTED" ? "convert" : "issue";
  try {
    assertCan(actor, action);
    const p = await transitionStatus(id, to, reason);
    revalidatePath("/design/service-proposals");
    revalidatePath(`/design/service-proposals/${id}`);
    return { ok: true, id: p.id, number: p.number };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update status." };
  }
}

export async function reviseServiceProposalAction(id: string): Promise<SaveResult> {
  const actor = await currentActor();
  try {
    assertCan(actor, "create");
    const p = await reviseServiceProposal(id);
    revalidatePath("/design/service-proposals");
    return { ok: true, id: p.id, number: p.number };
  } catch (e) {
    return saveFailure(e, "Failed to revise proposal.");
  }
}

/**
 * Duplicate a proposal into a new draft.
 *
 * Gated on "create", not on a new privilege: duplicating produces a proposal, so anyone who may
 * create one may duplicate one. STAFF — the beta default — therefore keeps it, per the
 * permissive policy in lib/proposals/permissions.ts.
 */
export async function duplicateServiceProposalAction(id: string): Promise<SaveResult> {
  const actor = await currentActor();
  try {
    assertCan(actor, "create");
    const p = await duplicateServiceProposal(id);
    revalidatePath("/design/service-proposals");
    return { ok: true, id: p.id, number: p.number };
  } catch (e) {
    return saveFailure(e, "Failed to duplicate proposal.");
  }
}
