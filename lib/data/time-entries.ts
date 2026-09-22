/**
 * Timesheets — data access. SERVER-ONLY.
 *
 * Every read and write goes through the Prisma tenant extension (TimeEntry is
 * in TENANT_MODELS), and single-row reads use `findFirst` rather than
 * `findUnique` for the reason lib/data/invoices.ts sets out: the extension puts
 * the company into the WHERE of a findFirst, while for findUnique it can only
 * inspect the row that comes back.
 *
 * ─── WHO MAY DO WHAT ────────────────────────────────────────────────────────
 * You log your own hours. Logging hours FOR SOMEBODY ELSE, and approving or
 * rejecting anybody's, is member-administrator work (ADMIN, DIRECTOR or the
 * founder — `canManagePasswords`, the same gate the rest of the app uses).
 * Enforced here rather than only in the UI, because a server action is a public
 * endpoint: anything reachable from the browser can be called directly.
 *
 * ─── WHAT IS IMMUTABLE ──────────────────────────────────────────────────────
 * An entry that has been invoiced is frozen — editing the hours behind a
 * document a client has already been sent is how a practice loses an argument
 * about a bill. An APPROVED entry is frozen to its owner but still editable by
 * an approver, who is the person accountable for having signed it off.
 *
 * RATES ARE SNAPSHOTTED at save time from the person's record and never read
 * again. A rate rise next quarter prices the next hour logged, not last
 * quarter's.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { requireActor, type Actor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";
import { roundHours, timeValue, weekDays, weekStart } from "@/lib/finance/timesheet";
import type { FinanceApprovalStatus, TimeEntryDTO, TimeEntryInput, TimeFilter } from "@/lib/finance/types";

export class TimeEntryNotFoundError extends Error {
  constructor() {
    super("That timesheet entry could not be found.");
    this.name = "TimeEntryNotFoundError";
  }
}

export class TimeEntryLockedError extends Error {
  constructor(why: string) {
    super(why);
    this.name = "TimeEntryLockedError";
  }
}

export class TimeEntryForbiddenError extends Error {
  constructor(what: string) {
    super(`Only a director or an administrator can ${what}.`);
    this.name = "TimeEntryForbiddenError";
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

function numOrNull(v: DecimalLike): number | null {
  return v === null || v === undefined ? null : num(v);
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
  phaseId: string | null;
  phaseName: string | null;
  date: Date;
  hours: DecimalLike;
  billable: boolean;
  chargeRate: DecimalLike;
  costRate: DecimalLike;
  currency: string;
  description: string | null;
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

function toDTO(r: Row): TimeEntryDTO {
  const hours = roundHours(num(r.hours));
  const chargeRate = numOrNull(r.chargeRate);
  return {
    id: r.id,
    userId: r.userId,
    userName: r.userName,
    projectId: r.projectId,
    projectName: r.projectName,
    phaseId: r.phaseId,
    phaseName: r.phaseName,
    date: ymd(r.date) ?? "",
    hours,
    billable: r.billable,
    chargeRate,
    costRate: numOrNull(r.costRate),
    currency: r.currency,
    description: r.description,
    status: r.status,
    submittedAt: r.submittedAt?.toISOString() ?? null,
    approvedAt: r.approvedAt?.toISOString() ?? null,
    approvedByName: r.approvedByName,
    rejectedReason: r.rejectedReason,
    invoicedAt: r.invoicedAt?.toISOString() ?? null,
    invoiceId: r.invoiceId,
    invoiceNumber: r.invoiceNumber,
    value: r.billable ? timeValue(hours, chargeRate, r.currency) : 0,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

const SELECT = {
  id: true,
  userId: true,
  userName: true,
  projectId: true,
  projectName: true,
  phaseId: true,
  phaseName: true,
  date: true,
  hours: true,
  billable: true,
  chargeRate: true,
  costRate: true,
  currency: true,
  description: true,
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

// ── Reads ──────────────────────────────────────────────────────────────────

function whereFrom(filter: TimeFilter | undefined) {
  const where: Record<string, unknown> = { deletedAt: null };
  if (filter?.userId) where.userId = filter.userId;
  if (filter?.projectId) where.projectId = filter.projectId;
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

export async function listTimeEntries(filter?: TimeFilter): Promise<TimeEntryDTO[]> {
  const rows = await prisma.timeEntry.findMany({
    where: whereFrom(filter),
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: SELECT,
    take: 1000,
  });
  return rows.map((r) => toDTO(r as Row));
}

/** One person's week, Monday to Sunday, for the timesheet grid. */
export async function listWeek(
  date: string,
  userId?: string,
): Promise<{ start: string; days: string[]; entries: TimeEntryDTO[]; userId: string }> {
  const actor = await requireActor();
  const who = userId && isApprover(actor) ? userId : actor.id;
  const start = weekStart(date);
  const days = weekDays(start);
  const entries = await listTimeEntries({ userId: who, from: days[0], to: days[6] });
  return { start, days, entries, userId: who };
}

