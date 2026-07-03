/**
 * Proposals data-access layer (placeholder — see lib/data/clients.ts for the
 * single-tenant -> SaaS hedge rationale). Swap bodies for Prisma later; call
 * sites stay unchanged.
 *
 * Client-safe types, label maps, and pure helpers live in ./proposals.types so
 * `"use client"` components can import them without dragging the Postgres driver
 * into the browser bundle. They are re-exported below so existing server-side
 * call sites (`@/lib/data/proposals`) keep working unchanged.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentCompanyId } from "@/lib/server/tenant";

export * from "./proposals.types";
import type {
  ProposalListItem,
  ProposalRecord,
  ProposalWriteInput,
} from "./proposals.types";

/** Render a DateTime column as a "YYYY-MM-DD" date string; null stays null. */
function ymd(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

type ProposalListPayload = Prisma.ProposalGetPayload<{
  include: { client: true; owner: true };
}>;

type ProposalRecordPayload = Prisma.ProposalGetPayload<{
  include: {
    client: true;
    owner: true;
    lineItems: true;
    milestones: true;
    order: true;
  };
}>;

function toListItem(p: ProposalListPayload): ProposalListItem {
  return {
    id: p.refNumber,
    refNumber: p.refNumber,
    title: p.title,
    clientName: p.client.name,
    owner: p.owner.name,
    status: p.status,
    revision: p.revision,
    totalFee: Number(p.totalFee),
    currency: p.currency,
    sentAt: ymd(p.sentAt),
    validUntil: ymd(p.validUntil),
    followUpDate: ymd(p.followUpDate),
    nextAction: p.nextAction,
    createdAt: ymd(p.createdAt) as string,
  };
}

function toRecord(p: ProposalRecordPayload): ProposalRecord {
  return {
    ...toListItem(p),
    clientId: p.client.id,
    scopeSummary: p.scopeSummary,
    exclusions: p.exclusions,
    assumptions: p.assumptions,
    terms: p.terms,
    estimatedDuration: p.estimatedDuration,
    approvedAt: ymd(p.approvedAt),
    lastContactDate: ymd(p.lastContactDate),
    followUpNotes: p.followUpNotes,
    orderNumber: p.order?.orderNumber ?? null,
    lineItems: p.lineItems.map((li) => ({
      id: li.id,
      description: li.description,
      discipline: li.discipline,
      amount: Number(li.amount),
      isOptional: li.isOptional,
      sortOrder: li.sortOrder,
    })),
    milestones: p.milestones.map((m) => ({
      id: m.id,
      name: m.name,
      percentage: m.percentage,
      dueWeek: m.dueWeek,
    })),
  };
}

export async function getProposals(): Promise<ProposalListItem[]> {
  const rows = await prisma.proposal.findMany({
    include: { client: true, owner: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toListItem);
}

/* ───────────────────────────────────────────────────────────────────────────
 * DETAIL LAYER  — added by [CC2] for the `/proposals/[id]` detail page.
 * ADDITIVE ONLY: everything above (list types + getProposals/summarizeProposals)
 * is untouched. The detail extras live in a separate map keyed by proposal id and
 * are merged onto the existing list row by getProposal(), so there is no second
 * source of truth for the shared fields. Swap PROPOSAL_DETAILS for a Prisma
 * `include: { lineItems, milestones }` query once Supabase is live.
 * ────────────────────────────────────────────────────────────────────────── */

export async function getProposal(id: string): Promise<ProposalRecord | null> {
  const row = await prisma.proposal.findFirst({
    where: { OR: [{ id }, { refNumber: id }] },
    include: {
      client: true,
      owner: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
      milestones: true,
      order: true,
    },
  });
  if (!row) return null;
  return toRecord(row);
}

/** Full records (list row + detail extras) — lets list/preview UIs render the
 *  complete proposal document without an extra round-trip per row. */
export async function getProposalRecords(): Promise<ProposalRecord[]> {
  const rows = await prisma.proposal.findMany({
    include: {
      client: true,
      owner: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
      milestones: true,
      order: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRecord);
}

/* ───────────────────────────────────────────────────────────────────────────
 * MUTATIONS — create/update. Called from the server action in
 * app/(app)/proposals/actions.ts. The single-tenant -> SaaS hedge lives here:
 * when multi-tenant, orgId scoping is added in these functions (and nowhere
 * else). The form submits the owner's display name; we resolve it to a userId.
 * ────────────────────────────────────────────────────────────────────────── */

async function resolveOwnerId(name: string): Promise<string> {
  // Resolve within the current company only (User isn't tenant-scoped by the extension).
  const companyId = await getCurrentCompanyId();
  const byName = await prisma.user.findFirst({ where: { name, companyId }, select: { id: true } });
  if (byName) return byName.id;
  // Fall back to a senior user in this company so a write never fails on an unmatched name.
  const fallback = await prisma.user.findFirst({
    where: { companyId },
    orderBy: { role: "asc" },
    select: { id: true },
  });
  if (!fallback) throw new Error("No users exist to assign as the proposal owner.");
  return fallback.id;
}

function lineItemCreates(input: ProposalWriteInput) {
  return input.lineItems
    .filter((li) => li.description.trim() !== "")
    .map((li) => ({
      description: li.description,
      discipline: li.discipline,
      amount: li.amount,
      isOptional: li.isOptional,
      sortOrder: li.sortOrder,
    }));
}

function milestoneCreates(input: ProposalWriteInput) {
  return input.milestones
    .filter((m) => m.name.trim() !== "")
    .map((m) => ({ name: m.name, percentage: m.percentage }));
}

function scalarData(input: ProposalWriteInput, ownerId: string) {
  return {
    title: input.title,
    clientId: input.clientId,
    ownerId,
    status: input.status,
    currency: input.currency,
    totalFee: input.totalFee,
    scopeSummary: input.scopeSummary || null,
    exclusions: input.exclusions || null,
    terms: input.terms || null,
    estimatedDuration: input.estimatedDuration,
    validUntil: input.validUntil ? new Date(input.validUntil) : null,
  } satisfies Partial<Prisma.ProposalUncheckedCreateInput>;
}

/** Create a new proposal with its line items + milestones. Returns the refNumber. */
export async function createProposal(input: ProposalWriteInput): Promise<string> {
  const ownerId = await resolveOwnerId(input.owner);
  await prisma.proposal.create({
    data: {
      refNumber: input.ref,
      ...scalarData(input, ownerId),
      lineItems: { create: lineItemCreates(input) },
      milestones: { create: milestoneCreates(input) },
    },
  });
  return input.ref;
}

/** Update an existing proposal; line items + milestones are replaced wholesale. */
export async function updateProposal(input: ProposalWriteInput): Promise<string> {
  const ownerId = await resolveOwnerId(input.owner);
  await prisma.$transaction(async (tx) => {
    const existing = await tx.proposal.findFirst({
      where: { OR: [{ id: input.ref }, { refNumber: input.ref }] },
      select: { id: true },
    });
    if (!existing) throw new Error(`Proposal ${input.ref} not found.`);
    await tx.proposalLineItem.deleteMany({ where: { proposalId: existing.id } });
    await tx.proposalMilestone.deleteMany({ where: { proposalId: existing.id } });
    await tx.proposal.update({
      where: { id: existing.id },
      data: {
        ...scalarData(input, ownerId),
        lineItems: { create: lineItemCreates(input) },
        milestones: { create: milestoneCreates(input) },
      },
    });
  });
  return input.ref;
}
