/**
 * Schedule Budget — BUDGET vs COMMITTED vs RECEIVED, rolled up per activity.
 *
 * PROTECTED SYSTEM (schedule) — additive layer, approved 2026-08-04.
 *
 * SCOPE, STATED PLAINLY. This is an operational cost rollup, not earned value.
 * There is no CPI, no BCWP/ACWP, no S-curve. Three columns and an honest
 * reconciliation is the whole feature.
 *
 * WHY THIS FILE EXISTS AT ALL
 * ---------------------------
 * Every figure the Budget panel paints is produced here, and the same functions are
 * what any server-side total must call. A component that did its own `a + b` would
 * eventually disagree with the server about what a project costs, and the first
 * anyone would hear of it is a client asking why two screens differ. So: no money
 * arithmetic outside this module.
 *
 * EXACTNESS. Amounts are carried as integer minor units via lib/proposals/engine/money.
 * That module is imported rather than re-implemented — a second rounding convention in
 * the same application is exactly the drift this is meant to prevent. Read its header
 * for the reasoning; the short version is that binary floats cannot promise that a
 * split reconciles to its total, and a budget screen that loses a cent per row is a
 * budget screen nobody trusts.
 *
 * PURE: no I/O, no Prisma, no React. Safe to import from the client panel and from a
 * server action alike.
 */
import {
  type Money,
  add,
  allocate,
  compare,
  fromMajor,
  subtract,
  sum,
  toMajor,
  zero,
} from "@/lib/proposals/engine/money";

export type { Money };
export { toMajor };

/* ── Inputs ────────────────────────────────────────────────────────────────── */

/** Where a task's budget figure came from. Provenance, not a calculation input. */
export type BudgetSource = "manual" | "estimate";

/** The slice of a schedule task this rollup needs. Deliberately structural, so the
 *  protected `ScheduleTask` type is never imported into the money layer. */
export interface BudgetTask {
  id: string;
  name: string;
  parentId?: string | null;
  /** Major units (what the DB Decimal holds). `null`/absent = no budget set, which
   *  is NOT the same as a budget of zero and is reported differently. */
  budgetAmount?: number | null;
  budgetSource?: string | null;
}

export type CommitmentStatus =
  | "DRAFT"
  | "ISSUED"
  | "PARTIAL"
  | "RECEIVED"
  | "CLOSED"
  | "CANCELLED";

/** A purchase order, flattened to the four numbers this rollup can defend. */
export interface Commitment {
  id: string;
  /** PO number, for the unassigned list. */
  reference: string;
  vendorName: string;
  status: CommitmentStatus;
  /** `ScheduleTask.taskKey`, or null when nobody has attributed this order. */
  taskKey?: string | null;
  currency: string;
  /** Order grand total: lines + tax + shipping. */
  total: number;
  /** Sum of quantity × unitPrice across the lines (tax/shipping excluded). */
  linesSubtotal: number;
  /** Sum of min(receivedQty, quantity) × unitPrice across the lines. */
  receivedSubtotal: number;
}

/**
 * A purchase order becomes a COMMITMENT the moment it is issued to a supplier — that
 * is when the firm is on the hook for the money.
 *
 * DRAFT is excluded: an unissued order is an intention, and counting intentions as
 * commitments would make the schedule look encumbered by orders nobody has sent.
 * CANCELLED is excluded because the obligation was withdrawn.
 */
export const COMMITTED_STATUSES: readonly CommitmentStatus[] = [
  "ISSUED",
  "PARTIAL",
  "RECEIVED",
  "CLOSED",
];

export function isCommitted(c: Pick<Commitment, "status">): boolean {
  return COMMITTED_STATUSES.includes(c.status);
}

/* ── Per-commitment money ──────────────────────────────────────────────────── */

/** Committed value of one order: its full grand total, or nothing if not committed. */
export function committedValue(c: Commitment, currency: string): Money {
  return isCommitted(c) ? fromMajor(c.total, currency) : zero(currency);
}

