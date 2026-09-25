/**
 * Raising an invoice from approved work, and releasing it again. SERVER-ONLY.
 *
 * ─── THE STAMP IS THE GUARD, AND IT IS WRITTEN IN THE SAME TRANSACTION ──────
 * `invoicedAt` / `invoiceId` / `invoiceNumber` on a timesheet row is what stops
 * the same hour being billed twice, and it is only true if it cannot come apart
 * from the invoice it names. Creating the invoice and stamping the rows in one
 * `$transaction` is the whole design: a crash between the two would either bill
 * work that still looks unbilled, or mark work billed on an invoice that does
 * not exist.
 *
 * ─── THE ROWS ARE RE-READ INSIDE THE TRANSACTION ────────────────────────────
 * The browser sends ids it saw a moment ago. Between the page rendering and the
 * click, a colleague may have billed the same hours. So the update is
 * conditional — `invoicedAt: null` is in the WHERE — and if it matches fewer
 * rows than were asked for, the whole thing rolls back rather than issuing an
 * invoice for work that was already on someone else's.
 *
 * ─── VOIDING RELEASES THE WORK ──────────────────────────────────────────────
 * A voided invoice is withdrawn, so the hours on it are billable again. Without
 * that, voiding an invoice quietly destroys the practice's right to bill the
 * work, which is a worse bug than the one the guard prevents.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/server/actor";
import {
  chosenTotal,
  workToLines,
  type BillableExpense,
  type BillableTime,
  type WorkSummary,
} from "@/lib/finance/billing";
import { expenseChargeable, roundHours, timeValue } from "@/lib/finance/timesheet";
import { invoiceTotals, nextInvoiceNumber } from "@/lib/finance/calc";
import type { TaxMode } from "@/lib/finance/types";

export class WorkBillingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkBillingError";
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

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** What could go on an invoice for this project, grouped into lines. */
export async function unbilledWork(input: {
  projectId: string;
  currency?: string;
  summarise?: boolean;
}): Promise<WorkSummary & { projectName: string; clientId: string | null; clientName: string }> {
  await requireActor();

  const project = await prisma.project.findFirst({
    where: { id: input.projectId },
    select: { id: true, name: true, currency: true, clientId: true, client: { select: { name: true } } },
  });
  if (!project) throw new WorkBillingError("That project could not be found.");

  const currency = input.currency || project.currency || "AWG";

  // Deliberately NOT filtered to billable + approved here: `workToLines` makes
  // that decision and reports what it turned away, and the "why is Tuesday not
  // on this invoice" list is the whole point of it doing so. Filtering here
  // would leave that list permanently empty — the screen would look correct and
  // answer nothing.
  //
  // Already-invoiced rows ARE filtered out, and that is a different judgement:
  // they would otherwise accumulate forever and bury the handful of rows that
  // are genuinely being held back. Where a billed hour went is a question the
  // timesheet answers, against the invoice number stamped on the row.
  const [timeRows, expenseRows] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { projectId: project.id, deletedAt: null, invoicedAt: null },
      orderBy: [{ date: "asc" }],
      take: 5000,
    }),
    prisma.expense.findMany({
      where: { projectId: project.id, deletedAt: null, invoicedAt: null },
      orderBy: [{ date: "asc" }],
      take: 2000,
    }),
  ]);

  const time: BillableTime[] = timeRows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: r.userName,
    projectId: r.projectId,
    projectName: r.projectName,
    date: ymd(r.date),
    hours: num(r.hours),
    billable: r.billable,
    status: r.status as BillableTime["status"],
    chargeRate: r.chargeRate === null ? null : num(r.chargeRate),
    currency: r.currency,
    description: r.description,
    invoicedAt: r.invoicedAt?.toISOString() ?? null,
  }));

  const expenses: BillableExpense[] = expenseRows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    projectName: r.projectName,
    date: ymd(r.date),
    category: r.category as BillableExpense["category"],
    description: r.description,
    vendor: r.vendor,
    amount: num(r.amount),
    markupPercent: num(r.markupPercent),
    billable: r.billable,
    status: r.status as BillableExpense["status"],
    currency: r.currency,
    invoicedAt: r.invoicedAt?.toISOString() ?? null,
  }));

  return {
    ...workToLines({ time, expenses, currency, summarise: input.summarise }),
    projectName: project.name,
    clientId: project.clientId,
    clientName: project.client?.name ?? "",
  };
}

/**
 * Jobs with approved work waiting to be billed, worst-neglected first.
 *
 * Deliberately NOT gated behind the profit gate: this is charge-out value —
 * what a client can be asked for — not cost or margin. A project lead who may
 * raise an invoice must be able to see what there is to invoice.
 */
export async function projectsWithUnbilledWork(): Promise<
  { projectId: string; projectName: string; currency: string; hours: number; total: number; oldest: string | null }[]
