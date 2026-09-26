/**
 * Invoices and payments — data access. SERVER-ONLY.
 *
 * Every read and write goes through the Prisma tenant extension (Invoice,
 * InvoiceLine and InvoicePayment are all in TENANT_MODELS), and single-row reads
 * use `findFirst` rather than `findUnique` deliberately: the extension puts the
 * company into the WHERE of a findFirst, while for findUnique it can only
 * inspect the row that comes back, which a narrow `select` defeats.
 *
 * CHILD ROWS ARE WRITTEN TOP-LEVEL, NEVER NESTED. The extension stamps
 * `companyId` on top-level writes only; a line created through
 * `invoice.create({ data: { lines: { create } } })` lands with a NULL company,
 * and the later company-scoped `deleteMany` then never matches it — which is
 * how an edit comes to duplicate every line. See the same note in
 * lib/data/service-proposals.ts.
 *
 * WHAT IS IMMUTABLE. A DRAFT may be edited or deleted. An ISSUED invoice may
 * not: it is what the practice asked a client to pay, on a date. It changes by
 * being paid (payments are recorded against it) or by being voided with a
 * reason. Its stored totals are never recomputed from a tax rate or a proposal
 * that has moved on since.
 */
import "server-only";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { releaseWork } from "@/lib/data/work-billing";
import {
  invoiceStatus,
  invoiceTotals,
  nextInvoiceNumber,
  settlement,
} from "@/lib/finance/calc";
import type {
  BillableMilestone,
  InvoiceDTO,
  InvoiceInput,
  InvoiceLineDTO,
  InvoicePaymentDTO,
  InvoicePaymentInput,
  InvoiceStatus,
  InvoiceSummaryDTO,
  ProposalBilling,
  TaxMode,
} from "@/lib/finance/types";

export class InvoiceNumberInUseError extends Error {
  constructor(number: string) {
    super(`Invoice number “${number}” is already used.`);
    this.name = "InvoiceNumberInUseError";
  }
}

export class InvoiceNotFoundError extends Error {
  constructor() {
    super("That invoice could not be found.");
    this.name = "InvoiceNotFoundError";
  }
}

export class InvoiceLockedError extends Error {
  constructor(what: string) {
    super(`This invoice has been issued, so it cannot be ${what}.`);
    this.name = "InvoiceLockedError";
  }
}