export async function getTimeEntry(id: string): Promise<TimeEntryDTO | null> {
  const row = await prisma.timeEntry.findFirst({ where: { id, deletedAt: null }, select: SELECT });
  return row ? toDTO(row as Row) : null;
}

/**
 * Everyone whose hours this caller may log, with the rates that would be
 * snapshotted onto an entry.
 *
 * A COLLEAGUE'S RATES ARE NOT PUBLIC. What a person is charged out at, and what
 * they cost the practice, is between them and whoever sets it — so anybody who
 * is not a member administrator gets exactly one row back: their own.
 */
export async function listTimekeepers(): Promise<
  { id: string; name: string; chargeOutRate: number | null; costRate: number | null }[]
> {
  const actor = await requireActor();
  const rows = await prisma.user.findMany({
    // User is NOT tenant-scoped by the extension — the company filter is ours to
    // carry (see lib/server/actor.ts). Dropping it lists other practices' staff.
    where: isApprover(actor)
      ? { companyId: actor.companyId, status: "ACTIVE" }
      : { companyId: actor.companyId, id: actor.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, chargeOutRate: true, costRate: true },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    chargeOutRate: numOrNull(r.chargeOutRate as DecimalLike),
    costRate: numOrNull(r.costRate as DecimalLike),
  }));
}

// ── Writes ─────────────────────────────────────────────────────────────────

/** The names and rates copied onto a new entry, resolved once. */
async function snapshot(actor: Actor, input: TimeEntryInput) {
  const targetId = input.userId && input.userId !== actor.id ? input.userId : actor.id;
  if (targetId !== actor.id && !isApprover(actor)) {
    throw new TimeEntryForbiddenError("log hours for somebody else");
  }

  const person = await prisma.user.findFirst({
    where: { id: targetId, companyId: actor.companyId },
    select: { id: true, name: true, chargeOutRate: true, costRate: true },
  });
  if (!person) throw new TimeEntryNotFoundError();

  const project = input.projectId
    ? await prisma.project.findFirst({
        where: { id: input.projectId },
        select: { id: true, name: true, currency: true },
      })
    : null;

  const phase = input.phaseId
    ? await prisma.projectPhase.findFirst({
        where: { id: input.phaseId },
        select: { id: true, name: true },
      })
    : null;

  return {
    userId: person.id,
    userName: person.name,
    projectId: project?.id ?? null,
    projectName: project?.name ?? null,
    phaseId: phase?.id ?? null,
    phaseName: phase?.name ?? null,
    // An explicit rate on the input overrides the standard one for this row
    // only; `?? null` and not `|| null` so a deliberate 0 survives.
    chargeRate:
      input.chargeRate ?? numOrNull(person.chargeOutRate as DecimalLike) ?? null,
    costRate: input.costRate ?? numOrNull(person.costRate as DecimalLike) ?? null,
    currency: input.currency ?? project?.currency ?? "AWG",
  };
}

export async function logTime(input: TimeEntryInput): Promise<TimeEntryDTO> {
  const actor = await requireActor();
  const snap = await snapshot(actor, input);
  const date = toDate(input.date);
  if (!date) throw new TimeEntryLockedError("That is not a date an entry can be logged on.");

  const row = await prisma.timeEntry.create({
    data: {
      ...snap,
      date,
      hours: roundHours(input.hours),
      billable: input.billable ?? true,
      description: input.description ?? null,
      status: "DRAFT",
    },
    select: SELECT,
  });
  return toDTO(row as Row);
}