/**
 * RECEIVED value of one order.
 *
 * THIS IS NOT "SPENT", AND THE COLUMN IS NOT LABELLED SPENT. This application has no
 * vendor invoice, no payment and no ledger — grep the schema, there is no Invoice or
 * Payment model. The strongest actual-cost evidence that exists is the receiving
 * workflow: `receivedQty` per purchase-order line. So the third column reports the
 * value of goods RECEIVED. Calling it Spent would imply an invoice was raised and
 * money left the account, and neither is recorded anywhere in this app.
 *
 * Tax and shipping sit on the order, not on the lines, so they are allocated to the
 * received share pro-rata by `allocate` — an exact split that always reconciles to the
 * order total, never a re-derived percentage.
 *
 * FALLBACK, AND WHY. If no line receipt was ever recorded but the order's status
 * asserts full receipt (RECEIVED / CLOSED), the whole order counts as received. Some
 * users close an order out without walking the line-level receiving screen, and
 * reporting zero received against an order explicitly marked RECEIVED would understate
 * actuals while the status column says otherwise. Line evidence always wins when it
 * exists.
 */
export function receivedValue(c: Commitment, currency: string): Money {
  if (!isCommitted(c)) return zero(currency);
  const total = fromMajor(c.total, currency);

  const lines = fromMajor(c.linesSubtotal, currency);
  const received = fromMajor(c.receivedSubtotal, currency);

  if (received.minor <= 0) {
    return c.status === "RECEIVED" || c.status === "CLOSED" ? total : zero(currency);
  }
  if (lines.minor <= 0) return total; // receipts but no priced lines — nothing to split by
  if (received.minor >= lines.minor) return total;

  const [receivedShare] = allocate(total, [received.minor, lines.minor - received.minor]);
  return receivedShare;
}

/* ── Rollup ────────────────────────────────────────────────────────────────── */

/** How a task's committed value sits against its budget. Returned as a state rather
 *  than left to the component, so no comparison arithmetic escapes this module. */
export type BudgetState = "no-budget" | "under" | "on" | "over";

export function budgetState(budget: Money | null, committed: Money): BudgetState {
  if (budget === null) return "no-budget";
  const c = compare(committed, budget);
  return c > 0 ? "over" : c === 0 ? "on" : "under";
}

export interface BudgetRow {
  taskId: string;
  name: string;
  parentId: string | null;
  /** null = no budget set (distinct from a zero budget). */
  budget: Money | null;
  budgetSource: BudgetSource | null;
  committed: Money;
  received: Money;
  /** budget − committed. Zero when no budget is set. */
  variance: Money;
  state: BudgetState;
  commitmentCount: number;
}

export interface UnassignedBucket {
  /** How many committed orders carry no task attribution. */
  count: number;
  committed: Money;
  received: Money;
  orders: { id: string; reference: string; vendorName: string; status: CommitmentStatus }[];
}

export interface ExcludedBucket {
  /** Orders in a currency this rollup cannot add. */
  count: number;
  currencies: string[];
  orders: { id: string; reference: string; currency: string; total: number }[];
}

export interface BudgetTotals {
  budget: Money;
  committed: Money;
  received: Money;
  variance: Money;
  /** Tasks with no budget figure at all — the rollup's own completeness measure. */
  tasksWithoutBudget: number;
  tasksTotal: number;
}

export interface BudgetRollup {
  currency: string;
  rows: BudgetRow[];
  totals: BudgetTotals;
  unassigned: UnassignedBucket;
  excluded: ExcludedBucket;
  /**
   * Commitments attributed to a task key that is not in this programme — typically a
   * task deleted after the order was raised. Surfaced, never silently dropped.
   */
  orphaned: UnassignedBucket;
  /** Parent tasks that carry their own budget while also having budgeted children.
   *  Both are counted once each in the total, so this is a double-count warning. */
  doubleCountedParents: string[];
}

