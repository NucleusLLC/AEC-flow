/**
 * Time and expense arithmetic. PURE — no Prisma, no React, no I/O.
 *
 * WHY THIS FILE EXISTS. Hours are the practice's stock. The same set of entries
 * is read four ways — the person's week, the project's cost, what may be billed
 * next, and what has already gone out on an invoice — and every one of those
 * has to agree. One implementation, tested, is the only way that holds. This is
 * the same argument `lib/finance/calc.ts` makes for invoice totals.
 *
 * MONEY IS NEVER A FLOAT HERE. Every amount goes through
 * `lib/proposals/engine/money.ts`, the repo's one exact-money primitive, so a
 * rate of 142.50 times 7.25 hours is a cent-exact figure and not 1033.1250000001.
 * HOURS, by contrast, ARE plain numbers: they are a quantity, not money, and
 * rounding them to cents would be meaningless. They are rounded to two decimals
 * at the boundary so a stored 7.249999 never prints as 7.25 and sums as 7.24.
 *
 * WHAT COUNTS AS BILLABLE WORK is decided in one place, `isBillableValue`, and
 * it is deliberately strict: the hours must be marked billable, they must be
 * APPROVED, and they must not already sit on an invoice. Hours somebody typed
 * this morning are not revenue, and hours billed in March are not revenue
 * twice.
 */
import {
  add,
  applyPercent,
  fromMajor,
  multiply,
  subtract,
  sum,
  toMajor,
  zero,
} from "@/lib/proposals/engine/money";
import type { FinanceApprovalStatus } from "./types";

/** Nobody works more than a day in a day. The data layer rejects more. */
export const MAX_HOURS_PER_DAY = 24;

/** Timesheets are kept to the quarter hour — the granularity a fee is defended at. */
export const HOUR_STEP = 0.25;

