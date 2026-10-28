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
 *
 * PHASE B (0.38.0). An issued invoice can be EMAILED with its PDF (SENT is
 * stamped only after the provider confirmed — `markInvoiceSent`), a VOID one
 * can be RE-ISSUED as a new draft numbered `<root>-2`, every payment carries a
 * receipt number allocated in the same transaction that writes it, and a
 * payment is REVERSED with a reason, never deleted. Reversed payments stay on
 * the row and are kept OUT of `InvoiceDTO.payments`, so no reader of payments
 * can count one by forgetting a filter.
 */
import "server-only";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { requireActor } from "@/lib/server/actor";
import { canDoInvoiceAction, INVOICE_MANAGER_ONLY, type InvoiceAction } from "@/lib/finance/invoice-permissions";
import { releaseWork } from "@/lib/data/work-billing";
import { creditNoteSummaryDto } from "@/lib/data/credit-notes";
import {
  DiscountError,
  dueDateFrom,
  invoiceBalance,
  invoiceStatus,
  discountedTotals,
  nextInvoiceNumber,
  nextReceiptNumber,
  reissueNumber,
} from "@/lib/finance/calc";
import { milestoneBasis } from "@/lib/finance/proposal-billing";
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

/**
 * A Phase B refusal with a plain sentence for the user: re-issuing something
 * that is not void, a milestone another live invoice already bills, reversing
 * a payment twice, emailing a draft. The message is an English key the action
 * translates.
 */
export class InvoiceActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceActionError";
  }
}

export { DiscountError };

/**
 * Voiding and re-issuing an invoice, reversing a payment and deleting a draft are for an
 * administrator, a director or the founder (lib/finance/invoice-permissions.ts).
 * Checked here as well as in the actions in front of this file: an action is a
 * public endpoint, and the data layer is the last place the rule can live.
 */
export class InvoiceForbiddenError extends Error {
  constructor() {
    super(INVOICE_MANAGER_ONLY);
    this.name = "InvoiceForbiddenError";
  }
}

async function requireInvoiceAction(action: InvoiceAction): Promise<Awaited<ReturnType<typeof requireActor>>> {
  const who = await requireActor();
  if (!canDoInvoiceAction(action, who.role, who.isFounder)) throw new InvoiceForbiddenError();
  return who;
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
  // Every live credit note, drafts and voids included: the balance counts only
  // the ISSUED ones (invoiceBalance), the screens list them all.
  creditNotes: { where: { deletedAt: null }, orderBy: [{ date: "asc" }, { number: "asc" }] },
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
  receiptNumber: string | null;
  reversedAt: Date | null;
  reversedByName: string | null;
  reverseReason: string | null;
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
  tax2Name: string | null;
  tax2Percent: DecimalLike;
  subtotal: DecimalLike;
  taxableSubtotal: DecimalLike;
  taxTotal: DecimalLike;
  tax2Total: DecimalLike;
  total: DecimalLike;
  notes: string | null;
  footer: string | null;
  createdByName: string | null;
  issuedByName: string | null;
  voidReason: string | null;
  voidedAt: Date | null;
  discountType: "PERCENT" | "AMOUNT" | null;
  discountValue: DecimalLike;
  discountTotal: DecimalLike;
  sentAt: Date | null;
  sentTo: string | null;
  sentByName: string | null;
  sentCount: number;
  reissuedFromId: string | null;
  reissuedFromNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
  lines: LineRow[];
  payments: PaymentRow[];
  creditNotes: Parameters<typeof creditNoteSummaryDto>[0][];
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
    receiptNumber: r.receiptNumber ?? null,
    reversedAt: r.reversedAt ? r.reversedAt.toISOString() : null,
    reversedByName: r.reversedByName ?? null,
    reverseReason: r.reverseReason ?? null,
  };
}