/** What stops an entry being changed, in the order the user should hear it. */
async function assertWritable(id: string, actor: Actor): Promise<Row> {
  const row = (await prisma.timeEntry.findFirst({
    where: { id, deletedAt: null },
    select: SELECT,
  })) as Row | null;
  if (!row) throw new TimeEntryNotFoundError();

  if (row.invoicedAt) {
    throw new TimeEntryLockedError(
      `These hours are on invoice ${row.invoiceNumber ?? "already raised"}, so they cannot be changed.`,
    );
  }
  const approver = isApprover(actor);
  if (row.userId !== actor.id && !approver) {
    throw new TimeEntryForbiddenError("change somebody else's hours");
  }
  if (row.status === "APPROVED" && !approver) {
    throw new TimeEntryLockedError("These hours have been approved. Ask a director to reopen them.");
  }
  return row;
}

export async function updateTimeEntry(id: string, input: TimeEntryInput): Promise<TimeEntryDTO> {
  const actor = await requireActor();
  await assertWritable(id, actor);
  const snap = await snapshot(actor, input);
  const date = toDate(input.date);
  if (!date) throw new TimeEntryLockedError("That is not a date an entry can be logged on.");

  const row = await prisma.timeEntry.update({
    where: { id },
    data: {
      ...snap,
      date,
      hours: roundHours(input.hours),
      billable: input.billable ?? true,
      description: input.description ?? null,
      // An edit undoes a rejection and a submission: the row goes back to being
      // a draft rather than staying flagged for a reason that has been dealt
      // with, or sitting in an approver's queue as something they never saw.
      status: "DRAFT",
      rejectedReason: null,
      submittedAt: null,
    },
    select: SELECT,
  });
  return toDTO(row as Row);
}

/** Soft delete. An invoiced entry is never removed — it is the record of a bill. */
export async function deleteTimeEntry(id: string): Promise<void> {
  const actor = await requireActor();
  await assertWritable(id, actor);
  await prisma.timeEntry.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function submitTimeEntries(ids: string[]): Promise<number> {
  const actor = await requireActor();
  if (ids.length === 0) return 0;
  const approver = isApprover(actor);
  const result = await prisma.timeEntry.updateMany({
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

/**
 * Sign hours off, or send them back with a reason.
 *
 * SUBMITTED rows only: approving a draft the owner has not finished is how a
 * half-typed week ends up on an invoice. A rejection always carries a reason —
 * "rejected" with no note is an argument next week.
 */
export async function decideTimeEntries(
  ids: string[],
  decision: { approve: boolean; reason?: string | null },
): Promise<number> {
  const actor = await requireActor();
  if (!isApprover(actor)) throw new TimeEntryForbiddenError("approve or reject hours");
  if (ids.length === 0) return 0;

  const result = await prisma.timeEntry.updateMany({
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

/** Reopen approved hours for correction. Approvers only, and never once billed. */
export async function reopenTimeEntries(ids: string[]): Promise<number> {
  const actor = await requireActor();
  if (!isApprover(actor)) throw new TimeEntryForbiddenError("reopen approved hours");
  if (ids.length === 0) return 0;
  const result = await prisma.timeEntry.updateMany({
    where: { id: { in: ids }, deletedAt: null, invoicedAt: null, status: "APPROVED" },
    data: { status: "DRAFT", approvedAt: null, approvedById: null, approvedByName: null },
  });
  return result.count;
}

/**
 * Set what a person is charged out at, and what their hour costs the practice.
 *
 * MEMBER ADMINISTRATORS ONLY. A charge-out rate is the price of the firm's
 * work and a cost rate is close to somebody's salary — neither is a field a
 * colleague may rewrite, and the check is here rather than only on the screen
 * because an action is a public endpoint.
 *
 * Changing a rate prices the NEXT hour logged. Entries already saved keep the
 * rates they were saved with; rewriting history is what the snapshot exists to
 * prevent.
 */
export async function setPersonRates(
  userId: string,
  rates: { chargeOutRate: number | null; costRate: number | null },
): Promise<void> {
  const actor = await requireActor();
  if (!isApprover(actor)) throw new TimeEntryForbiddenError("set charge-out and cost rates");

  const target = await prisma.user.findFirst({
    // User is NOT tenant-scoped by the extension — the company filter is ours
    // to carry (see lib/server/actor.ts). Dropping it edits another practice's
    // staff.
    where: { id: userId, companyId: actor.companyId },
    select: { id: true },
  });
  if (!target) throw new TimeEntryNotFoundError();

  const clean = (v: number | null) =>
    v === null || !Number.isFinite(v) || v < 0 ? null : Math.round(v * 100) / 100;

  await prisma.user.update({
    where: { id: target.id },
    data: { chargeOutRate: clean(rates.chargeOutRate), costRate: clean(rates.costRate) },
  });
}
