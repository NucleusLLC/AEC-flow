/**
 * Expenses — data access. SERVER-ONLY.
 *
 * The sibling of lib/data/time-entries.ts, and deliberately the same shape: the
 * two are the same idea (something a project consumed, recorded by a person,
 * signed off by an approver, then possibly billed) and a practice that has
 * learned one screen should not have to learn the other.
 *
 * Read the header of lib/data/time-entries.ts for the rules that apply to both:
 * the tenant extension and `findFirst`, who may record for whom, who may
 * approve, and why an invoiced row is frozen.
 *
 * WHAT IS DIFFERENT HERE. An expense carries a markup and a reimbursable flag.
 * `markupPercent` is handling added when the cost is passed on — it never
 * changes what was spent, only what is charged, and `lib/finance/timesheet.ts`
 * keeps the two apart. `reimbursable` says the money came out of somebody's own
 * pocket, so the practice owes it back whether or not a client ever pays it.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { requireActor, type Actor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";
import { expenseChargeable } from "@/lib/finance/timesheet";
import {
  buildReceiptKey,
  canChangeReceipt,
  canViewReceipt,
  isReceiptKeyForExpense,
  receiptDisplayName,
  validateReceipt,
} from "@/lib/finance/receipt";
import {
  createSignedDownload,
  createSignedUpload,
  deleteObject,
  isStorageConfigured,
  statObject,
} from "@/lib/server/storage";
import { randomUUID } from "node:crypto";
import type {
  ExpenseCategory,
  ExpenseDTO,
  ExpenseFilter,
  ExpenseInput,
  FinanceApprovalStatus,
} from "@/lib/finance/types";

export class ExpenseNotFoundError extends Error {
  constructor() {
    super("That expense could not be found.");
    this.name = "ExpenseNotFoundError";
  }
}

export class ExpenseLockedError extends Error {
  constructor(why: string) {
    super(why);
    this.name = "ExpenseLockedError";
  }
}

export class ExpenseForbiddenError extends Error {
  constructor(what: string) {
    super(`Only a director or an administrator can ${what}.`);
    this.name = "ExpenseForbiddenError";
  }
}

type DecimalLike = { toNumber(): number } | number | string | null | undefined;

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

function ymd(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(`${s.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isApprover(actor: Actor): boolean {
  return canManagePasswords(actor.role, actor.isFounder);
}

type Row = {
  id: string;
  userId: string;
  userName: string;
  projectId: string | null;
  projectName: string | null;
  date: Date;
  category: ExpenseCategory;
  vendor: string | null;
  description: string;
  amount: DecimalLike;
  currency: string;
  billable: boolean;
  markupPercent: DecimalLike;
  reimbursable: boolean;
  reimbursedAt: Date | null;
  status: FinanceApprovalStatus;
  submittedAt: Date | null;
  approvedAt: Date | null;
  approvedByName: string | null;
  rejectedReason: string | null;
  invoicedAt: Date | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  receiptFilename: string | null;
  receiptMimeType: string | null;
  receiptSizeBytes: number | null;
  receiptUploadedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const SELECT = {
  id: true,
  userId: true,
  userName: true,
  projectId: true,
  projectName: true,
  date: true,
  category: true,
  vendor: true,
  description: true,
  amount: true,
  currency: true,
  billable: true,
  markupPercent: true,
  reimbursable: true,
  reimbursedAt: true,
  status: true,
  submittedAt: true,
  approvedAt: true,
  approvedByName: true,
  rejectedReason: true,
  invoicedAt: true,
  invoiceId: true,
  invoiceNumber: true,
  // The receipt's description only — never its storage key, which stays in
  // this file (receiptKeyFor) and is never handed to a screen.
  receiptFilename: true,
  receiptMimeType: true,
  receiptSizeBytes: true,
  receiptUploadedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

function toDTO(r: Row): ExpenseDTO {
  const amount = num(r.amount);
  const markupPercent = num(r.markupPercent);
  return {
    id: r.id,
    userId: r.userId,
    userName: r.userName,
    projectId: r.projectId,
    projectName: r.projectName,
    date: ymd(r.date) ?? "",
    category: r.category,
    vendor: r.vendor,
    description: r.description,
    amount,
    currency: r.currency,
    billable: r.billable,
    markupPercent,
    reimbursable: r.reimbursable,
    reimbursedAt: r.reimbursedAt?.toISOString() ?? null,
    status: r.status,
    submittedAt: r.submittedAt?.toISOString() ?? null,
    approvedAt: r.approvedAt?.toISOString() ?? null,
    approvedByName: r.approvedByName,
    rejectedReason: r.rejectedReason,
    invoicedAt: r.invoicedAt?.toISOString() ?? null,
    invoiceId: r.invoiceId,
    invoiceNumber: r.invoiceNumber,
    chargeable: r.billable ? expenseChargeable(amount, markupPercent, r.currency) : 0,
    receipt:
      r.receiptFilename && r.receiptMimeType
        ? {
            filename: r.receiptFilename,
            mimeType: r.receiptMimeType,
            sizeBytes: r.receiptSizeBytes ?? 0,
            uploadedAt: r.receiptUploadedAt?.toISOString() ?? null,
          }
        : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// ── Reads ──────────────────────────────────────────────────────────────────

function whereFrom(filter: ExpenseFilter | undefined) {
  const where: Record<string, unknown> = { deletedAt: null };
  if (filter?.userId) where.userId = filter.userId;
  if (filter?.projectId) where.projectId = filter.projectId;
  if (filter?.category) where.category = filter.category;
  if (filter?.status === "UNBILLED") {
    where.status = "APPROVED";
    where.invoicedAt = null;
    where.billable = true;
  } else if (filter?.status && filter.status !== "ALL") {
    where.status = filter.status;
  }
  const from = toDate(filter?.from);
  const to = toDate(filter?.to);
  if (from || to) {
    where.date = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }
  return where;
}

export async function listExpenses(filter?: ExpenseFilter): Promise<ExpenseDTO[]> {
  const rows = await prisma.expense.findMany({
    where: whereFrom(filter),
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: SELECT,
    take: 1000,
  });
  return rows.map((r) => toDTO(r as Row));
}

/**
 * Approved entries in a date range for the accounting export, not capped (the
 * screen list stops at 1,000). Who may call this is decided by the export route.
 */