/**
 * The whole rollup, in one pass.
 *
 * NO PARENT AGGREGATION, ON PURPOSE. Every task's own `budgetAmount` is counted exactly
 * once and a parent is never the sum of its children. Rolling children up into a parent
 * that also carries a figure would double-count that money, and silently choosing which
 * one "wins" would be worse. Where a user has done both, `doubleCountedParents` names
 * the tasks so the panel can say so out loud.
 *
 * Orders in a currency other than `currency` are NOT converted — there is no FX rate in
 * this application, and inventing one would fabricate money. They land in `excluded`.
 */
export function rollupBudget(input: {
  tasks: BudgetTask[];
  commitments: Commitment[];
  currency: string;
}): BudgetRollup {
  const { tasks, currency } = input;
  const z = zero(currency);

  const excluded: ExcludedBucket = { count: 0, currencies: [], orders: [] };
  const usable: Commitment[] = [];
  for (const c of input.commitments) {
    if (c.currency !== currency) {
      if (!isCommitted(c)) continue; // an uncommitted foreign draft is not money at risk
      excluded.count += 1;
      if (!excluded.currencies.includes(c.currency)) excluded.currencies.push(c.currency);
      excluded.orders.push({ id: c.id, reference: c.reference, currency: c.currency, total: c.total });
      continue;
    }
    usable.push(c);
  }

  const taskIds = new Set(tasks.map((t) => t.id));
  const byTask = new Map<string, Commitment[]>();
  const noTask: Commitment[] = [];
  const orphan: Commitment[] = [];
  for (const c of usable) {
    const key = c.taskKey ?? null;
    if (key === null || key === "") {
      noTask.push(c);
    } else if (!taskIds.has(key)) {
      orphan.push(c);
    } else {
      const list = byTask.get(key);
      if (list) list.push(c);
      else byTask.set(key, [c]);
    }
  }

  const rows: BudgetRow[] = tasks.map((t) => {
    const mine = byTask.get(t.id) ?? [];
    const committed = sum(mine.map((c) => committedValue(c, currency)), currency);
    const received = sum(mine.map((c) => receivedValue(c, currency)), currency);
    const budget =
      t.budgetAmount === null || t.budgetAmount === undefined
        ? null
        : fromMajor(t.budgetAmount, currency);
    return {
      taskId: t.id,
      name: t.name,
      parentId: t.parentId ?? null,
      budget,
      budgetSource: normalizeSource(t.budgetSource),
      committed,
      received,
      variance: budget === null ? z : subtract(budget, committed),
      state: budgetState(budget, committed),
      commitmentCount: mine.filter(isCommitted).length,
    };
  });

  const budgeted = rows.filter((r) => r.budget !== null);
  const totalBudget = sum(budgeted.map((r) => r.budget as Money), currency);
  const totalCommitted = sum(rows.map((r) => r.committed), currency);
  const totalReceived = sum(rows.map((r) => r.received), currency);

  return {
    currency,
    rows,
    totals: {
      budget: totalBudget,
      committed: totalCommitted,
      received: totalReceived,
      variance: subtract(totalBudget, totalCommitted),
      tasksWithoutBudget: rows.length - budgeted.length,
      tasksTotal: rows.length,
    },
    unassigned: bucket(noTask, currency),
    orphaned: bucket(orphan, currency),
    excluded,
    doubleCountedParents: doubleCounted(tasks),
  };
}

function bucket(list: Commitment[], currency: string): UnassignedBucket {
  const committedOnly = list.filter(isCommitted);
  return {
    count: committedOnly.length,
    committed: sum(committedOnly.map((c) => committedValue(c, currency)), currency),
    received: sum(committedOnly.map((c) => receivedValue(c, currency)), currency),
    orders: committedOnly.map((c) => ({
      id: c.id,
      reference: c.reference,
      vendorName: c.vendorName,
      status: c.status,
    })),
  };
}

