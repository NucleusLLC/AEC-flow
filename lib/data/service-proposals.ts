/**
 * Service Proposal data-access. SERVER-ONLY.
 *
 * Additive and self-contained — it never touches the protected Estimates or Schedule
 * systems, and it is entirely separate from the Business Development `Proposal` family. All
 * models are tenant-scoped by the Prisma extension in lib/db.ts.
 *
 * Design rules enforced here:
 *   - The engine (lib/proposals/engine) is the ONLY source of monetary figures. The header's
 *     denormalised totals and every child's derived amount are written from its output; the
 *     client can never persist a total it computed itself.
 *   - Multi-row writes run inside prisma.$transaction, so a proposal is never half-saved.
 *   - An issued/accepted proposal is immutable: edits are refused at THIS layer, not only in
 *     the UI. Issuing snapshots the full computed proposal into an append-only version row.
 *   - Soft delete via deletedAt; list/get exclude soft-deleted rows.
 */
import "server-only";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { computeProposal } from "@/lib/proposals/engine/engine";
import { buildWriteData, nextProposalNumber } from "@/lib/proposals/persist";
import { getCurrentCompanyId } from "@/lib/server/tenant";
import { COST_BASIS_LABEL } from "@/lib/proposals/engine/types";
import {
  isLocked,
  isIssued,
  assertTransition,
  type ServiceProposalStatus,
} from "@/lib/proposals/engine/status";
import type { ServiceProposalInput } from "@/lib/proposals/schema/proposal";
import type {
  ServiceProposalDTO,
  ServiceProposalListItem,
  ServiceProposalSummary,
} from "@/lib/proposals/dto";
import type { Prisma } from "@prisma/client";

// ── Small helpers ─────────────────────────────────────────────────────────────