export async function listApprovedExpensesForExport(range: { from?: string; to?: string }): Promise<ExpenseDTO[]> {
  const rows = await prisma.expense.findMany({
    where: whereFrom({ status: "APPROVED", from: range.from, to: range.to }),
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: SELECT,
  });
  return rows.map((r) => toDTO(r as Row));
}

export async function getExpense(id: string): Promise<ExpenseDTO | null> {
  const row = await prisma.expense.findFirst({ where: { id, deletedAt: null }, select: SELECT });
  return row ? toDTO(row as Row) : null;
}

// ── Writes ─────────────────────────────────────────────────────────────────

async function snapshot(actor: Actor, input: ExpenseInput) {
  const targetId = input.userId && input.userId !== actor.id ? input.userId : actor.id;
  if (targetId !== actor.id && !isApprover(actor)) {
    throw new ExpenseForbiddenError("record an expense for somebody else");
  }

  const person = await prisma.user.findFirst({
    // User is NOT tenant-scoped by the extension — the company filter is ours
    // to carry (see lib/server/actor.ts).
    where: { id: targetId, companyId: actor.companyId },
    select: { id: true, name: true },
  });
  if (!person) throw new ExpenseNotFoundError();

  const project = input.projectId
    ? await prisma.project.findFirst({
        where: { id: input.projectId },
        select: { id: true, name: true, currency: true },
      })
    : null;

  return {
    userId: person.id,
    userName: person.name,
    projectId: project?.id ?? null,
    projectName: project?.name ?? null,
    currency: input.currency ?? project?.currency ?? "AWG",
  };
}

