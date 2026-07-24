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
  getServiceProposal,
} from "@/lib/data/service-proposals";
import { parseServiceProposalInput } from "@/lib/proposals/schema/proposal";
import { assertCan, type ProposalActor } from "@/lib/proposals/permissions";
import type { ServiceProposalStatus } from "@/lib/proposals/engine/status";

export type SaveResult =
  | { ok: true; id: string; number: string }
  | { ok: false; error: string; fieldIssues?: { path: string; message: string }[] };

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
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create proposal." };
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
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update proposal." };
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
    return { ok: false, error: e instanceof Error ? e.message : "Failed to revise proposal." };
  }
}