/** Hours as they are stored and shown: a quantity, two decimals, never negative. */
export function roundHours(hours: number | string | null | undefined): number {
  const n = typeof hours === "string" ? Number(hours) : hours;
  if (n === null || n === undefined || !Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

/** The nearest quarter hour, for the entry form's stepper. */
export function toQuarterHour(hours: number | string | null | undefined): number {
  const n = roundHours(hours);
  return Math.round(n / HOUR_STEP) * HOUR_STEP;
}

/** Whether a figure can be saved as a day's hours at all. */
export function isValidHours(hours: number | string | null | undefined): boolean {
  const n = typeof hours === "string" ? Number(hours) : hours;
  if (n === null || n === undefined || !Number.isFinite(n)) return false;
  return n > 0 && n <= MAX_HOURS_PER_DAY;
}

/** What `hours` at `rate` is worth. Zero when either is missing — never a guess. */
export function timeValue(
  hours: number | string | null | undefined,
  rate: number | string | null | undefined,
  currency: string,
): number {
  const h = roundHours(hours);
  if (h === 0) return 0;
  const r = fromMajor(rate, currency);
  if (r.minor === 0) return 0;
  return toMajor(multiply(r, h));
}

/**
 * What an expense is charged on at, once the practice's handling markup is
 * added. A markup of 0 (the default) means the client pays exactly what was
 * spent, which is what most reimbursables are.
 */
export function expenseChargeable(
  amount: number | string | null | undefined,
  markupPercent: number | null | undefined,
  currency: string,
): number {
  const net = fromMajor(amount, currency);
  const percent = Number.isFinite(markupPercent ?? NaN) ? Math.max(0, markupPercent as number) : 0;
  if (percent === 0) return toMajor(net);
  return toMajor(add(net, applyPercent(net, percent)));
}

// ── What is billable ───────────────────────────────────────────────────────

/** A time entry as the arithmetic sees it. */
export type CalcTimeEntry = {
  date?: string | null;
  hours: number | string | null | undefined;
  billable?: boolean;
  status?: FinanceApprovalStatus;
  chargeRate?: number | string | null;
  costRate?: number | string | null;
  invoicedAt?: string | null;
  projectId?: string | null;
  projectName?: string | null;
};

/** An expense as the arithmetic sees it. */
export type CalcExpense = {
  date?: string | null;
  amount: number | string | null | undefined;
  markupPercent?: number | null;
  billable?: boolean;
  status?: FinanceApprovalStatus;
  invoicedAt?: string | null;
  projectId?: string | null;
  projectName?: string | null;
};

/**
 * Whether this row may still be put on an invoice.
 *
 * Three conditions, all of them necessary: somebody marked it billable, an
 * approver signed it off, and it has not been billed already. `invoicedAt` is
 * the double-bill guard, the same role `milestoneId` plays on an invoice line.
 */
export function isBillableValue(row: {
  billable?: boolean;
  status?: FinanceApprovalStatus;
  invoicedAt?: string | null;
}): boolean {
  if (row.billable === false) return false;
  if (row.status !== "APPROVED") return false;
  return !row.invoicedAt;
}

// ── A person's week ────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

function parseYmd(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(t) ? null : t;
}

function ymd(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * The Monday of the week `date` falls in.
 *
 * Monday, not Sunday: the practice is in Aruba and works a Monday–Friday week,
 * and a timesheet whose week breaks in the middle of the working days is a
 * timesheet nobody can total. `weekStartsOn` is there for the day that changes.
 */
export function weekStart(date: string, weekStartsOn = 1): string {
  const t = parseYmd(date);
  if (t === null) return date.slice(0, 10);
  const dow = new Date(t).getUTCDay(); // 0 = Sunday
  const back = (dow - weekStartsOn + 7) % 7;
  return ymd(t - back * DAY_MS);
}

/** The seven dates of the week beginning `start`, in order. */
export function weekDays(start: string): string[] {
  const t = parseYmd(start);
  if (t === null) return [];
  return Array.from({ length: 7 }, (_, i) => ymd(t + i * DAY_MS));
}

/** The same weekday, `weeks` weeks away. Negative goes back. */
export function shiftWeek(start: string, weeks: number): string {
  const t = parseYmd(start);
  if (t === null) return start;
  return ymd(t + Math.trunc(weeks) * 7 * DAY_MS);
}

export type TimesheetTotals = {
  hours: number;
  billableHours: number;
  nonBillableHours: number;
  /** What the billable hours are worth at their snapshotted rates. */
  value: number;
  /** What all the hours cost the practice, billable or not. */
  cost: number;
};

/**
 * Totals for a set of entries.
 *
 * `value` counts hours marked billable at their charge rate WHATEVER their
 * approval state — this is the week's worth, not the amount that may be
 * invoiced. `unbilledByProject` is the one that applies the stricter test, and
 * the two are separate numbers on purpose: a director looking at a week wants
 * to see work that has not been approved yet, not a hole where it should be.
 */
export function timesheetTotals(entries: CalcTimeEntry[], currency: string): TimesheetTotals {
  let hours = 0;
  let billableHours = 0;
  let value = zero(currency);
  let cost = zero(currency);

  for (const e of entries) {
    const h = roundHours(e.hours);
    if (h === 0) continue;
    hours = Math.round((hours + h) * 100) / 100;
    if (e.billable !== false) {
      billableHours = Math.round((billableHours + h) * 100) / 100;
      value = add(value, fromMajor(timeValue(h, e.chargeRate, currency), currency));
    }
    cost = add(cost, fromMajor(timeValue(h, e.costRate, currency), currency));
  }

  return {
    hours,
    billableHours,
    nonBillableHours: Math.round((hours - billableHours) * 100) / 100,
    value: toMajor(value),
    cost: toMajor(cost),
  };
}

/** Billable share of the hours worked, 0–100, rounded to a whole percent. */
export function utilisationPct(billableHours: number, totalHours: number): number {
  if (!Number.isFinite(totalHours) || totalHours <= 0) return 0;
  const pct = (billableHours / totalHours) * 100;
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export type TimesheetCell = { date: string; hours: number };

export type TimesheetRow = {
  /** `projectId` or the literal "none" — a stable key for React and for grouping. */
  key: string;
  projectId: string | null;
  projectName: string;
  billable: boolean;
  cells: TimesheetCell[];
  total: number;
};

export type TimesheetGrid = {
  days: string[];
  rows: TimesheetRow[];
  dayTotals: number[];
  total: number;
};

/**
 * The week grid: one row per project-and-billability, one column per day.
 *
 * Billable and non-billable hours on the same project are SEPARATE rows. They
 * are different things — one is stock, the other is overhead — and a grid that
 * adds them into one cell hides the number the practice is actually managing.
 * Entries outside `days` are ignored rather than folded into the edge columns.
 */
export function timesheetGrid(entries: CalcTimeEntry[], days: string[]): TimesheetGrid {
  const index = new Map(days.map((d, i) => [d, i]));
  const rows = new Map<string, TimesheetRow>();
  const dayTotals = days.map(() => 0);
  let total = 0;

  for (const e of entries) {
    const day = (e.date ?? "").slice(0, 10);
    const col = index.get(day);
    if (col === undefined) continue;
    const h = roundHours(e.hours);
    if (h === 0) continue;

    const billable = e.billable !== false;
    const projectId = e.projectId ?? null;
    const key = `${projectId ?? "none"}:${billable ? "b" : "n"}`;
    let row = rows.get(key);
    if (!row) {
      row = {
        key,
        projectId,
        projectName: e.projectName ?? "No project",
        billable,
        cells: days.map((d) => ({ date: d, hours: 0 })),
        total: 0,
      };
      rows.set(key, row);
    }
    row.cells[col].hours = Math.round((row.cells[col].hours + h) * 100) / 100;
    row.total = Math.round((row.total + h) * 100) / 100;
    dayTotals[col] = Math.round((dayTotals[col] + h) * 100) / 100;
    total = Math.round((total + h) * 100) / 100;
  }

  return {
    days,
    rows: [...rows.values()].sort(
      (a, b) => a.projectName.localeCompare(b.projectName) || Number(b.billable) - Number(a.billable),
    ),
    dayTotals,
    total,
  };
}

// ── What may still be billed ───────────────────────────────────────────────

export type UnbilledProject = {
  projectId: string | null;
  projectName: string;
  hours: number;
  /** The billable hours at their snapshotted charge rates. */
  timeValue: number;
  /** Billable expenses at cost plus their markup. */
  expenseValue: number;
  total: number;
};

/**
 * Work in progress: approved, billable, not yet invoiced — per project.
 *
 * This is the number a practice raises its next invoice from, so it applies
 * `isBillableValue` strictly. Mixed currencies are summed as if they were one,
 * for the same reason `receivablesSummary` does: the caller filters to a
 * currency, because a total across currencies is a number with no meaning.
 */
export function unbilledByProject(
  entries: CalcTimeEntry[],
  expenses: CalcExpense[],
  currency: string,
): UnbilledProject[] {
  const rows = new Map<string, UnbilledProject>();

  const row = (projectId: string | null, projectName: string | null | undefined) => {
    const key = projectId ?? "none";
    let r = rows.get(key);
    if (!r) {
      r = {
        projectId,
        projectName: projectName ?? "No project",
        hours: 0,
        timeValue: 0,
        expenseValue: 0,
        total: 0,
      };
      rows.set(key, r);
    }
    return r;
  };

  for (const e of entries) {
    if (!isBillableValue(e)) continue;
    const h = roundHours(e.hours);
    if (h === 0) continue;
    const r = row(e.projectId ?? null, e.projectName);
    r.hours = Math.round((r.hours + h) * 100) / 100;
    r.timeValue = toMajor(
      add(fromMajor(r.timeValue, currency), fromMajor(timeValue(h, e.chargeRate, currency), currency)),
    );
  }

  for (const x of expenses) {
    if (!isBillableValue(x)) continue;
    const r = row(x.projectId ?? null, x.projectName);
    r.expenseValue = toMajor(
      add(
        fromMajor(r.expenseValue, currency),
        fromMajor(expenseChargeable(x.amount, x.markupPercent, currency), currency),
      ),
    );
  }

  for (const r of rows.values()) {
    r.total = toMajor(add(fromMajor(r.timeValue, currency), fromMajor(r.expenseValue, currency)));
  }

  return [...rows.values()].sort((a, b) => b.total - a.total || a.projectName.localeCompare(b.projectName));
}

export type ExpenseSummary = {
  count: number;
  /** Everything recorded, whoever pays for it in the end. */
  spent: number;
  /** The part that will be passed on, at cost plus markup. */
  rechargeable: number;
  /** The part the practice carries itself. */
  absorbed: number;
  /** Approved, billable, not yet on an invoice. */
  unbilled: number;
  /** Owed back to the people who paid out of pocket, still unapproved or unpaid. */
  awaitingApproval: number;
};

/** The expense register's tiles. Rejected rows are counted nowhere. */
export function expenseSummary(expenses: CalcExpense[], currency: string): ExpenseSummary {
  let count = 0;
  let spent = zero(currency);
  let rechargeable = zero(currency);
  let unbilled = zero(currency);
  let awaiting = zero(currency);

  for (const x of expenses) {
    if (x.status === "REJECTED") continue;
    count += 1;
    const net = fromMajor(x.amount, currency);
    spent = add(spent, net);
    const charge = fromMajor(expenseChargeable(x.amount, x.markupPercent, currency), currency);
    if (x.billable !== false) rechargeable = add(rechargeable, charge);
    if (isBillableValue(x)) unbilled = add(unbilled, charge);
    if (x.status === "DRAFT" || x.status === "SUBMITTED") awaiting = add(awaiting, net);
  }

  const absorbed = sum(
    expenses
      .filter((x) => x.status !== "REJECTED" && x.billable === false)
      .map((x) => fromMajor(x.amount, currency)),
    currency,
  );

  return {
    count,
    spent: toMajor(spent),
    rechargeable: toMajor(rechargeable),
    absorbed: toMajor(absorbed),
    unbilled: toMajor(unbilled),
    awaitingApproval: toMajor(awaiting),
  };
}

export type ProjectProfitability = {
  projectId: string | null;
  projectName: string;
  hours: number;
  /** Charge-out worth of billable hours plus rechargeable expenses. */
  earned: number;
  /** Labour at internal cost rates plus every expense the job incurred. */
  cost: number;
  margin: number;
  marginPct: number;
};

/**
 * Cost against worth, per project — the first half of F4.
 *
 * COST INCLUDES NON-BILLABLE HOURS. A project that took forty unbilled hours to
 * fix cost the practice those hours whether or not a client ever sees them;
 * leaving them out is how a job looks profitable right up until payroll.
 * `earned` is what the work is worth at charge-out, NOT what has been invoiced
 * or collected — those are `receivablesSummary`'s numbers, and mixing the two
 * would double-count the same job.
 */
export function projectProfitability(
  entries: CalcTimeEntry[],
  expenses: CalcExpense[],
  currency: string,
): ProjectProfitability[] {
  const rows = new Map<string, ProjectProfitability>();

  const row = (projectId: string | null, projectName: string | null | undefined) => {
    const key = projectId ?? "none";
    let r = rows.get(key);
    if (!r) {
      r = {
        projectId,
        projectName: projectName ?? "No project",
        hours: 0,
        earned: 0,
        cost: 0,
        margin: 0,
        marginPct: 0,
      };
      rows.set(key, r);
    }
    return r;
  };

  for (const e of entries) {
    if (e.status === "REJECTED") continue;
    const h = roundHours(e.hours);
    if (h === 0) continue;
    const r = row(e.projectId ?? null, e.projectName);
    r.hours = Math.round((r.hours + h) * 100) / 100;
    if (e.billable !== false) {
      r.earned = toMajor(
        add(fromMajor(r.earned, currency), fromMajor(timeValue(h, e.chargeRate, currency), currency)),
      );
    }
    r.cost = toMajor(
      add(fromMajor(r.cost, currency), fromMajor(timeValue(h, e.costRate, currency), currency)),
    );
  }

  for (const x of expenses) {
    if (x.status === "REJECTED") continue;
    const r = row(x.projectId ?? null, x.projectName);
    if (x.billable !== false) {
      r.earned = toMajor(
        add(
          fromMajor(r.earned, currency),
          fromMajor(expenseChargeable(x.amount, x.markupPercent, currency), currency),
        ),
      );
    }
    r.cost = toMajor(add(fromMajor(r.cost, currency), fromMajor(x.amount, currency)));
  }

  for (const r of rows.values()) {
    r.margin = toMajor(subtract(fromMajor(r.earned, currency), fromMajor(r.cost, currency)));
    r.marginPct = r.earned > 0 ? Math.round((r.margin / r.earned) * 1000) / 10 : 0;
  }

  return [...rows.values()].sort((a, b) => b.earned - a.earned || a.projectName.localeCompare(b.projectName));
}