> {
  await requireActor();

  const [timeRows, expenseRows] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { deletedAt: null, billable: true, status: "APPROVED", invoicedAt: null, projectId: { not: null } },
      select: { projectId: true, projectName: true, date: true, hours: true, chargeRate: true, currency: true },
      take: 20_000,
    }),
    prisma.expense.findMany({
      where: { deletedAt: null, billable: true, status: "APPROVED", invoicedAt: null, projectId: { not: null } },
      select: { projectId: true, projectName: true, date: true, amount: true, markupPercent: true, currency: true },
      take: 20_000,
    }),
  ]);

  // Keyed by project AND currency: a job billed in two currencies is two rows,
  // never one meaningless sum. Same rule the registers keep.
  const acc = new Map<
    string,
    { projectId: string; projectName: string; currency: string; hours: number; total: number; oldest: string | null }
  >();

  const touch = (projectId: string, projectName: string | null, currency: string, date: Date) => {
    const key = `${projectId}:${currency}`;
    const row =
      acc.get(key) ??
      { projectId, projectName: projectName || "Untitled project", currency, hours: 0, total: 0, oldest: null };
    const d = ymd(date);
    if (!row.oldest || d < row.oldest) row.oldest = d;
    acc.set(key, row);
    return row;
  };

  for (const r of timeRows) {
    if (!r.projectId) continue;
    const currency = r.currency || "AWG";
    const row = touch(r.projectId, r.projectName, currency, r.date);
    row.hours += roundHours(num(r.hours));
    row.total += timeValue(num(r.hours), num(r.chargeRate), currency);
  }

  for (const r of expenseRows) {
    if (!r.projectId) continue;
    const currency = r.currency || "AWG";
    const row = touch(r.projectId, r.projectName, currency, r.date);
    row.total += expenseChargeable(num(r.amount), num(r.markupPercent), currency);
  }

  return [...acc.values()]
    .map((r) => ({ ...r, hours: Math.round(r.hours * 100) / 100, total: Math.round(r.total * 100) / 100 }))
    .filter((r) => r.total > 0 || r.hours > 0)
    .sort((a, b) => (a.oldest ?? "9999").localeCompare(b.oldest ?? "9999"));
}

export type RaiseFromWorkInput = {
  projectId: string;
  /** Line keys from `unbilledWork`. */
  lineKeys: string[];
  summarise?: boolean;
  /**
   * The net total the screen displayed, in major units.
   *
   * THIS IS THE CONCURRENCY CHECK, and the conditional updateMany below is not
   * enough on its own. The work is re-grouped from the database inside this
   * call, so if a colleague billed one of the ticked rows a moment ago, the
   * line simply comes back smaller and the updateMany matches every row it is
   * given — an invoice is raised, for less than the amount the person read and
   * approved. Comparing against what they saw is the only thing that catches
   * it, and it catches every other way the work can shift too: an edited rate,
   * a withdrawn approval, a deleted row.
   */
  expectedTotal?: number;
  currency?: string;
  taxName?: string | null;
  taxPercent?: number;
  taxMode?: TaxMode;
  title?: string | null;
  intro?: string | null;
  termsDays?: number | null;
};

/**
 * Create a DRAFT invoice from the chosen work and stamp the rows behind it.
 *
 * The invoice is raised as a DRAFT on purpose: the practice reads it, adjusts
 * the wording, and issues it. The stamp goes on immediately even so — the work
 * IS spoken for the moment it lands on a draft, and a second person raising a
 * second invoice from the same hours while the first sits unissued is exactly
 * the failure this prevents. Deleting the draft releases them again.
 */
