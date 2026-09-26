/**
 * Turning approved work into invoice lines. PURE — rows in, lines out.
 *
 * ─── WHY GROUPING IS A DECISION, NOT A DETAIL ───────────────────────────────
 * Forty timesheet rows are not forty invoice lines. A client who receives an
 * invoice with one line per half-day reads it as an attempt to bury the total,
 * and a practice that sends one line saying "professional services" gets asked
 * to break it down. The middle — one line per person, with their hours and
 * their rate, and one line per expense — is what a quantity surveyor expects
 * and what survives being queried.
 *
 * ─── THE FIGURES COME FROM THE ROWS, NOT FROM A RE-CALCULATION ──────────────
 * Each timesheet row already carries the rate it was saved with, so a line's
 * amount is the sum of its rows' own values in integer cents. Nothing here
 * multiplies hours by a current rate: that would re-price work that was done
 * and agreed months ago, which is the thing the rate snapshot exists to stop.
 *
 * ─── WHAT MAY BE BILLED IS `isBillableValue`, AND ONLY THAT ─────────────────
 * Approved, marked billable, and not already on an invoice. This module takes
 * that test from lib/finance/timesheet.ts rather than restating it; two
 * definitions of "billable" in one codebase is how a job gets billed twice.
 *
 * ─── A LINE WITH A RATE MUST MULTIPLY OUT ───────────────────────────────────
 * Grouping is by person AND rate, not by person. A weighted average across a
 * mid-job rate rise does not reconcile: 14 hours at an averaged 178.57 is
 * 2,499.98, and the invoice says 2,500. The client's own arithmetic disagreeing
 * with the invoice by two cents is a query, a credit note and a lost afternoon.
 * So the split is one line per rate — which is also how a quantity surveyor
 * expects to read it — and a line that genuinely has no single rate (the
 * collapsed summary, an expense) carries no rate at all rather than a plausible
 * one.
 */
import { add, fromMajor, sum, toMajor, zero } from "@/lib/proposals/engine/money";
import { expenseChargeable, isBillableValue, roundHours, timeValue } from "./timesheet";
import type { ExpenseDTO, TimeEntryDTO } from "./types";

export type BillableTime = Pick<
  TimeEntryDTO,
  "id" | "userId" | "userName" | "projectId" | "projectName" | "date" | "hours" | "billable" | "status" | "chargeRate" | "currency" | "description" | "invoicedAt"
>;

export type BillableExpense = Pick<
  ExpenseDTO,
  "id" | "projectId" | "projectName" | "date" | "category" | "description" | "vendor" | "amount" | "markupPercent" | "billable" | "status" | "currency" | "invoicedAt"
>;

/** One proposed invoice line, with the rows it came from. */
export type WorkLine = {
  /** `time:<userId>@<rate>`, `time:all` or `expense:<id>` — stable, so a UI can
   *  key on it. */
  key: string;
  kind: "TIME" | "EXPENSE";
  description: string;
  /** Hours, when the line HAS a single rate to multiply them by. Null on an
   *  expense and on the collapsed summary line — see the note below. */
  quantity: number | null;
  unitRate: number | null;
  amount: number;
  /** The hours behind the line either way, for the screen to show. */
  hours: number;
  /** The ids that will be stamped as invoiced when this line is raised. */
  timeEntryIds: string[];
  expenseIds: string[];
};