function num(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}
function numOrNull(v: Prisma.Decimal | number | null | undefined): number | null {
  return v == null ? null : num(v);
}
function ymd(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

async function actor(): Promise<{ id: string | null; name: string | null }> {
  const session = await getServerSession(authOptions);
  return { id: session?.user?.id ?? null, name: session?.user?.name ?? null };
}

type FullProposal = Prisma.ServiceProposalGetPayload<{
  include: {
    feeComponents: true;
    phases: true;
    paymentMilestones: true;
    reimbursables: true;
    discounts: true;
    taxes: true;
    developmentCostItems: true;
    disciplines: true;
  };
}>;

const FULL_INCLUDE = {
  feeComponents: { orderBy: { sortOrder: "asc" } },
  phases: { orderBy: { sortOrder: "asc" } },
  paymentMilestones: { orderBy: { sortOrder: "asc" } },
  reimbursables: { orderBy: { sortOrder: "asc" } },
  discounts: { orderBy: { sortOrder: "asc" } },
  taxes: { orderBy: { sortOrder: "asc" } },
  developmentCostItems: { orderBy: { sortOrder: "asc" } },
  disciplines: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.ServiceProposalInclude;

// ── Reconstruct the engine/form input from stored rows ────────────────────────

function toInput(p: FullProposal): ServiceProposalInput {
  return {
    title: p.title,
    kind: p.kind,
    status: p.status,
    clientId: p.clientId,
    clientName: p.clientName,
    projectId: p.projectId,
    projectName: p.projectName,
    contactName: p.contactName,
    contactEmail: p.contactEmail,
    contactTitle: p.contactTitle,
    currency: p.currency,
    languageCode: p.languageCode,
    taxJurisdiction: p.taxJurisdiction,
    costBasis: p.costBasisType
      ? {
          type: p.costBasisType,
          amount: numOrNull(p.costBasisAmount),
          sourceField: p.costBasisSourceField,
          sourceId: p.costBasisSourceId,
          worksheet: p.developmentCostItems.map((d) => ({
            category: d.category,
            amount: num(d.amount),
            includedInBasis: d.includedInBasis,
            isProfessionalFees: d.isProfessionalFees,
            notes: d.notes,
          })),
        }
      : null,
    feeComponents: p.feeComponents.map((c) => ({
      id: c.id,
      label: c.label,
      disciplineKey: c.disciplineKey,
      method: c.method,
      category: c.category,
      percent: numOrNull(c.percent),
      fixedAmount: numOrNull(c.fixedAmount),
      quantity: numOrNull(c.quantity),
      unitRate: numOrNull(c.unitRate),
      baseAmount: numOrNull(c.baseAmount),
      markupPercent: numOrNull(c.markupPercent),
      selected: c.selected,
      taxable: c.taxable,
      overrideAmount: numOrNull(c.overrideAmount),
      overrideReason: c.overrideReason,
    })),
    phases: p.phases.map((ph) => ({ id: ph.id, name: ph.name, percent: num(ph.percent) })),
    paymentMilestones: p.paymentMilestones.map((m) => ({
      id: m.id,
      name: m.name,
      trigger: m.trigger,
      percent: num(m.percent),
    })),
    reimbursables: p.reimbursables.map((r) => ({
      id: r.id,
      label: r.label,
      amount: num(r.amount),
      taxable: r.taxable,
    })),
    discounts: p.discounts.map((d) => ({
      id: d.id,
      label: d.label,
      type: d.type as "PERCENT" | "FIXED",
      value: num(d.value),
      reason: d.reason,
      visibleToClient: d.visibleToClient,
    })),
    taxes: p.taxes.map((t) => ({
      name: t.name,
      percent: num(t.percent),
      mode: t.mode,
      registrationNumber: t.registrationNumber,
    })),
    scopeSummary: p.scopeSummary,
    scopeItems: Array.isArray(p.scopeItems)
      ? (p.scopeItems as unknown[]).map((raw) => {
          const o = (raw ?? {}) as Record<string, unknown>;
          return {
            title: typeof o.title === "string" ? o.title : "",
            description: typeof o.description === "string" ? o.description : null,
            discipline: typeof o.discipline === "string" ? o.discipline : null,
            category: (o.category === "OPTIONAL" || o.category === "ADDITIONAL"
              ? o.category
              : "BASE") as "BASE" | "OPTIONAL" | "ADDITIONAL",
            included: o.included !== false,
          };
        })
      : [],
    exclusions: p.exclusions,
    assumptions: p.assumptions,
    terms: p.terms,
    estimatedWeeks: p.estimatedWeeks,
    showFeeDerivation: p.showFeeDerivation,
    validUntil: ymd(p.validUntil),
    notes: p.notes,
  };
}

function toDto(p: FullProposal): ServiceProposalDTO {
  return {
    id: p.id,
    number: p.number,
    title: p.title,
    kind: p.kind,
    status: p.status,
    revision: p.revision,
    versionLabel: p.versionLabel,
    clientId: p.clientId,
    clientName: p.clientName,
    projectId: p.projectId,
    projectName: p.projectName,
    contactName: p.contactName,
    contactEmail: p.contactEmail,
    contactTitle: p.contactTitle,
    currency: p.currency,
    subtotal: num(p.subtotal),
    discountTotal: num(p.discountTotal),
    taxableSubtotal: num(p.taxableSubtotal),
    taxTotal: num(p.taxTotal),
    grandTotal: num(p.grandTotal),
    baseFeeTotal: num(p.baseFeeTotal),
    optionalServicesTotal: num(p.optionalServicesTotal),
    reimbursablesTotal: num(p.reimbursablesTotal),
    showFeeDerivation: p.showFeeDerivation,
    estimatedWeeks: p.estimatedWeeks,
    issuedAt: p.issuedAt ? p.issuedAt.toISOString() : null,
    validUntil: ymd(p.validUntil),
    lockedAt: p.lockedAt ? p.lockedAt.toISOString() : null,
    createdByName: p.createdByName,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    input: toInput(p),
  };
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function listServiceProposals(opts?: {
  projectId?: string;
}): Promise<ServiceProposalListItem[]> {
  const rows = await prisma.serviceProposal.findMany({
    where: { deletedAt: null, ...(opts?.projectId ? { projectId: opts.projectId } : {}) },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((p) => ({
    id: p.id,
    number: p.number,
    title: p.title,
    status: p.status,
    revision: p.revision,
    clientName: p.clientName,
    projectName: p.projectName,
    currency: p.currency,
    grandTotal: num(p.grandTotal),
    feeBasisLabel: p.costBasisType ? COST_BASIS_LABEL[p.costBasisType] : null,
    createdAt: p.createdAt.toISOString(),
    validUntil: ymd(p.validUntil),
  }));
}

export async function getServiceProposal(id: string): Promise<ServiceProposalDTO | null> {
  const p = await prisma.serviceProposal.findFirst({
    where: { OR: [{ id }, { number: id }], deletedAt: null },
    include: FULL_INCLUDE,
  });
  return p ? toDto(p) : null;
}

export interface ProposalVersionInfo {
  id: string;
  versionLabel: string;
  reason: string | null;
  createdByName: string | null;
  createdAt: string;
  grandTotal: number;
  currency: string;
}

/** Issued version snapshots, newest first. Proves the immutable-history guarantee. */
export async function listServiceProposalVersions(
  serviceProposalId: string,
): Promise<ProposalVersionInfo[]> {
  const rows = await prisma.serviceProposalVersion.findMany({
    where: { serviceProposalId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((v) => {
    const snap = (v.snapshot ?? {}) as { calc?: { totals?: { grandTotal?: number }; currency?: string } };
    return {
      id: v.id,
      versionLabel: v.versionLabel,
      reason: v.reason,
      createdByName: v.createdByName,
      createdAt: v.createdAt.toISOString(),
      grandTotal: Number(snap.calc?.totals?.grandTotal ?? 0),
      currency: snap.calc?.currency ?? "USD",
    };
  });
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: ServiceProposalStatus | null;
  toStatus: ServiceProposalStatus;
  reason: string | null;
  byName: string | null;
  createdAt: string;
}

/** The full status timeline, newest first. */
export async function listStatusHistory(
  serviceProposalId: string,
): Promise<StatusHistoryEntry[]> {
  const rows = await prisma.serviceProposalStatusHistory.findMany({
    where: { serviceProposalId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((h) => ({
    id: h.id,
    fromStatus: h.fromStatus,
    toStatus: h.toStatus,
    reason: h.reason,
    byName: h.byName,
    createdAt: h.createdAt.toISOString(),
  }));
}

// ── Write helpers ─────────────────────────────────────────────────────────────

/**
 * Stamp companyId onto child-row create payloads.
 *
 * WHY: the tenant extension in lib/db.ts injects companyId on TOP-LEVEL writes only, not on
 * Prisma NESTED creates. Children created via `parent.create({ data: { phases: { create } } })`
 * would otherwise land with companyId = NULL — and then the companyId-scoped deleteMany used
 * on edit would never match them, so every edit duplicated the children. Stamping explicitly
 * keeps children consistently scoped so the delete-then-recreate works.
 */
function stampCompany<T extends object>(rows: T[], companyId: string | null): (T & { companyId: string | null })[] {
  return rows.map((r) => ({ ...r, companyId }));
}

export class ProposalLockedError extends Error {
  constructor(number: string) {
    super(`Proposal ${number} has been accepted or issued and can no longer be edited.`);
    this.name = "ProposalLockedError";
  }
}

// ── Writes ────────────────────────────────────────────────────────────────────

export async function createServiceProposal(input: ServiceProposalInput): Promise<ServiceProposalDTO> {
  const who = await actor();
  const cid = await getCurrentCompanyId();
  const existing = await prisma.serviceProposal.findMany({ select: { number: true } });
  const number = nextProposalNumber(existing.map((e) => e.number), new Date().getFullYear());
  const { header, children } = buildWriteData(input);

  const created = await prisma.serviceProposal.create({
    data: {
      ...header,
      number,
      status: input.status ?? "DRAFT",
      createdById: who.id,
      createdByName: who.name,
      updatedById: who.id,
      feeComponents: { create: stampCompany(children.feeComponents, cid) },
      phases: { create: stampCompany(children.phases, cid) },
      paymentMilestones: { create: stampCompany(children.paymentMilestones, cid) },
      reimbursables: { create: stampCompany(children.reimbursables, cid) },
      discounts: { create: stampCompany(children.discounts, cid) },
      taxes: { create: stampCompany(children.taxes, cid) },
      developmentCostItems: { create: stampCompany(children.developmentCostItems, cid) },
    },
    include: FULL_INCLUDE,
  });
  return toDto(created);
}

export async function updateServiceProposal(
  id: string,
  input: ServiceProposalInput,
): Promise<ServiceProposalDTO> {
  const current = await prisma.serviceProposal.findFirstOrThrow({
    where: { id, deletedAt: null },
    select: { status: true, number: true, companyId: true },
  });
  if (isLocked(current.status)) throw new ProposalLockedError(current.number);

  const who = await actor();
  const cid = current.companyId; // stamp children with the PARENT's company so scoping is exact
  const { header, children } = buildWriteData(input);

  // Replace children wholesale inside one transaction. The delete is a raw, unscoped delete by
  // parent id (deleteAllChildren) so it removes EVERY existing child — including legacy rows
  // written with a NULL companyId before the stamping fix — which is what caused edits to
  // duplicate the children. Version snapshots preserve issued history, so rebuilding the
  // working children is safe.
  const updated = await prisma.$transaction(async (tx) => {
    // Raw, UNSCOPED deletes by parent id: removes EVERY existing child (including legacy rows
    // written with NULL companyId before the stamping fix) so an edit never duplicates them.
    // Safe — the parent was already verified to belong to this company above.
    await Promise.all([
      tx.$executeRaw`DELETE FROM service_proposal_fee_components WHERE "serviceProposalId" = ${id}`,
      tx.$executeRaw`DELETE FROM service_proposal_phases WHERE "serviceProposalId" = ${id}`,
      tx.$executeRaw`DELETE FROM service_proposal_payment_milestones WHERE "serviceProposalId" = ${id}`,
      tx.$executeRaw`DELETE FROM service_proposal_reimbursables WHERE "serviceProposalId" = ${id}`,
      tx.$executeRaw`DELETE FROM service_proposal_discounts WHERE "serviceProposalId" = ${id}`,
      tx.$executeRaw`DELETE FROM service_proposal_taxes WHERE "serviceProposalId" = ${id}`,
      tx.$executeRaw`DELETE FROM service_proposal_development_cost_items WHERE "serviceProposalId" = ${id}`,
    ]);
    return tx.serviceProposal.update({
      where: { id },
      data: {
        ...header,
        status: input.status ?? undefined,
        updatedById: who.id,
        feeComponents: { create: stampCompany(children.feeComponents, cid) },
        phases: { create: stampCompany(children.phases, cid) },
        paymentMilestones: { create: stampCompany(children.paymentMilestones, cid) },
        reimbursables: { create: stampCompany(children.reimbursables, cid) },
        discounts: { create: stampCompany(children.discounts, cid) },
        taxes: { create: stampCompany(children.taxes, cid) },
        developmentCostItems: { create: stampCompany(children.developmentCostItems, cid) },
      },
      include: FULL_INCLUDE,
    });
  });
  return toDto(updated);
}

/** Soft delete — keeps the number reserved and the record recoverable. */
export async function deleteServiceProposal(id: string): Promise<void> {
  const current = await prisma.serviceProposal.findFirstOrThrow({
    where: { id, deletedAt: null },
    select: { status: true, number: true },
  });
  if (isLocked(current.status)) throw new ProposalLockedError(current.number);
  await prisma.serviceProposal.updateMany({ where: { id }, data: { deletedAt: new Date() } });
}

/** Record a status change, writing a history row. Illegal transitions are rejected. */
export async function transitionStatus(
  id: string,
  to: ServiceProposalStatus,
  reason?: string,
): Promise<ServiceProposalDTO> {
  const who = await actor();
  const current = await prisma.serviceProposal.findFirstOrThrow({
    where: { id, deletedAt: null },
    select: { status: true },
  });
  assertTransition(current.status, to);

  const lockedNow = isLocked(to) ? new Date() : undefined;
  await prisma.$transaction([
    prisma.serviceProposal.update({
      where: { id },
      data: { status: to, ...(lockedNow ? { lockedAt: lockedNow } : {}) },
    }),
    prisma.serviceProposalStatusHistory.create({
      data: {
        serviceProposalId: id,
        fromStatus: current.status,
        toStatus: to,
        reason: reason ?? null,
        byId: who.id,
        byName: who.name,
      },
    }),
  ]);
  const dto = await getServiceProposal(id);
  if (!dto) throw new Error("Proposal vanished after transition");
  return dto;
}

/**
 * Issue the proposal: advance to SENT (or from REVISED), stamp issuedAt, and write an
 * immutable version snapshot of the fully computed proposal. The snapshot is what documents
 * render from, so a reissue is always byte-faithful to what the client received.
 */
export async function issueServiceProposal(id: string, reason?: string): Promise<ServiceProposalDTO> {
  const who = await actor();
  const p = await prisma.serviceProposal.findFirstOrThrow({
    where: { id, deletedAt: null },
    include: FULL_INCLUDE,
  });
  assertTransition(p.status, "SENT");

  const input = toInput(p);
  const calc = computeProposal(input as Parameters<typeof computeProposal>[0]);
  const versionLabel = `${p.revision}.0`;

  await prisma.$transaction([
    prisma.serviceProposal.update({
      where: { id },
      data: { status: "SENT", issuedAt: p.issuedAt ?? new Date(), versionLabel },
    }),
    prisma.serviceProposalVersion.create({
      data: {
        serviceProposalId: id,
        versionLabel,
        snapshot: { input, calc } as unknown as Prisma.InputJsonValue,
        reason: reason ?? null,
        createdById: who.id,
        createdByName: who.name,
      },
    }),
    prisma.serviceProposalStatusHistory.create({
      data: {
        serviceProposalId: id,
        fromStatus: p.status,
        toStatus: "SENT",
        reason: reason ?? "Issued to client",
        byId: who.id,
        byName: who.name,
      },
    }),
  ]);
  const dto = await getServiceProposal(id);
  if (!dto) throw new Error("Proposal vanished after issue");
  return dto;
}

/**
 * Start the next revision as a fresh DRAFT that carries the current content, leaving the
 * issued proposal untouched. The original is marked SUPERSEDED when it was already issued.
 */
export async function reviseServiceProposal(id: string): Promise<ServiceProposalDTO> {
  const who = await actor();
  const src = await prisma.serviceProposal.findFirstOrThrow({
    where: { id, deletedAt: null },
    include: FULL_INCLUDE,
  });
  const input = toInput(src);
  const cid = src.companyId;
  const existing = await prisma.serviceProposal.findMany({ select: { number: true } });
  const number = nextProposalNumber(existing.map((e) => e.number), new Date().getFullYear());
  const { header, children } = buildWriteData(input);

  const revised = await prisma.$transaction(async (tx) => {
    const created = await tx.serviceProposal.create({
      data: {
        ...header,
        number,
        status: "DRAFT",
        revision: src.revision + 1,
        createdById: who.id,
        createdByName: who.name,
        updatedById: who.id,
        feeComponents: { create: stampCompany(children.feeComponents, cid) },
        phases: { create: stampCompany(children.phases, cid) },
        paymentMilestones: { create: stampCompany(children.paymentMilestones, cid) },
        reimbursables: { create: stampCompany(children.reimbursables, cid) },
        discounts: { create: stampCompany(children.discounts, cid) },
        taxes: { create: stampCompany(children.taxes, cid) },
        developmentCostItems: { create: stampCompany(children.developmentCostItems, cid) },
      },
      include: FULL_INCLUDE,
    });
    if (isIssued(src.status)) {
      await tx.serviceProposal.update({ where: { id: src.id }, data: { status: "SUPERSEDED" } });
    }
    return created;
  });
  return toDto(revised);
}

export interface ProposalAnalytics {
  currency: string;
  total: number;
  proposedValue: number;
  acceptedValue: number;
  openValue: number;
  winRate: number;
  avgValue: number;
  avgAcceptedValue: number;
  avgResponseDays: number | null;
  byStatus: { name: string; count: number; value: number }[];
  pipeline: { name: string; value: number }[];
  byBasis: { name: string; value: number }[];
  valueByMonth: { month: string; value: number }[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Firm-wide proposal analytics. Reads once and aggregates in memory. */
export async function getServiceProposalAnalytics(): Promise<ProposalAnalytics> {
  const rows = await prisma.serviceProposal.findMany({
    where: { deletedAt: null },
    select: {
      status: true, grandTotal: true, currency: true, costBasisType: true,
      createdAt: true, issuedAt: true,
    },
  });

  const currency = rows[0]?.currency ?? "USD";
  const val = (r: (typeof rows)[number]) => num(r.grandTotal);

  const WON: ServiceProposalStatus[] = ["ACCEPTED", "PARTIALLY_ACCEPTED", "CONVERTED"];
  const OPEN: ServiceProposalStatus[] = [
    "DRAFT", "INTERNAL_REVIEW", "APPROVED_FOR_ISSUE", "SENT", "UNDER_CLIENT_REVIEW",
    "REVISION_REQUESTED", "REVISED",
  ];

  let proposedValue = 0, acceptedValue = 0, openValue = 0;
  let wonCount = 0, lostCount = 0;
  const byStatusMap = new Map<ServiceProposalStatus, { count: number; value: number }>();
  const monthMap = new Map<string, number>();
  let percentValue = 0, fixedValue = 0;

  for (const r of rows) {
    const v = val(r);
    proposedValue += v;
    const s = byStatusMap.get(r.status) ?? { count: 0, value: 0 };
    s.count += 1; s.value += v; byStatusMap.set(r.status, s);
    if (WON.includes(r.status)) { acceptedValue += v; wonCount += 1; }
    if (r.status === "REJECTED") lostCount += 1;
    if (OPEN.includes(r.status)) openValue += v;
    if (r.costBasisType) percentValue += v; else fixedValue += v;

    const d = r.createdAt;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()).padStart(2, "0")}`;
    monthMap.set(key, (monthMap.get(key) ?? 0) + v);
  }

  // Last 6 months, oldest → newest.
  const now = new Date();
  const valueByMonth: { month: string; value: number }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()).padStart(2, "0")}`;
    valueByMonth.push({ month: MONTHS[d.getUTCMonth()], value: Math.round(monthMap.get(key) ?? 0) });
  }

  // Average response time (issue → decision) is not tracked per-decision yet; left null.
  const decided = wonCount + lostCount;

  return {
    currency,
    total: rows.length,
    proposedValue: Math.round(proposedValue),
    acceptedValue: Math.round(acceptedValue),
    openValue: Math.round(openValue),
    winRate: decided > 0 ? Math.round((wonCount / decided) * 100) : 0,
    avgValue: rows.length > 0 ? Math.round(proposedValue / rows.length) : 0,
    avgAcceptedValue: wonCount > 0 ? Math.round(acceptedValue / wonCount) : 0,
    avgResponseDays: null,
    byStatus: [...byStatusMap.entries()].map(([k, v]) => ({
      name: k.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
      count: v.count,
      value: Math.round(v.value),
    })),
    pipeline: OPEN.map((k) => ({
      name: k.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
      value: Math.round(byStatusMap.get(k)?.value ?? 0),
    })).filter((p) => p.value > 0),
    byBasis: [
      { name: "Percentage-based", value: Math.round(percentValue) },
      { name: "Fixed / other", value: Math.round(fixedValue) },
    ].filter((b) => b.value > 0),
    valueByMonth,
  };
}

export async function summarizeServiceProposals(opts?: {
  projectId?: string;
}): Promise<ServiceProposalSummary> {
  const rows = await prisma.serviceProposal.findMany({
    where: { deletedAt: null, ...(opts?.projectId ? { projectId: opts.projectId } : {}) },
    select: { status: true, grandTotal: true, currency: true, validUntil: true },
  });

  const byStatus = {
    DRAFT: 0, INTERNAL_REVIEW: 0, APPROVED_FOR_ISSUE: 0, SENT: 0, UNDER_CLIENT_REVIEW: 0,
    REVISION_REQUESTED: 0, REVISED: 0, ACCEPTED: 0, PARTIALLY_ACCEPTED: 0, REJECTED: 0,
    EXPIRED: 0, WITHDRAWN: 0, SUPERSEDED: 0, CONVERTED: 0,
  } as Record<ServiceProposalStatus, number>;

  const OPEN: ServiceProposalStatus[] = [
    "DRAFT", "INTERNAL_REVIEW", "APPROVED_FOR_ISSUE", "SENT", "UNDER_CLIENT_REVIEW",
    "REVISION_REQUESTED", "REVISED",
  ];
  const soon = Date.now() + 14 * 24 * 60 * 60 * 1000;

  let openValue = 0;
  let acceptedValue = 0;
  let expiringSoon = 0;
  for (const r of rows) {
    byStatus[r.status] += 1;
    const total = num(r.grandTotal);
    if (OPEN.includes(r.status)) openValue += total;
    if (r.status === "ACCEPTED" || r.status === "PARTIALLY_ACCEPTED") acceptedValue += total;
    if (
      OPEN.includes(r.status) &&
      r.validUntil &&
      r.validUntil.getTime() < soon &&
      r.validUntil.getTime() > Date.now()
    ) {
      expiringSoon += 1;
    }
  }

  const decided = byStatus.ACCEPTED + byStatus.PARTIALLY_ACCEPTED + byStatus.REJECTED;
  const won = byStatus.ACCEPTED + byStatus.PARTIALLY_ACCEPTED;
  const open = OPEN.reduce((s, k) => s + byStatus[k], 0);
  return {
    total: rows.length,
    open,
    openValue: Math.round(openValue * 100) / 100,
    acceptedValue: Math.round(acceptedValue * 100) / 100,
    winRate: decided > 0 ? Math.round((won / decided) * 100) : 0,
    currency: rows[0]?.currency ?? "USD",
    byStatus,
    expiringSoon,
  };
}