/** The payments that count. A reversed payment is kept on the row and counted nowhere. */
function liveRows(r: InvoiceRow): PaymentRow[] {
  return r.payments.filter((p) => !p.reversedAt);
}

function summaryDto(r: InvoiceRow): InvoiceSummaryDTO {
  const payments = liveRows(r).map((p) => ({ amount: num(p.amount) }));
  const credits = r.creditNotes.map((c) => ({
    amount: num(c.total as DecimalLike),
    status: c.status,
    currency: c.currency,
  }));
  const total = num(r.total);
  // ONE balance: payments AND issued credit notes, lib/finance/calc.ts.
  const { paid, credited, outstanding } = invoiceBalance({
    total,
    currency: r.currency,
    payments,
    credits,
  });
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
      credits,
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
    tax2Total: num(r.tax2Total),
    total,
    paid,
    credited,
    outstanding,
    discountTotal: num(r.discountTotal),
    sentAt: r.sentAt ? r.sentAt.toISOString() : null,
    paymentCount: payments.length,
    lineCount: r.lines.length,
    updatedAt: r.updatedAt.toISOString(),
  };
}

/**
 * `reissuedAs` (the re-issues of a void invoice) is a second query, made only
 * by `getInvoice` — the screen and the print that show "Re-issued as …". The
 * bulk readers (export, receivables) do not need it and pass nothing.
 */
function invoiceDto(r: InvoiceRow, reissuedAs: { id: string; number: string }[] = []): InvoiceDTO {
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
    tax2Name: r.tax2Name,
    tax2Percent: num(r.tax2Percent),
    taxableSubtotal: num(r.taxableSubtotal),
    notes: r.notes,
    footer: r.footer,
    createdByName: r.createdByName,
    issuedByName: r.issuedByName,
    voidReason: r.voidReason,
    voidedAt: ymd(r.voidedAt),
    createdAt: r.createdAt.toISOString(),
    discountType: r.discountType ?? null,
    discountValue: num(r.discountValue),
    sentTo: r.sentTo ?? null,
    sentByName: r.sentByName ?? null,
    sentCount: r.sentCount ?? 0,
    reissuedFromId: r.reissuedFromId ?? null,
    reissuedFromNumber: r.reissuedFromNumber ?? null,
    reissuedAs,
    lines: r.lines.map(lineDto),
    // ONLY the payments that count — see the type. Reversed ones go below.
    payments: liveRows(r).map(paymentDto),
    reversedPayments: r.payments.filter((p) => p.reversedAt).map(paymentDto),
    creditNotes: r.creditNotes.map(creditNoteSummaryDto),
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
  if (!row) return null;
  // "Re-issued as …": the live re-issues of this invoice (a deleted draft is gone).
  const reissues = await prisma.invoice.findMany({
    where: { reissuedFromId: row.id, deletedAt: null },
    select: { id: true, number: true },
    orderBy: [{ createdAt: "asc" }],
  });
  return invoiceDto(row as unknown as InvoiceRow, reissues);
}

/**
 * Every invoice that is in the books — everything but drafts — with its lines
 * and payments, for the accounting export (lib/finance/export.ts filters by
 * date). Not capped: an export that silently stopped at N rows would be worse
 * than none. Who may call this is decided by the export route.
 */
export async function listInvoicesForExport(): Promise<InvoiceDTO[]> {
  const rows = await prisma.invoice.findMany({
    where: { deletedAt: null, status: { not: "DRAFT" } },
    include: CHILDREN,
    orderBy: [{ issueDate: "asc" }, { number: "asc" }],
  });
  return (rows as unknown as InvoiceRow[]).map((r) => invoiceDto(r));
}

/**
 * Every invoice in the books (drafts left out) with its payments, optionally for
 * one client — what receivables by client and the Statement of Account read.
 * VOID invoices come back too, marked VOID, and the pure code in
 * lib/finance/receivables.ts leaves them out; that decision lives in one place.
 * Who may call this is decided by lib/data/receivables.ts.
 */