export type WorkSummary = {
  currency: string;
  lines: WorkLine[];
  totalHours: number;
  total: number;
  /** Rows that cannot be billed, and why — shown rather than silently dropped. */
  excluded: { id: string; what: string; why: string }[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function whyNotBillable(row: { billable: boolean; status: string; invoicedAt: string | null }): string | null {
  if (row.invoicedAt) return "already on an invoice";
  if (!row.billable) return "not billable";
  if (row.status !== "APPROVED") return `not approved (${row.status.toLowerCase()})`;
  return null;
}

/**
 * Group a project's approved work into invoice lines.
 *
 * `summarise` collapses all time into one line — for the client who wants a
 * single figure. The rows behind it are still stamped individually, so the
 * double-bill guard is unaffected by how the invoice reads.
 */
export function workToLines(input: {
  time: BillableTime[];
  expenses: BillableExpense[];
  currency: string;
  summarise?: boolean;
}): WorkSummary {
  const currency = input.currency || "AWG";
  const excluded: WorkSummary["excluded"] = [];

  const time = input.time.filter((t) => {
    if ((t.currency || currency) !== currency) return false;
    const why = whyNotBillable(t);
    if (why) {
      excluded.push({ id: t.id, what: `${roundHours(t.hours)} h on ${t.date}`, why });
      return false;
    }
    return isBillableValue(t);
  });

  const expenses = input.expenses.filter((e) => {
    if ((e.currency || currency) !== currency) return false;
    const why = whyNotBillable(e);
    if (why) {
      excluded.push({ id: e.id, what: e.description || "expense", why });
      return false;
    }
    return isBillableValue(e);
  });

  const lines: WorkLine[] = [];

  if (input.summarise && time.length > 0) {
    lines.push(summarised(time, currency));
  } else {
    // Person AND rate: see the note at the top of this file.
    const byPersonRate = new Map<string, BillableTime[]>();
    for (const t of time) {
      const key = `${t.userId || t.userName || "unknown"}@${t.chargeRate ?? 0}`;
      byPersonRate.set(key, [...(byPersonRate.get(key) ?? []), t]);
    }
    for (const [key, rows] of byPersonRate) lines.push(personLine(key, rows, currency));
  }

  for (const e of expenses) {
    const amount = expenseChargeable(e.amount, e.markupPercent, currency);
    lines.push({
      key: `expense:${e.id}`,
      kind: "EXPENSE",
      description: [e.description, e.vendor ? `(${e.vendor})` : ""].filter(Boolean).join(" "),
      quantity: null,
      unitRate: null,
      amount,
      hours: 0,
      timeEntryIds: [],
      expenseIds: [e.id],
    });
  }

  const totalHours = round2(time.reduce((t, r) => t + roundHours(r.hours), 0));
  const total = toMajor(
    lines.reduce((acc, l) => add(acc, fromMajor(l.amount, currency)), zero(currency)),
  );

  return { currency, lines, totalHours, total, excluded };
}

function personLine(key: string, rows: BillableTime[], currency: string): WorkLine {
  const hours = round2(rows.reduce((t, r) => t + roundHours(r.hours), 0));
  const rate = rows[0]?.chargeRate ?? 0;
  // Multiplied ONCE, not summed per row: every row in this group shares the
  // rate, so hours × rate is both correct and exactly what the line displays.
  const amount = toMajor(fromMajor(hours * rate, currency));
  const name = rows[0]?.userName || "Professional services";
  const dates = rows.map((r) => r.date).sort();

  return {
    key: `time:${key}`,
    kind: "TIME",
    description:
      dates.length > 1 && dates[0] !== dates[dates.length - 1]
        ? `${name} — ${hours} hours, ${dates[0]} to ${dates[dates.length - 1]}`
        : `${name} — ${hours} hours on ${dates[0] ?? ""}`.trim(),
    quantity: hours,
    unitRate: rate,
    amount,
    hours,
    timeEntryIds: rows.map((r) => r.id),
    expenseIds: [],
  };
}

function summarised(rows: BillableTime[], currency: string): WorkLine {
  const hours = round2(rows.reduce((t, r) => t + roundHours(r.hours), 0));
  const amount = toMajor(
    sum(
      rows.map((r) => fromMajor(timeValue(r.hours, r.chargeRate, currency), currency)),
      currency,
    ),
  );
  const dates = rows.map((r) => r.date).sort();
  return {
    key: "time:all",
    kind: "TIME",
    description:
      dates.length > 1 && dates[0] !== dates[dates.length - 1]
        ? `Professional services — ${hours} hours, ${dates[0]} to ${dates[dates.length - 1]}`
        : `Professional services — ${hours} hours`,
    // No rate: this line covers whatever rates the work was done at, and a
    // single figure here would not multiply out.
    quantity: null,
    unitRate: null,
    amount,
    hours,
    timeEntryIds: rows.map((r) => r.id),
    expenseIds: [],
  };
}

/** The ids a set of chosen lines will stamp. */
export function idsFor(lines: WorkLine[], chosenKeys: string[]): { timeEntryIds: string[]; expenseIds: string[] } {
  const chosen = new Set(chosenKeys);
  const timeEntryIds: string[] = [];
  const expenseIds: string[] = [];
  for (const line of lines) {
    if (!chosen.has(line.key)) continue;
    timeEntryIds.push(...line.timeEntryIds);
    expenseIds.push(...line.expenseIds);
  }
  return { timeEntryIds, expenseIds };
}

/** What the chosen lines add up to. */
export function chosenTotal(lines: WorkLine[], chosenKeys: string[], currency: string): number {
  const chosen = new Set(chosenKeys);
  return toMajor(
    lines
      .filter((l) => chosen.has(l.key))
      .reduce((acc, l) => add(acc, fromMajor(l.amount, currency)), zero(currency)),
  );
}