export async function raiseInvoiceFromWork(
  input: RaiseFromWorkInput,
): Promise<{ id: string; number: string; stampedTime: number; stampedExpenses: number }> {
  const actor = await requireActor();
  const work = await unbilledWork({
    projectId: input.projectId,
    currency: input.currency,
    summarise: input.summarise,
  });

  const chosen = work.lines.filter((l) => input.lineKeys.includes(l.key));
  if (chosen.length === 0) throw new WorkBillingError("Nothing was chosen to bill.");

  const missing = input.lineKeys.filter((k) => !work.lines.some((l) => l.key === k));
  if (missing.length > 0) {
    throw new WorkBillingError(
      "Some of that work is no longer available to bill. Nothing was raised — reload and try again.",
    );
  }

  if (input.expectedTotal !== undefined) {
    const now = chosenTotal(work.lines, input.lineKeys, work.currency);
    // Half a cent: the figures are already exact minor units on both sides, so
    // any real difference is a change in the underlying work, not rounding.
    if (Math.abs(now - input.expectedTotal) >= 0.005) {
      throw new WorkBillingError(
        `This work is now worth ${now.toFixed(2)} ${work.currency}, not ${input.expectedTotal.toFixed(2)}. ` +
          "Somebody changed or billed some of it while this page was open. Nothing was raised — reload and check.",
      );
    }
  }

  const currency = work.currency;
  const lines = chosen.map((l, i) => ({
    description: l.description,
    quantity: l.quantity,
    unitRate: l.unitRate,
    amount: l.amount,
    taxable: true,
    sortOrder: i,
  }));

  const totals = invoiceTotals(
    lines,
    { percent: input.taxPercent ?? 0, mode: input.taxMode ?? "EXCLUSIVE" },
    currency,
  );

  const existing = await prisma.invoice.findMany({ select: { number: true }, take: 5000 });
  const number = nextInvoiceNumber(existing.map((e) => e.number), new Date().getFullYear());
  const stampedAt = new Date();

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.create({
      data: {
        number,
        status: "DRAFT",
        currency,
        clientId: work.clientId,
        clientName: work.clientName || work.projectName,
        projectId: input.projectId,
        projectName: work.projectName,
        title: input.title?.trim() || `Professional services — ${work.projectName}`,
        intro: input.intro?.trim() || null,
        termsDays: input.termsDays ?? null,
        taxName: input.taxName?.trim() || null,
        taxPercent: input.taxPercent ?? 0,
        taxMode: input.taxMode ?? "EXCLUSIVE",
        subtotal: totals.subtotal,
        taxableSubtotal: totals.taxableSubtotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        createdById: actor.id,
        createdByName: actor.name,
      },
    });

    let stampedTime = 0;
    let stampedExpenses = 0;

    for (let i = 0; i < chosen.length; i += 1) {
      const source = chosen[i];
      // Child rows are written TOP-LEVEL and stamped with the company — a line
      // created through a nested `create` lands with a NULL company and the
      // later company-scoped deleteMany never matches it. Same note as
      // lib/data/invoices.ts. One at a time rather than `createMany`, because
      // each source row is stamped with the id of the line it ended up on:
      // "which line was I billed on" is the first thing anyone queries.
      const line = await tx.invoiceLine.create({
        data: { ...lines[i], invoiceId: invoice.id, companyId: actor.companyId },
      });

      const stamp = {
        invoicedAt: stampedAt,
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        invoiceLineId: line.id,
      };

      if (source.timeEntryIds.length > 0) {
        const done = await tx.timeEntry.updateMany({
          // `invoicedAt: null` is the race guard: between this page rendering
          // and the click, a colleague may have billed the same hours.
          where: { id: { in: source.timeEntryIds }, invoicedAt: null, deletedAt: null },
          data: stamp,
        });
        if (done.count !== source.timeEntryIds.length) {
          throw new WorkBillingError(
            "Some of those hours were billed by someone else a moment ago. Nothing was raised — reload and try again.",
          );
        }
        stampedTime += done.count;
      }

      if (source.expenseIds.length > 0) {
        const done = await tx.expense.updateMany({
          where: { id: { in: source.expenseIds }, invoicedAt: null, deletedAt: null },
          data: stamp,
        });
        if (done.count !== source.expenseIds.length) {
          throw new WorkBillingError(
            "Some of those expenses were billed by someone else a moment ago. Nothing was raised — reload and try again.",
          );
        }
        stampedExpenses += done.count;
      }
    }

    return { id: invoice.id, number: invoice.number, stampedTime, stampedExpenses };
  });
}

/**
 * Give the work back: clear the stamp from everything billed on this invoice.
 *
 * Called when an invoice is voided or a draft deleted. Idempotent, so calling
 * it twice is harmless.
 */
export async function releaseWork(invoiceId: string): Promise<{ time: number; expenses: number }> {
  await requireActor();
  const clear = { invoicedAt: null, invoiceId: null, invoiceNumber: null, invoiceLineId: null };
  const [time, expenses] = await prisma.$transaction([
    prisma.timeEntry.updateMany({ where: { invoiceId }, data: clear }),
    prisma.expense.updateMany({ where: { invoiceId }, data: clear }),
  ]);
  return { time: time.count, expenses: expenses.count };
}

/** What this invoice was raised from, for the invoice screen. */
export async function billedWorkFor(invoiceId: string): Promise<{ hours: number; entries: number; expenses: number }> {
  await requireActor();
  const [time, expenses] = await Promise.all([
    prisma.timeEntry.findMany({ where: { invoiceId, deletedAt: null }, select: { hours: true } }),
    prisma.expense.count({ where: { invoiceId, deletedAt: null } }),
  ]);
  const hours = time.reduce((t, r) => t + num(r.hours), 0);
  return { hours: Math.round(hours * 100) / 100, entries: time.length, expenses };
}