export async function listInvoicesOnBooks(
  filter: { clientId?: string } = {},
): Promise<InvoiceDTO[]> {
  const rows = await prisma.invoice.findMany({
    where: {
      deletedAt: null,
      status: { not: "DRAFT" },
      ...(filter.clientId ? { clientId: filter.clientId } : {}),
    },
    include: CHILDREN,
    orderBy: [{ issueDate: "asc" }, { number: "asc" }],
  });
  return (rows as unknown as InvoiceRow[]).map((r) => invoiceDto(r));
}

/**
 * Drafts dated in a period, for the tax report's "left out" line. The export
 * list above never loads drafts, so the report cannot count them itself.
 */
export async function countDraftInvoicesIssued(from: string, to: string): Promise<number> {
  return prisma.invoice.count({
    where: {
      deletedAt: null,
      status: "DRAFT",
      issueDate: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T23:59:59.999Z`) },
    },
  });
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

type RequiredInvoice = { id: string; status: InvoiceStatus; currency: string; companyId: string | null };

async function requireInvoice(id: string): Promise<RequiredInvoice> {
  const row = await prisma.invoice.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, currency: true, companyId: true },
  });
  if (!row) throw new InvoiceNotFoundError();
  return row as RequiredInvoice;
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

  // The milestone rows are shares of the GRAND total, so a tax added on top is
  // already inside them. `basis` takes it back out once, so the invoice adds it
  // once instead of twice — see lib/finance/proposal-billing.ts.
  const basis = milestoneBasis({
    currency,
    grandTotal: num(proposal.grandTotal),
    taxTotal: num(proposal.taxTotal),
    taxableSubtotal: num(proposal.taxableSubtotal),
    taxes: proposal.taxes.map((t) => ({ name: t.name, percent: num(t.percent), mode: t.mode as TaxMode })),
    milestones: proposal.paymentMilestones.map((m) => ({ id: m.id, amount: num(m.amount) })),
  });

  const milestones: BillableMilestone[] = proposal.paymentMilestones.map((m) => {
    const { billable: amount, taxable } = basis.amounts[m.id];
    const already = billed.get(m.id);
    const invoiced = already?.amount ?? 0;
    return {
      id: m.id,
      name: m.invoiceDescription?.trim() || m.name,
      trigger: m.trigger,
      percent: num(m.percent),
      amount,
      taxable,
      gross: num(m.amount),
      invoiced,
      remaining: Math.max(0, Math.round((amount - invoiced) * 100) / 100),
      invoiceNumbers: already?.numbers ?? [],
    };
  });

  const warnings: string[] = [...basis.warnings];
  const percentTotal = milestones.reduce((n, m) => n + m.percent, 0);
  if (milestones.length > 0 && Math.abs(percentTotal - 100) > 0.01) {
    warnings.push(
      `The payment milestones on this proposal add up to ${percentTotal.toFixed(2)}%, not 100%. Billing them all would ${percentTotal < 100 ? "under" : "over"}-bill the client.`,
    );
  }
  if (milestones.length === 0) {
    warnings.push("This proposal has no payment milestones, so there is nothing to bill from it.");
  }

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
    taxName: basis.taxName,
    taxPercent: basis.taxPercent,
    taxMode: basis.taxMode,
    tax2Name: basis.tax2Name,
    tax2Percent: basis.tax2Percent,
    taxOnTop: basis.taxOnTop,
    milestones,
    warnings,
  };
}

/** Accepted proposals worth offering on the "raise an invoice" screen. */
export async function listBillableProposals(): Promise<
  {
    id: string;
    number: string;
    title: string;
    clientName: string | null;
    projectId: string | null;
    status: string;
    currency: string;
    grandTotal: number;
  }[]
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
      projectId: true,
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

function headerData(input: InvoiceInput, totals: ReturnType<typeof discountedTotals>) {
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
    // No rate, no second tax: a name alone would be a label on nothing.
    tax2Name: (input.tax2Percent ?? 0) > 0 ? input.tax2Name?.trim() || null : null,
    tax2Percent: input.tax2Percent ?? 0,
    // The discount as typed and what it came to; no type, no discount.
    discountType: input.discountType ?? null,
    discountValue: input.discountType ? (input.discountValue ?? 0) : 0,
    discountTotal: totals.discountTotal,
    subtotal: totals.subtotal,
    taxableSubtotal: totals.taxableSubtotal,
    taxTotal: totals.taxTotal,
    tax2Total: totals.tax2Total,
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

/**
 * The totals the row stores, discount included. A discount the lines cannot
 * carry (over 100%, more than the subtotal) throws `DiscountError` — the zod
 * gate refuses it first; this is the data layer's own refusal.
 */
function totalsFor(input: InvoiceInput, currency: string) {
  return discountedTotals(
    input.lines,
    {
      percent: input.taxPercent ?? 0,
      mode: input.taxMode ?? "EXCLUSIVE",
      percent2: input.tax2Percent ?? 0,
    },
    currency,
    input.discountType ? { type: input.discountType, value: input.discountValue ?? 0 } : null,
  );
}

export async function createInvoice(
  input: InvoiceInput,
  /** A re-issue: the void invoice it replaces. Set only by `reissueInvoice`. */
  opts: { reissuedFrom?: { id: string; number: string } } = {},
): Promise<InvoiceDTO> {
  const who = await actor();
  const companyId = await currentCompany();
  const currency = input.currency ?? "AWG";
  const totals = totalsFor(input, currency);

  const asked = input.number?.trim() || undefined;
  const number = asked ?? nextInvoiceNumber(await allNumbers(), new Date().getFullYear());
  if (asked) await assertNumberFree(asked);

  try {
    const created = await prisma.invoice.create({
      data: {
        ...headerData(input, totals),
        number,
        createdById: who.id,
        createdByName: who.name,
        ...(opts.reissuedFrom
          ? { reissuedFromId: opts.reissuedFrom.id, reissuedFromNumber: opts.reissuedFrom.number }
          : {}),
      },
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
  const totals = totalsFor(input, currency);

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
  await requireInvoiceAction("void");
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
  await requireInvoiceAction("deleteDraft");
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
  /**
   * For a payment no person recorded (the Stripe webhook has no session): who to
   * name as the recorder, and the PaymentIntent that makes the row unique.
   */
  opts: { recordedBy?: { id: string | null; name: string }; stripePaymentIntentId?: string } = {},
): Promise<InvoicePaymentDTO> {
  const current = await requireInvoice(invoiceId);
  if (current.status === "DRAFT") {
    throw new InvoiceLockedError("paid before it is issued");
  }
  if (current.status === "VOID") {
    throw new InvoiceLockedError("paid — it has been voided");
  }
  const who = opts.recordedBy ?? (await actor());
  const paidAt = toDate(input.paidAt) ?? new Date();
  // The receipt number is taken in the SAME transaction as the insert, under a
  // per-practice lock, so two payments recorded at once (a person and the
  // Stripe webhook) can never be handed the same number, and a payment can
  // never exist without one.
  const row = await prisma.$transaction(async (tx) => {
    const receiptNumber = await allocateReceiptNumber(tx, current.companyId, paidAt);
    return tx.invoicePayment.create({
      data: {
        invoiceId,
        paidAt,
        amount: input.amount,
        method: input.method,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        recordedById: who.id,
        recordedByName: who.name,
        receiptNumber,
        ...(opts.stripePaymentIntentId ? { stripePaymentIntentId: opts.stripePaymentIntentId } : {}),
      },
    });
  });
  return paymentDto(row as unknown as PaymentRow);
}

/** The prisma client or a transaction on it — both carry the tenant extension. */
type ReceiptDb = Pick<typeof prisma, "invoicePayment" | "$executeRaw">;

/**
 * The next `RCT-{year}-{NNN}` for the practice. MUST be called inside the
 * transaction that writes it: the advisory lock below is held until that
 * transaction ends, so the read of the highest number and the write of the next
 * one are one step for every other caller in the same practice. The unique
 * index on (companyId, receiptNumber) is the last line of defence behind it.
 *
 * Reversed payments keep their numbers, and the read is every payment the
 * practice has (the tenant extension scopes it), so a number is never reused.
 */
async function allocateReceiptNumber(db: ReceiptDb, companyId: string | null, paidAt: Date): Promise<string> {
  const key = `invoice-receipt:${companyId ?? "none"}`;
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  const rows = await db.invoicePayment.findMany({
    where: { receiptNumber: { not: null } },
    select: { receiptNumber: true },
  });
  return nextReceiptNumber(
    rows.map((r) => r.receiptNumber ?? ""),
    paidAt.getUTCFullYear(),
  );
}

/**
 * Record a card payment that arrived through Stripe — the same path as a
 * payment typed in by hand (`recordPayment`), so the invoice's paid state is
 * still DERIVED from its payments and nothing else.
 *
 * Idempotent on the PaymentIntent: Stripe delivers webhooks at least once, and
 * the UNIQUE column turns a replay into "duplicate" instead of a second row
 * (checked first, and caught again for two deliveries racing each other).
 * "refused" is a draft or voided invoice; the money then sits in the practice's
 * Stripe account for them to refund — the webhook logs it loudly.
 *
 * Must run inside the invoice's company (`runAsCompany`, lib/server/request-company.ts).
 */
export async function recordStripePayment(
  invoiceId: string,
  input: InvoicePaymentInput & { stripePaymentIntentId: string },
): Promise<"recorded" | "duplicate" | "refused"> {
  const { stripePaymentIntentId, ...payment } = input;
  const seen = await prisma.invoicePayment.findFirst({
    where: { stripePaymentIntentId },
    select: { id: true },
  });
  if (seen) return "duplicate";
  try {
    await recordPayment(invoiceId, payment, {
      recordedBy: { id: null, name: "Stripe (online payment)" },
      stripePaymentIntentId,
    });
    return "recorded";
  } catch (e) {
    if (isUniqueViolation(e)) return "duplicate";
    if (e instanceof InvoiceLockedError) return "refused";
    throw e;
  }
}

/**
 * Reverse a payment: the money did not arrive after all (a bounced cheque, a
 * card refunded in Stripe, a payment recorded against the wrong invoice). It
 * REPLACES deleting a payment — there is no delete any more. The row stays,
 * stamped with who reversed it, when and why, keeps its receipt number (whose
 * receipt now prints REVERSED), and stops counting towards what was paid: it
 * leaves `InvoiceDTO.payments`, so the status re-derives (PAID → PART_PAID →
 * SENT / ISSUED) and receivables, the statement, the tax report and the export
 * all stop counting it, with nothing to remember.
 *
 * Administrator, director or founder only, checked here as well as in the
 * action. A reason is required: a reversal nobody can explain is a hole in the
 * books.
 */
export async function reversePayment(paymentId: string, reason: string): Promise<{ invoiceId: string }> {
  const who = await requireInvoiceAction("reversePayment");
  const why = (reason ?? "").trim();
  if (!why) throw new InvoiceActionError("Give the reason for reversing this payment.");
  const payment = await prisma.invoicePayment.findFirst({
    where: { id: paymentId },
    select: { id: true, invoiceId: true, reversedAt: true },
  });
  if (!payment) throw new InvoiceNotFoundError();
  if (payment.reversedAt) throw new InvoiceActionError("This payment has already been reversed.");
  // Only where it is still live, so two people reversing at once stamp it once.
  const done = await prisma.invoicePayment.updateMany({
    where: { id: paymentId, reversedAt: null },
    data: {
      reversedAt: new Date(),
      reversedById: who.id,
      reversedByName: who.name,
      reverseReason: why.slice(0, 1000),
    },
  });
  if (done.count === 0) throw new InvoiceActionError("This payment has already been reversed.");
  return { invoiceId: payment.invoiceId };
}

// ── Receipts ───────────────────────────────────────────────────────────────

/**
 * The payment's receipt number, assigning one if it has none. Every payment
 * recorded from 0.38.0 is numbered as it is written and prisma/sql/0037 numbers
 * the ones before it; this is for a payment that slipped between the two (or a
 * sample-data row), the first time its receipt is opened. Same lock, same
 * series, and only where the column is still empty.
 */
async function ensureReceiptNumber(paymentId: string): Promise<void> {
  const payment = await prisma.invoicePayment.findFirst({
    where: { id: paymentId },
    select: { id: true, receiptNumber: true, paidAt: true, invoiceId: true },
  });
  if (!payment || payment.receiptNumber) return;
  const invoice = await prisma.invoice.findFirst({
    where: { id: payment.invoiceId },
    select: { companyId: true },
  });
  await prisma.$transaction(async (tx) => {
    const receiptNumber = await allocateReceiptNumber(tx, invoice?.companyId ?? null, payment.paidAt);
    await tx.invoicePayment.updateMany({
      where: { id: paymentId, receiptNumber: null },
      data: { receiptNumber },
    });
  });
}

/**
 * One payment and its invoice, for the printed and emailed receipt. Reversed
 * payments come back too (their receipt says REVERSED); a payment whose invoice
 * is gone does not.
 */
export async function getReceipt(
  paymentId: string,
): Promise<{ payment: InvoicePaymentDTO; invoice: InvoiceDTO } | null> {
  await ensureReceiptNumber(paymentId);
  const row = await prisma.invoicePayment.findFirst({ where: { id: paymentId } });
  if (!row) return null;
  const invoice = await getInvoice(row.invoiceId);
  if (!invoice) return null;
  return { payment: paymentDto(row as unknown as PaymentRow), invoice };
}

// ── Re-issue ───────────────────────────────────────────────────────────────

/** The first invoice in a re-issue chain: a re-issue of a re-issue keeps the original's root. */
async function reissueRoot(number: string, fromId: string | null): Promise<string> {
  let root = number;
  let next = fromId;
  // Bounded: a chain is a handful of links; a loop in bad data must not spin.
  for (let hops = 0; next && hops < 50; hops += 1) {
    const r = await prisma.invoice.findFirst({
      where: { id: next },
      select: { number: true, reissuedFromId: true },
    });
    if (!r) break;
    root = r.number;
    next = r.reissuedFromId;
  }
  return root;
}

/**
 * Re-issue a VOID invoice: a new DRAFT with the same client, lines, taxes and
 * discount, numbered `<root>-2` (then `-3` …; lib/finance/calc.ts
 * `reissueNumber`), linked both ways — `reissuedFromId` on the new one, and the
 * void one finds its re-issues by that link.
 *
 * MILESTONES. Voiding freed the proposal milestones the invoice billed; the
 * re-issue claims them again, so it is refused if, since the void, another
 * live invoice (any status but VOID, drafts included) has started billing one
 * of them — re-read here on the server, never taken from the screen.
 *
 * NOT RE-CLAIMED: time and expenses. Voiding released them to the unbilled
 * list (lib/data/work-billing.ts) and the copied lines do not carry them; see
 * docs/finance/SPEC.md §6c.
 *
 * Administrator, director or founder only — the same people who void.
 */
export async function reissueInvoice(id: string): Promise<InvoiceDTO> {
  await requireInvoiceAction("reissue");
  const source = await getInvoice(id);
  if (!source) throw new InvoiceNotFoundError();
  if (source.status !== "VOID") throw new InvoiceActionError("Only a voided invoice can be re-issued.");

  const live = await prisma.invoice.findFirst({
    where: { reissuedFromId: id, deletedAt: null, status: { not: "VOID" } },
    select: { id: true },
  });
  if (live) throw new InvoiceActionError("This invoice has already been re-issued.");

  const milestoneIds = [...new Set(source.lines.map((l) => l.milestoneId).filter((m): m is string => Boolean(m)))];
  if (milestoneIds.length > 0) {
    const clash = await prisma.invoiceLine.findFirst({
      where: {
        milestoneId: { in: milestoneIds },
        invoice: { deletedAt: null, status: { not: "VOID" } },
      },
      select: { id: true },
    });
    if (clash) {
      throw new InvoiceActionError(
        "A proposal milestone on this invoice is already billed on another invoice, so it cannot be re-issued.",
      );
    }
  }

  const root = await reissueRoot(source.number, source.reissuedFromId);
  const number = reissueNumber(root, await allNumbers());
  const today = new Date().toISOString().slice(0, 10);
  const input: InvoiceInput = {
    number,
    currency: source.currency,
    clientId: source.clientId,
    clientName: source.clientName,
    contactName: source.contactName,
    contactEmail: source.contactEmail,
    billingAddress: source.billingAddress,
    projectId: source.projectId,
    projectName: source.projectName,
    serviceProposalId: source.serviceProposalId,
    proposalNumber: source.proposalNumber,
    title: source.title,
    intro: source.intro,
    issueDate: today,
    dueDate: dueDateFrom(today, source.termsDays),
    termsDays: source.termsDays,
    taxName: source.taxName,
    taxPercent: source.taxPercent,
    taxMode: source.taxMode,
    tax2Name: source.tax2Name,
    tax2Percent: source.tax2Percent,
    discountType: source.discountType,
    discountValue: source.discountValue,
    notes: source.notes,
    footer: source.footer,
    lines: source.lines.map((l) => ({
      description: l.description,
      milestoneId: l.milestoneId,
      milestoneName: l.milestoneName,
      quantity: l.quantity,
      unitRate: l.unitRate,
      amount: l.amount,
      taxable: l.taxable,
    })),
  };
  return createInvoice(input, { reissuedFrom: { id: source.id, number: source.number } });
}

// ── Sent ───────────────────────────────────────────────────────────────────

/**
 * Stamp an invoice as emailed. Called ONLY after lib/server/document-email.ts
 * returned `ok: true` — i.e. the mail provider handed back a message id — and
 * never on a failed or unconfirmed send (lib/server/invoice-email.ts).
 *
 * ISSUED becomes SENT; an invoice already SENT stays SENT. The money still
 * decides PART_PAID / PAID (lib/finance/calc.ts), so re-sending a part-paid
 * invoice changes nothing but the stamp. A re-send overwrites the last
 * sent-to / by / at and adds one to `sentCount`; every attempt, failed ones
 * too, is in the email log against this invoice.
 */
export async function markInvoiceSent(id: string, sentTo: string): Promise<void> {
  const who = await requireActor();
  const current = await requireInvoice(id);
  if (current.status === "DRAFT" || current.status === "VOID") return;
  await prisma.invoice.update({
    where: { id },
    data: {
      sentAt: new Date(),
      sentTo: sentTo.slice(0, 500),
      sentByName: who.name,
      sentCount: { increment: 1 },
      ...(current.status === "ISSUED" ? { status: "SENT" } : {}),
    },
  });
}

/** May this invoice be emailed? Only once issued, and never once voided. */
export async function requireSendableInvoice(id: string): Promise<void> {
  const current = await requireInvoice(id);
  if (current.status === "DRAFT") throw new InvoiceActionError("Issue the invoice before emailing it.");
  if (current.status === "VOID") throw new InvoiceActionError("A voided invoice cannot be emailed.");
}
