/**
 * Invoice arithmetic. PURE — no Prisma, no React, no I/O.
 *
 * WHY THIS FILE EXISTS RATHER THAN A FEW `reduce`s IN THE PAGE. An invoice is
 * the one document in the app a client pays against, so its totals have to
 * agree everywhere they appear: the list, the detail screen, the printed sheet
 * and the row that gets stored. One implementation, tested, is the only way
 * that holds.
 *
 * MONEY IS NEVER A FLOAT HERE. Every sum goes through `lib/proposals/engine/money.ts`
 * — the repo's one exact-money primitive, already borrowed by the schedule
 * budget — so 0.1 + 0.2 is 0.30 and a tax line cannot drift a cent. Amounts
 * cross the boundary as major-unit numbers because that is what Prisma's
 * `Decimal` and the formatters take; the arithmetic in between is in minor units.
 */
import {
  add,
  applyPercent,
  fromMajor,
  isZero,
  multiply,
  subtract,
  sum,
  toMajor,
  zero,
  type Money,
} from "@/lib/proposals/engine/money";
import type { InvoiceStatus } from "./types";

/** A line as the arithmetic sees it: the amount rules, the rest is provenance. */
export type CalcLine = {
  amount: number | string | null | undefined;
  taxable?: boolean;
};

/** A payment as the arithmetic sees it. */
export type CalcPayment = { amount: number | string | null | undefined };

export type InvoiceTotals = {
  subtotal: number;
  /** The part of the subtotal the tax applies to. */
  taxableSubtotal: number;
  taxTotal: number;
  total: number;
};

export type TaxSnapshot = {
  percent: number;
  /** EXCLUSIVE adds tax on top; INCLUSIVE means the line amounts already contain it. */
  mode: "EXCLUSIVE" | "INCLUSIVE";
};

/**
 * Totals for a set of lines under one tax snapshot.
 *
 * INCLUSIVE tax is backed OUT of the lines rather than added to them: the total
 * a client sees is the sum of the lines, and the tax figure is what is contained
 * within it. Adding it instead would silently bill the tax twice — which is the
 * mistake the proposal engine documents at its own inclusive-tax branch.
 */
export function invoiceTotals(
  lines: CalcLine[],
  tax: TaxSnapshot,
  currency: string,
): InvoiceTotals {
  const amounts = lines.map((l) => fromMajor(l.amount, currency));
  const subtotal = sum(amounts, currency);
  const taxable = sum(
    lines.map((l, i) => (l.taxable === false ? zero(currency) : amounts[i])),
    currency,
  );

  const percent = Number.isFinite(tax.percent) ? Math.max(0, tax.percent) : 0;
  if (percent === 0) {
    return {
      subtotal: toMajor(subtotal),
      taxableSubtotal: toMajor(taxable),
      taxTotal: 0,
      total: toMajor(subtotal),
    };
  }

  if (tax.mode === "INCLUSIVE") {
    // net = gross / (1 + p/100); tax = gross − net.
    const net = multiply(taxable, 1 / (1 + percent / 100));
    const taxTotal = subtract(taxable, net);
    return {
      subtotal: toMajor(subtotal),
      taxableSubtotal: toMajor(taxable),
      taxTotal: toMajor(taxTotal),
      total: toMajor(subtotal),
    };
  }

  const taxTotal = applyPercent(taxable, percent);
  return {
    subtotal: toMajor(subtotal),
    taxableSubtotal: toMajor(taxable),
    taxTotal: toMajor(taxTotal),
    total: toMajor(add(subtotal, taxTotal)),
  };
}

/** A line's amount from a quantity and a unit rate, when it was entered that way. */
export function lineAmount(
  quantity: number | null | undefined,
  unitRate: number | null | undefined,
  currency: string,
): number {
  if (quantity === null || quantity === undefined) return 0;
  if (unitRate === null || unitRate === undefined) return 0;
  if (!Number.isFinite(quantity) || !Number.isFinite(unitRate)) return 0;
  return toMajor(multiply(fromMajor(unitRate, currency), quantity));
}

export type Settlement = {
  paid: number;
  outstanding: number;
  /** True once the payments cover the total. Overpayment counts as settled. */
  settled: boolean;
  overpaidBy: number;
};

/** What has been received against a total, and what is still owed. */
export function settlement(
  total: number | string | null | undefined,
  payments: CalcPayment[],
  currency: string,
): Settlement {
  const due = fromMajor(total, currency);
  const paid = sum(
    payments.map((p) => fromMajor(p.amount, currency)),
    currency,
  );
  const remaining: Money = subtract(due, paid);
  const outstanding = remaining.minor > 0 ? remaining : zero(currency);
  const over = remaining.minor < 0 ? subtract(paid, due) : zero(currency);
  return {
    paid: toMajor(paid),
    outstanding: toMajor(outstanding),
    settled: due.minor > 0 ? remaining.minor <= 0 : isZero(due) && paid.minor > 0,
    overpaidBy: toMajor(over),
  };
}