function doubleCounted(tasks: BudgetTask[]): string[] {
  const hasBudget = (t: BudgetTask) => t.budgetAmount !== null && t.budgetAmount !== undefined;
  const budgetedChildParents = new Set(
    tasks.filter((t) => hasBudget(t) && t.parentId).map((t) => t.parentId as string),
  );
  return tasks.filter((t) => hasBudget(t) && budgetedChildParents.has(t.id)).map((t) => t.name);
}

function normalizeSource(raw: string | null | undefined): BudgetSource | null {
  return raw === "manual" || raw === "estimate" ? raw : null;
}

/* ── Estimate reconciliation ───────────────────────────────────────────────── */

/** One selectable line of the project's Cost Estimate, as the adapter hands it over.
 *  Amounts arrive already computed by the protected `estimateTotals` family — this
 *  module never re-derives an estimate figure, it only converts and adds. */
export interface EstimateLine {
  /** "cat:<id>" or "item:<id>" — the ref recorded in `ScheduleTask.budgetRef`. */
  ref: string;
  label: string;
  kind: "category" | "item";
  /** Parent category ref for an item, else null. */
  parentRef: string | null;
  amount: number;
}

export interface EstimateReconciliation {
  /** Estimate grand total (with profit/BBO) — the project's actual baseline. */
  grandTotal: Money;
  /** Direct cost, which is what the selectable lines sum to. */
  direct: Money;
  /** How much of the direct cost has been placed on a task. */
  allocated: Money;
  /** direct − allocated. Positive means estimate money not yet on the programme. */
  unallocated: Money;
}

/**
 * Reconcile the tasks' estimate-sourced budgets against the estimate's own direct cost.
 *
 * Only budgets whose source is "estimate" count as allocated. A manually typed figure is
 * the user's own number and has no claim on estimate money — folding it in would make
 * "unallocated" mean nothing.
 */
export function reconcileEstimate(input: {
  tasks: BudgetTask[];
  grandTotal: number;
  direct: number;
  currency: string;
}): EstimateReconciliation {
  const { currency } = input;
  const allocated = sum(
    input.tasks
      .filter((t) => normalizeSource(t.budgetSource) === "estimate" && t.budgetAmount != null)
      .map((t) => fromMajor(t.budgetAmount as number, currency)),
    currency,
  );
  const direct = fromMajor(input.direct, currency);
  return {
    grandTotal: fromMajor(input.grandTotal, currency),
    direct,
    allocated,
    unallocated: subtract(direct, allocated),
  };
}

/** Exact sum of the chosen estimate lines — what a "seed from estimate" action writes.
 *  Selecting a category AND one of its items would count that money twice, so items
 *  whose parent category is also selected are dropped. */
export function sumEstimateLines(lines: EstimateLine[], refs: string[], currency: string): Money {
  const chosen = new Set(refs);
  const picked = lines.filter(
    (l) => chosen.has(l.ref) && !(l.parentRef !== null && chosen.has(l.parentRef)),
  );
  return sum(picked.map((l) => fromMajor(l.amount, currency)), currency);
}

/* ── Input parsing ─────────────────────────────────────────────────────────── */

/**
 * Parse what a user typed into a budget amount in major units, or null to clear it.
 *
 * Empty clears the budget (back to "not set"), which is why this returns
 * `{ ok, value: number | null }` rather than a bare number. Anything unparseable is
 * rejected rather than coerced to 0 — silently turning a typo into a zero budget would
 * make a task look fully under budget.
 */
export function parseBudgetInput(
  raw: string,
): { ok: true; value: number | null } | { ok: false; reason: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, value: null };
  // Accept grouped input ("1,234.50") but not a bare thousands separator.
  const cleaned = trimmed.replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return { ok: false, reason: "Not a number" };
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return { ok: false, reason: "Not a number" };
  if (n < 0) return { ok: false, reason: "A budget cannot be negative" };
  return { ok: true, value: toMajor(fromMajor(n, "XXX")) };
}

/** Total of a set of Money values — exported so a caller never writes `+` on money. */
export function totalOf(values: Money[], currency: string): Money {
  return sum(values, currency);
}

export { add, subtract, zero, fromMajor };
