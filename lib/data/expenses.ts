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