/**
 * The status an invoice is actually in.
 *
 * DRAFT and VOID are states someone chooses; the rest follow from the money, so
 * nobody can mark an unpaid invoice paid and nobody has to remember to mark a
 * paid one. An invoice with no total cannot be PAID by having no payments —
 * that would report an empty draft as settled.
 */
export function invoiceStatus(invoice: {
  status: InvoiceStatus;
  total: number | string | null | undefined;
  issueDate?: string | null;
  payments: CalcPayment[];
  currency: string;
}): InvoiceStatus {
  if (invoice.status === "DRAFT" || invoice.status === "VOID") return invoice.status;
  const { paid, settled } = settlement(invoice.total, invoice.payments, invoice.currency);
  if (settled) return "PAID";
  if (paid > 0) return "PART_PAID";
  return "ISSUED";
}

/** `INV-{year}-{NNN}`, one past the highest number ever used in the practice. */
export function nextInvoiceNumber(existing: string[], year: number): string {
  let max = 0;
  for (const number of existing) {
    const m = /(\d+)\s*$/.exec(number);
    if (m && Number(m[1]) > max) max = Number(m[1]);
  }
  return `INV-${year}-${String(max + 1).padStart(3, "0")}`;
}

/** `YYYY-MM-DD`, `days` after the issue date. Null when there is no issue date. */
export function dueDateFrom(issueDate: string | null | undefined, days: number | null | undefined): string | null {
  if (!issueDate || days === null || days === undefined || !Number.isFinite(days)) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(issueDate);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + Math.trunc(days));
  return d.toISOString().slice(0, 10);
}

/**
 * How overdue an invoice is, in days, or null when nothing is owed or no due
 * date was set. Only an invoice with money outstanding can be overdue — a paid
 * invoice whose due date has passed is not a debt, it is history.
 */
export function daysOverdue(
  invoice: { dueDate?: string | null; outstanding: number },
  today: string,
): number | null {
  if (!invoice.dueDate || invoice.outstanding <= 0) return null;
  const due = Date.parse(`${invoice.dueDate.slice(0, 10)}T00:00:00Z`);
  const now = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(due) || Number.isNaN(now)) return null;
  const days = Math.round((now - due) / 86_400_000);
  return days > 0 ? days : null;
}

export type AgeingBucket = "current" | "1-30" | "31-60" | "61-90" | "90+";

/** The ageing bucket an outstanding invoice falls in — the receivables view. */
export function ageingBucket(days: number | null): AgeingBucket {
  if (days === null || days <= 0) return "current";
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export type ReceivablesSummary = {
  /** Invoices that are neither drafts nor voided. */
  count: number;
  billed: number;
  paid: number;
  outstanding: number;
  overdue: number;
  drafts: number;
  ageing: Record<AgeingBucket, number>;
};

/**
 * The register's tiles. Drafts and voided invoices are counted but never added
 * to what is owed: a draft has not been asked for and a void has been withdrawn.
 *
 * Mixed currencies are summed as if they were one — the caller is expected to
 * filter to a single currency, and `docs/finance/SPEC.md` says why this is not
 * papered over: a "total outstanding" across currencies is a number with no
 * meaning, so the UI shows it per currency.
 */
export function receivablesSummary(
  invoices: {
    status: InvoiceStatus;
    total: number;
    paid: number;
    outstanding: number;
    dueDate?: string | null;
  }[],
  today: string,
  currency: string,
): ReceivablesSummary {
  let billed = zero(currency);
  let paid = zero(currency);
  let outstanding = zero(currency);
  let overdue = zero(currency);
  let drafts = 0;
  let count = 0;
  const ageing: Record<AgeingBucket, number> = {
    current: 0,
    "1-30": 0,
    "31-60": 0,
    "61-90": 0,
    "90+": 0,
  };

  for (const inv of invoices) {
    if (inv.status === "DRAFT") {
      drafts += 1;
      continue;
    }
    if (inv.status === "VOID") continue;
    count += 1;
    billed = add(billed, fromMajor(inv.total, currency));
    paid = add(paid, fromMajor(inv.paid, currency));
    const owed = fromMajor(inv.outstanding, currency);
    outstanding = add(outstanding, owed);
    const late = daysOverdue({ dueDate: inv.dueDate, outstanding: inv.outstanding }, today);
    if (late !== null) overdue = add(overdue, owed);
    if (inv.outstanding > 0) {
      const bucket = ageingBucket(late);
      ageing[bucket] = toMajor(add(fromMajor(ageing[bucket], currency), owed));
    }
  }

  return {
    count,
    billed: toMajor(billed),
    paid: toMajor(paid),
    outstanding: toMajor(outstanding),
    overdue: toMajor(overdue),
    drafts,
    ageing,
  };
}