async function actor(): Promise<{ id: string | null; name: string | null }> {
  const session = await getServerSession(authOptions);
  return { id: session?.user?.id ?? null, name: session?.user?.name ?? null };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

// ── Conversions ────────────────────────────────────────────────────────────

type DecimalLike = { toNumber(): number } | number | string | null | undefined;

/** A Decimal as a major-unit number. Prisma hands these back as objects. */
function num(v: DecimalLike): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  const n = v.toNumber();
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(v: DecimalLike): number | null {
  if (v === null || v === undefined) return null;
  return num(v);
}

function ymd(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(`${s.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const CHILDREN = {
  lines: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
  payments: { orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }] },
} satisfies Prisma.InvoiceInclude;

type LineRow = {
  id: string;
  invoiceId: string;
  description: string;
  milestoneId: string | null;
  milestoneName: string | null;
  quantity: DecimalLike;
  unitRate: DecimalLike;
  amount: DecimalLike;
  taxable: boolean;
  sortOrder: number;
};

type PaymentRow = {
  id: string;
  invoiceId: string;
  paidAt: Date;
  amount: DecimalLike;
  method: InvoicePaymentDTO["method"];
  reference: string | null;
  notes: string | null;
  recordedByName: string | null;
  createdAt: Date;
};

type InvoiceRow = {
  id: string;
  number: string;
  status: InvoiceStatus;
  currency: string;
  clientId: string | null;
  clientName: string;
  contactName: string | null;
  contactEmail: string | null;
  billingAddress: string | null;
  projectId: string | null;
  projectName: string | null;
  serviceProposalId: string | null;
  proposalNumber: string | null;
  title: string | null;
  intro: string | null;
  issueDate: Date | null;
  dueDate: Date | null;
  termsDays: number | null;
  taxName: string | null;
  taxPercent: DecimalLike;
  taxMode: TaxMode;
  subtotal: DecimalLike;
  taxableSubtotal: DecimalLike;
  taxTotal: DecimalLike;
  total: DecimalLike;
  notes: string | null;
  footer: string | null;
  createdByName: string | null;
  issuedByName: string | null;
  voidReason: string | null;
  voidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines: LineRow[];
  payments: PaymentRow[];
};

function lineDto(r: LineRow): InvoiceLineDTO {
  return {
    id: r.id,
    invoiceId: r.invoiceId,
    description: r.description,
    milestoneId: r.milestoneId,
    milestoneName: r.milestoneName,
    quantity: numOrNull(r.quantity),
    unitRate: numOrNull(r.unitRate),
    amount: num(r.amount),
    taxable: r.taxable,
    sortOrder: r.sortOrder,
  };
}

function paymentDto(r: PaymentRow): InvoicePaymentDTO {
  return {
    id: r.id,
    invoiceId: r.invoiceId,
    paidAt: ymd(r.paidAt)!,
    amount: num(r.amount),
    method: r.method,
    reference: r.reference,
    notes: r.notes,
    recordedByName: r.recordedByName,
    createdAt: r.createdAt.toISOString(),
  };
}

function summaryDto(r: InvoiceRow): InvoiceSummaryDTO {
  const payments = r.payments.map((p) => ({ amount: num(p.amount) }));
  const total = num(r.total);
  const { paid, outstanding } = settlement(total, payments, r.currency);
  return {
    id: r.id,
    number: r.number,
    // The stored status is what someone chose (draft, issued, void); the money
    // decides the rest, so nobody can mark an unpaid invoice paid and nobody
    // has to remember to mark a paid one.
    status: invoiceStatus({
      status: r.status,
      total,
      issueDate: ymd(r.issueDate),
      payments,
      currency: r.currency,
    }),
    currency: r.currency,
    clientId: r.clientId,
    clientName: r.clientName,
    projectId: r.projectId,
    projectName: r.projectName,
    proposalNumber: r.proposalNumber,
    title: r.title,
    issueDate: ymd(r.issueDate),
    dueDate: ymd(r.dueDate),
    subtotal: num(r.subtotal),
    taxTotal: num(r.taxTotal),
    total,
    paid,
    outstanding,
    paymentCount: r.payments.length,
    lineCount: r.lines.length,
    updatedAt: r.updatedAt.toISOString(),
  };
}

function invoiceDto(r: InvoiceRow): InvoiceDTO {
  return {
    ...summaryDto(r),
    contactName: r.contactName,
    contactEmail: r.contactEmail,
    billingAddress: r.billingAddress,
    serviceProposalId: r.serviceProposalId,
    intro: r.intro,
    termsDays: r.termsDays,
    taxName: r.taxName,
    taxPercent: num(r.taxPercent),
    taxMode: r.taxMode,
    taxableSubtotal: num(r.taxableSubtotal),
    notes: r.notes,
    footer: r.footer,
    createdByName: r.createdByName,
    issuedByName: r.issuedByName,
    voidReason: r.voidReason,
    voidedAt: ymd(r.voidedAt),
    createdAt: r.createdAt.toISOString(),
    lines: r.lines.map(lineDto),
    payments: r.payments.map(paymentDto),
  };
}

// ── Reads ──────────────────────────────────────────────────────────────────

export async function listInvoices(
  filter: { projectId?: string; clientId?: string } = {},
): Promise<InvoiceSummaryDTO[]> {
  const rows = await prisma.invoice.findMany({
    where: {
      deletedAt: null,
      ...(filter.projectId ? { projectId: filter.projectId } : {}),
      ...(filter.clientId ? { clientId: filter.clientId } : {}),
    },
    include: CHILDREN,
    orderBy: [{ createdAt: "desc" }],
  });
  return (rows as unknown as InvoiceRow[]).map(summaryDto);
}

export async function getInvoice(idOrNumber: string): Promise<InvoiceDTO | null> {
  const row = await prisma.invoice.findFirst({
    where: { deletedAt: null, OR: [{ id: idOrNumber }, { number: idOrNumber }] },
    include: CHILDREN,
  });
  return row ? invoiceDto(row as unknown as InvoiceRow) : null;
}

/** Every number ever used, soft-deleted included, so one is never reused. */
async function allNumbers(): Promise<string[]> {
  const rows = await prisma.invoice.findMany({ select: { number: true } });
  return rows.map((r) => r.number);
}

async function assertNumberFree(number: string, exceptId?: string): Promise<void> {
  const clash = await prisma.invoice.findFirst({
    where: { number, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new InvoiceNumberInUseError(number);
}

async function requireInvoice(id: string): Promise<{ id: string; status: InvoiceStatus; currency: string }> {
  const row = await prisma.invoice.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, currency: true },
  });
  if (!row) throw new InvoiceNotFoundError();
  return row as { id: string; status: InvoiceStatus; currency: string };
}

// ── Raising an invoice from a proposal ─────────────────────────────────────

/**
 * What a proposal still has to bill.
 *
 * It reads the proposal's STORED figures — the milestone rows the fee engine
 * wrote, and the proposal's own totals and tax rows — rather than re-running
 * the engine. That is deliberate: an invoice is a snapshot, and the snapshot
 * should be of the proposal as it was accepted, not of what the engine would
 * compute from today's inputs.
 *
 * `invoiced` is what existing invoice lines already bill against each milestone,
 * so the same milestone cannot quietly be billed twice; `warnings` carries the
 * one thing that must not be silent — milestone percentages that do not add up
 * to 100, which would under- or over-bill the client.
 */
export async function getProposalBilling(
  serviceProposalId: string,
): Promise<ProposalBilling | null> {
  const proposal = await prisma.serviceProposal.findFirst({
    where: { id: serviceProposalId, deletedAt: null },
    include: {
      paymentMilestones: { orderBy: { sortOrder: "asc" } },
      taxes: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!proposal) return null;

  const currency = proposal.currency;
  const lines = await prisma.invoiceLine.findMany({
    where: { NOT: { milestoneId: null }, invoice: { serviceProposalId, deletedAt: null } },
    select: { milestoneId: true, amount: true, invoice: { select: { number: true, status: true } } },
  });

  const billed = new Map<string, { amount: number; numbers: string[] }>();
  for (const line of lines) {
    // A voided invoice never billed anything; its lines must not block a reissue.
    if (line.invoice.status === "VOID") continue;
    const key = line.milestoneId!;
    const entry = billed.get(key) ?? { amount: 0, numbers: [] };
    entry.amount += num(line.amount);
    if (!entry.numbers.includes(line.invoice.number)) entry.numbers.push(line.invoice.number);
    billed.set(key, entry);
  }

  const milestones: BillableMilestone[] = proposal.paymentMilestones.map((m) => {
    const amount = num(m.amount);
    const already = billed.get(m.id);
    const invoiced = already?.amount ?? 0;
    return {
      id: m.id,
      name: m.invoiceDescription?.trim() || m.name,
      trigger: m.trigger,
      percent: num(m.percent),
      amount,
      invoiced,
      remaining: Math.max(0, Math.round((amount - invoiced) * 100) / 100),
      invoiceNumbers: already?.numbers ?? [],
    };
  });

  const warnings: string[] = [];
  const percentTotal = milestones.reduce((n, m) => n + m.percent, 0);
  if (milestones.length > 0 && Math.abs(percentTotal - 100) > 0.01) {
    warnings.push(
      `The payment milestones on this proposal add up to ${percentTotal.toFixed(2)}%, not 100%. Billing them all would ${percentTotal < 100 ? "under" : "over"}-bill the client.`,
    );
  }
  if (milestones.length === 0) {
    warnings.push("This proposal has no payment milestones, so there is nothing to bill from it.");
  }

  const tax = proposal.taxes[0];
  return {
    serviceProposalId: proposal.id,
    proposalNumber: proposal.number,
    title: proposal.title,
    status: proposal.status,
    currency,
    clientId: proposal.clientId,
    clientName: proposal.clientName ?? "",
    projectId: proposal.projectId,
    projectName: proposal.projectName,
    contactName: proposal.contactName,
    contactEmail: proposal.contactEmail,
    grandTotal: num(proposal.grandTotal),
    taxName: tax?.name ?? null,
    taxPercent: tax ? num(tax.percent) : 0,
    taxMode: (tax?.mode as TaxMode) ?? "EXCLUSIVE",
    milestones,
    warnings,
  };
}

/** Accepted proposals worth offering on the "raise an invoice" screen. */
export async function listBillableProposals(): Promise<
  { id: string; number: string; title: string; clientName: string | null; status: string; currency: string; grandTotal: number }[]
> {
  const rows = await prisma.serviceProposal.findMany({
    where: {
      deletedAt: null,
      status: { in: ["ACCEPTED", "PARTIALLY_ACCEPTED", "CONVERTED"] },
    },
    select: {
      id: true,
      number: true,
      title: true,
      clientName: true,
      status: true,
      currency: true,
      grandTotal: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });
  return rows.map((r) => ({ ...r, grandTotal: num(r.grandTotal) }));
}

// ── Writes ─────────────────────────────────────────────────────────────────

/** Stamp the company onto child rows the extension will not reach. */
function stamp<T extends object>(rows: T[], companyId: string | null | undefined): T[] {
  return companyId ? rows.map((r) => ({ ...r, companyId })) : rows;
}

async function currentCompany(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.companyId ?? null;
}

function headerData(input: InvoiceInput, totals: ReturnType<typeof invoiceTotals>) {
  return {
    currency: input.currency ?? "AWG",
    clientId: input.clientId ?? null,
    clientName: input.clientName.trim(),
    contactName: input.contactName ?? null,
    contactEmail: input.contactEmail ?? null,
    billingAddress: input.billingAddress ?? null,
    projectId: input.projectId ?? null,
    projectName: input.projectName ?? null,
    serviceProposalId: input.serviceProposalId ?? null,
    proposalNumber: input.proposalNumber ?? null,
    title: input.title ?? null,
    intro: input.intro ?? null,
    issueDate: toDate(input.issueDate),
    dueDate: toDate(input.dueDate),
    termsDays: input.termsDays ?? null,
    taxName: input.taxName ?? null,
    taxPercent: input.taxPercent ?? 0,
    taxMode: input.taxMode ?? "EXCLUSIVE",
    subtotal: totals.subtotal,
    taxableSubtotal: totals.taxableSubtotal,
    taxTotal: totals.taxTotal,
    total: totals.total,
    notes: input.notes ?? null,
    footer: input.footer ?? null,
  };
}

function lineRows(invoiceId: string, input: InvoiceInput) {
  return input.lines.map((l, i) => ({
    invoiceId,
    description: l.description.trim(),
    milestoneId: l.milestoneId ?? null,
    milestoneName: l.milestoneName ?? null,
    quantity: l.quantity ?? null,
    unitRate: l.unitRate ?? null,
    amount: l.amount,
    taxable: l.taxable ?? true,
    sortOrder: i,
  }));
}

export async function createInvoice(input: InvoiceInput): Promise<InvoiceDTO> {
  const who = await actor();
  const companyId = await currentCompany();
  const currency = input.currency ?? "AWG";
  const totals = invoiceTotals(input.lines, {
    percent: input.taxPercent ?? 0,
    mode: input.taxMode ?? "EXCLUSIVE",
  }, currency);

  const asked = input.number?.trim() || undefined;
  const number = asked ?? nextInvoiceNumber(await allNumbers(), new Date().getFullYear());
  if (asked) await assertNumberFree(asked);

  try {
    const created = await prisma.invoice.create({
      data: { ...headerData(input, totals), number, createdById: who.id, createdByName: who.name },
    });
    // Top-level, and stamped: see the note at the top of this file.
    await prisma.invoiceLine.createMany({
      data: stamp(lineRows(created.id, input), companyId),
    });
    const full = await getInvoice(created.id);
    if (!full) throw new InvoiceNotFoundError();
    return full;
  } catch (e) {
    if (isUniqueViolation(e)) throw new InvoiceNumberInUseError(number);
    throw e;
  }
}

export async function updateInvoice(id: string, input: InvoiceInput): Promise<InvoiceDTO> {
  const current = await requireInvoice(id);
  if (current.status !== "DRAFT") throw new InvoiceLockedError("edited");
  const companyId = await currentCompany();
  const currency = input.currency ?? current.currency;
  const totals = invoiceTotals(input.lines, {
    percent: input.taxPercent ?? 0,
    mode: input.taxMode ?? "EXCLUSIVE",
  }, currency);

  const asked = input.number?.trim() || undefined;
  if (asked) await assertNumberFree(asked, id);

  try {
    await prisma.invoice.update({
      where: { id },
      data: { ...headerData(input, totals), ...(asked ? { number: asked } : {}), updatedById: (await actor()).id },
    });
    // Replace the lines wholesale: they are the invoice's own content, and a
    // diff would leave an orphan the moment two people edit the same draft.
    await prisma.invoiceLine.deleteMany({ where: { invoiceId: id } });
    await prisma.invoiceLine.createMany({ data: stamp(lineRows(id, input), companyId) });
    const full = await getInvoice(id);
    if (!full) throw new InvoiceNotFoundError();
    return full;
  } catch (e) {
    if (isUniqueViolation(e)) throw new InvoiceNumberInUseError(asked ?? "that number");
    throw e;
  }
}

/** Issue it: the invoice stops being editable and gets its dates. */
export async function issueInvoice(
  id: string,
  dates: { issueDate?: string | null; dueDate?: string | null } = {},
): Promise<InvoiceDTO> {
  const current = await requireInvoice(id);
  if (current.status !== "DRAFT") throw new InvoiceLockedError("issued again");
  const who = await actor();
  await prisma.invoice.update({
    where: { id },
    data: {
      status: "ISSUED",
      issuedByName: who.name,
      ...(dates.issueDate ? { issueDate: toDate(dates.issueDate) } : {}),
      ...(dates.dueDate ? { dueDate: toDate(dates.dueDate) } : {}),
    },
  });
  const full = await getInvoice(id);
  if (!full) throw new InvoiceNotFoundError();
  return full;
}

export async function voidInvoice(id: string, reason: string): Promise<InvoiceDTO> {
  await requireInvoice(id);
  await prisma.invoice.update({
    where: { id },
    data: { status: "VOID", voidReason: reason.trim() || "No reason given", voidedAt: new Date() },
  });
  // A voided invoice has been withdrawn, so any hours and expenses billed on it
  // are billable again. Leaving them stamped would quietly destroy the
  // practice's right to bill work it actually did — see lib/data/work-billing.ts.
  await releaseWork(id);
  const full = await getInvoice(id);
  if (!full) throw new InvoiceNotFoundError();
  return full;
}

/** Soft delete, drafts only. An issued invoice is a record and stays. */
export async function deleteInvoice(id: string): Promise<void> {
  const current = await requireInvoice(id);
  if (current.status !== "DRAFT") throw new InvoiceLockedError("deleted");
  const affected = await prisma.invoice.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (affected.count === 0) throw new InvoiceNotFoundError();
  // Same as voiding: the draft is gone, so the work it held goes back on the
  // unbilled list rather than disappearing with it.
  await releaseWork(id);
}

// ── Payments ───────────────────────────────────────────────────────────────

/**
 * Record money received.
 *
 * Allowed against anything that is not a draft or a void: a draft has not been
 * asked for and a void has been withdrawn, so a payment against either is a
 * mistake worth refusing rather than absorbing.
 */
export async function recordPayment(
  invoiceId: string,
  input: InvoicePaymentInput,
): Promise<InvoicePaymentDTO> {
  const current = await requireInvoice(invoiceId);
  if (current.status === "DRAFT") {
    throw new InvoiceLockedError("paid before it is issued");
  }
  if (current.status === "VOID") {
    throw new InvoiceLockedError("paid — it has been voided");
  }
  const who = await actor();
  const row = await prisma.invoicePayment.create({
    data: {
      invoiceId,
      paidAt: toDate(input.paidAt) ?? new Date(),
      amount: input.amount,
      method: input.method,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      recordedById: who.id,
      recordedByName: who.name,
    },
  });
  return paymentDto(row as unknown as PaymentRow);
}

export async function deletePayment(id: string): Promise<void> {
  const affected = await prisma.invoicePayment.deleteMany({ where: { id } });
  if (affected.count === 0) throw new InvoiceNotFoundError();
}