export async function recordExpense(input: ExpenseInput): Promise<ExpenseDTO> {
  const actor = await requireActor();
  const snap = await snapshot(actor, input);
  const date = toDate(input.date);
  if (!date) throw new ExpenseLockedError("That is not a date an expense can be recorded on.");

  const row = await prisma.expense.create({
    data: {
      ...snap,
      date,
      category: input.category,
      vendor: input.vendor ?? null,
      description: input.description,
      amount: input.amount,
      billable: input.billable ?? true,
      markupPercent: input.markupPercent ?? 0,
      reimbursable: input.reimbursable ?? false,
      status: "DRAFT",
    },
    select: SELECT,
  });
  return toDTO(row as Row);
}

async function assertWritable(id: string, actor: Actor): Promise<Row> {
  const row = (await prisma.expense.findFirst({
    where: { id, deletedAt: null },
    select: SELECT,
  })) as Row | null;
  if (!row) throw new ExpenseNotFoundError();

  if (row.invoicedAt) {
    throw new ExpenseLockedError(
      `This expense is on invoice ${row.invoiceNumber ?? "already raised"}, so it cannot be changed.`,
    );
  }
  const approver = isApprover(actor);
  if (row.userId !== actor.id && !approver) {
    throw new ExpenseForbiddenError("change somebody else's expense");
  }
  if (row.status === "APPROVED" && !approver) {
    throw new ExpenseLockedError("This expense has been approved. Ask a director to reopen it.");
  }
  return row;
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<ExpenseDTO> {
  const actor = await requireActor();
  await assertWritable(id, actor);
  const snap = await snapshot(actor, input);
  const date = toDate(input.date);
  if (!date) throw new ExpenseLockedError("That is not a date an expense can be recorded on.");

  const row = await prisma.expense.update({
    where: { id },
    data: {
      ...snap,
      date,
      category: input.category,
      vendor: input.vendor ?? null,
      description: input.description,
      amount: input.amount,
      billable: input.billable ?? true,
      markupPercent: input.markupPercent ?? 0,
      reimbursable: input.reimbursable ?? false,
      // An edit undoes a rejection and a submission — same rule as a timesheet.
      status: "DRAFT",
      rejectedReason: null,
      submittedAt: null,
    },
    select: SELECT,
  });
  return toDTO(row as Row);
}

/** Soft delete. An invoiced expense is never removed — it is part of a bill. */
export async function deleteExpense(id: string): Promise<void> {
  const actor = await requireActor();
  await assertWritable(id, actor);
  await prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function submitExpenses(ids: string[]): Promise<number> {
  const actor = await requireActor();
  if (ids.length === 0) return 0;
  const approver = isApprover(actor);
  const result = await prisma.expense.updateMany({
    where: {
      id: { in: ids },
      deletedAt: null,
      invoicedAt: null,
      status: { in: ["DRAFT", "REJECTED"] },
      ...(approver ? {} : { userId: actor.id }),
    },
    data: { status: "SUBMITTED", submittedAt: new Date(), rejectedReason: null },
  });
  return result.count;
}

export async function decideExpenses(
  ids: string[],
  decision: { approve: boolean; reason?: string | null },
): Promise<number> {
  const actor = await requireActor();
  if (!isApprover(actor)) throw new ExpenseForbiddenError("approve or reject expenses");
  if (ids.length === 0) return 0;

  const result = await prisma.expense.updateMany({
    where: { id: { in: ids }, deletedAt: null, invoicedAt: null, status: "SUBMITTED" },
    data: decision.approve
      ? {
          status: "APPROVED",
          approvedAt: new Date(),
          approvedById: actor.id,
          approvedByName: actor.name,
          rejectedReason: null,
        }
      : {
          status: "REJECTED",
          approvedAt: null,
          approvedById: actor.id,
          approvedByName: actor.name,
          rejectedReason: decision.reason ?? null,
        },
  });
  return result.count;
}

/**
 * Mark money as paid back to the person who laid it out.
 *
 * Only for rows flagged `reimbursable`, and deliberately independent of whether
 * a client has paid: what the practice owes its own people does not wait on a
 * receivable.
 */
export async function markReimbursed(ids: string[], paid: boolean): Promise<number> {
  const actor = await requireActor();
  if (!isApprover(actor)) throw new ExpenseForbiddenError("mark an expense as reimbursed");
  if (ids.length === 0) return 0;
  const result = await prisma.expense.updateMany({
    where: { id: { in: ids }, deletedAt: null, reimbursable: true },
    data: { reimbursedAt: paid ? new Date() : null },
  });
  return result.count;
}

// ── Receipts ───────────────────────────────────────────────────────────────
//
// The drawing-intake storage path exactly (lib/server/storage.ts): the server
// names the object and signs an upload URL, the browser PUTs the bytes straight
// to the private bucket, and only then does the server record them on the row —
// after checking the object really exists under a key it would have issued, and
// taking its size and type from storage rather than from the browser.
//
// Who may: the rules in lib/finance/receipt.ts, the same as editing the expense
// (an invoiced expense is frozen, receipt included). Viewing is the person who
// recorded it or an administrator. Every check is here, not on the screen,
// because a server action and a route are public endpoints.

export class ReceiptFileError extends Error {
  constructor(why: string) {
    super(why);
    this.name = "ReceiptFileError";
  }
}

export type ReceiptUploadTicket = {
  uploadUrl: string;
  storageKey: string;
  headers: Record<string, string>;
};

/** A receipt the browser uploaded and hands back, to be recorded on the expense. */
export type UploadedReceipt = { storageKey: string; filename: string };

function requireReceiptStorage(): void {
  if (!isStorageConfigured()) {
    throw new ReceiptFileError(
      "File storage is not connected on this deployment, so receipts cannot be attached yet.",
    );
  }
}

/** The row, if the actor may change its receipt; otherwise the reason, thrown. */
async function assertReceiptWritable(id: string, actor: Actor): Promise<Row> {
  const row = await assertWritable(id, actor);
  // assertWritable already refuses each case; this restates the rule from the
  // shared module so the two can never disagree silently.
  if (!canChangeReceipt(row, { id: actor.id, isAdmin: isApprover(actor) })) {
    throw new ExpenseLockedError("This expense's receipt cannot be changed.");
  }
  return row;
}

/** The current storage key of an expense's receipt. Tenant-scoped by findFirst. */
async function receiptKeyFor(id: string): Promise<string | null> {
  const row = await prisma.expense.findFirst({
    where: { id, deletedAt: null },
    select: { receiptStorageKey: true },
  });
  return row?.receiptStorageKey ?? null;
}

/** Step one of attaching a receipt: a signed URL the browser uploads to. */
export async function createReceiptUploadTicket(
  expenseId: string,
  file: { filename: string; mimeType: string; sizeBytes: number },
): Promise<ReceiptUploadTicket> {
  const actor = await requireActor();
  requireReceiptStorage();
  const row = await assertReceiptWritable(expenseId, actor);
  const verdict = validateReceipt({ name: file.filename, size: file.sizeBytes, type: file.mimeType });
  if (!verdict.ok) throw new ReceiptFileError(verdict.message);
  const signed = await createSignedUpload(buildReceiptKey(row.id, file.filename, randomUUID()));
  return {
    uploadUrl: signed.uploadUrl,
    storageKey: signed.storageKey,
    headers: { "content-type": verdict.mimeType },
  };
}

/**
 * Step three: record an uploaded receipt on the expense. Replaces any receipt
 * already there — the old object is deleted once the row points at the new one.
 */
export async function attachReceipt(expenseId: string, upload: UploadedReceipt): Promise<ExpenseDTO> {
  const actor = await requireActor();
  requireReceiptStorage();
  const row = await assertReceiptWritable(expenseId, actor);

  const storageKey = String(upload?.storageKey ?? "").trim();
  if (!isReceiptKeyForExpense(storageKey, row.id)) {
    throw new ReceiptFileError("That upload does not belong to this expense.");
  }
  const object = await statObject(storageKey);
  if (!object) throw new ReceiptFileError("The receipt did not finish uploading. Try again.");

  // Trust storage, not the caller, for what actually landed.
  const filename = String(upload.filename ?? "").trim();
  const verdict = validateReceipt({ name: filename || "receipt", size: object.sizeBytes, type: object.mimeType });
  if (!verdict.ok) {
    await deleteObject(storageKey).catch(() => {});
    throw new ReceiptFileError(verdict.message);
  }

  const previous = await receiptKeyFor(row.id);
  let updated: Row;
  try {
    updated = (await prisma.expense.update({
      where: { id: row.id },
      data: {
        receiptStorageKey: storageKey,
        receiptFilename: receiptDisplayName(filename, verdict.mimeType),
        receiptMimeType: verdict.mimeType,
        receiptSizeBytes: object.sizeBytes,
        receiptUploadedAt: new Date(),
      },
      select: SELECT,
    })) as Row;
  } catch (e) {
    await deleteObject(storageKey).catch(() => {});
    throw e;
  }
  if (previous && previous !== storageKey) await deleteObject(previous).catch(() => {});
  return toDTO(updated);
}

/** Take the receipt off the expense and delete the file. */
export async function removeReceipt(expenseId: string): Promise<void> {
  const actor = await requireActor();
  const row = await assertReceiptWritable(expenseId, actor);
  const previous = await receiptKeyFor(row.id);
  await prisma.expense.update({
    where: { id: row.id },
    data: {
      receiptStorageKey: null,
      receiptFilename: null,
      receiptMimeType: null,
      receiptSizeBytes: null,
      receiptUploadedAt: null,
    },
  });
  if (previous && isStorageConfigured()) await deleteObject(previous).catch(() => {});
}

/**
 * Remove an upload that never made it onto the row — the browser uploaded, then
 * recording it failed. Ignores a key that is not this expense's, and the key the
 * row already records.
 */
export async function discardReceiptUpload(expenseId: string, storageKey: string): Promise<void> {
  if (!isStorageConfigured()) return;
  const actor = await requireActor();
  const row = await assertReceiptWritable(expenseId, actor);
  const key = String(storageKey ?? "").trim();
  if (!isReceiptKeyForExpense(key, row.id)) return;
  if ((await receiptKeyFor(row.id)) === key) return;
  await deleteObject(key).catch(() => {});
}

/**
 * A five-minute signed URL for an expense's receipt, or null when there is none
 * (or this person may not see it — the same answer, so a guessed id learns
 * nothing). `download` asks storage to send it as an attachment.
 */
export async function getReceiptUrl(
  expenseId: string,
  options: { download?: boolean } = {},
): Promise<string | null> {
  const actor = await requireActor();
  const row = await prisma.expense.findFirst({
    where: { id: expenseId, deletedAt: null },
    select: { userId: true, receiptStorageKey: true, receiptFilename: true },
  });
  if (!row?.receiptStorageKey || !isStorageConfigured()) return null;
  if (!canViewReceipt(row, { id: actor.id, isAdmin: isApprover(actor) })) return null;
  const url = await createSignedDownload(row.receiptStorageKey);
  if (!options.download) return url;
  const name = row.receiptFilename || "receipt";
  return `${url}${url.includes("?") ? "&" : "?"}download=${encodeURIComponent(name)}`;
}
