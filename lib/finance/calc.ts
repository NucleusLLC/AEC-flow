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
import type { CreditNoteStatus, InvoiceStatus } from "./types";

/** A line as the arithmetic sees it: the amount rules, the rest is provenance. */
export type CalcLine = {
  amount: number | string | null | undefined;
  taxable?: boolean;
};

/** A payment as the arithmetic sees it. */
export type CalcPayment = { amount: number | string | null | undefined };

/**
 * A credit note as the arithmetic sees it. The status rides along because only
 * an ISSUED credit note has told the client anything: a draft is a proposal and
 * a void was withdrawn. The currency rides along so a credit raised in the
 * wrong currency is refused loudly rather than added as if it were the same.
 */
export type CalcCredit = {
  amount: number | string | null | undefined;
  status: CreditNoteStatus;
  currency: string;
};

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

/** Credit-note DTOs (or rows) as the arithmetic sees them: their total is the amount. */
export function creditsOf(
  notes: { total: number | string | null | undefined; status: CreditNoteStatus; currency: string }[],
): CalcCredit[] {
  return notes.map((n) => ({ amount: n.total, status: n.status, currency: n.currency }));
}

export type InvoiceBalance = Settlement & {
  /** What ISSUED credit notes have taken off the invoice. Drafts and voids are not in it. */
  credited: number;
  /** How many issued credit notes `credited` is made of. */
  creditCount: number;
};

/**
 * THE balance of an invoice: what it asked for, less what has been received,
 * less what the practice has credited back. Every screen, print, tile, ledger
 * and export that shows what an invoice still owes reads it from here — the
 * register, the detail panel, the printed sheet, receivables and the
 * accounting CSV — so a credit note can never reduce the balance in one place
 * and not another.
 *
 * Only ISSUED credit notes count. A DRAFT has not been sent; a VOID has been
 * withdrawn, and the balance it took off comes back.
 *
 * NEVER ACROSS CURRENCIES. A credit note snapshots its invoice's currency, so a
 * mismatch here is corrupt data, not a conversion to attempt: the money
 * primitive throws (`MoneyError`), and so does this.
 */
export function invoiceBalance(input: {
  total: number | string | null | undefined;
  currency: string;
  payments: CalcPayment[];
  credits?: CalcCredit[];
}): InvoiceBalance {
  const { currency } = input;
  const due = fromMajor(input.total, currency);
  const paid = sum(
    input.payments.map((p) => fromMajor(p.amount, currency)),
    currency,
  );
  const issued = (input.credits ?? []).filter((c) => c.status === "ISSUED");
  // fromMajor in the CREDIT's currency, then add to the invoice's: a mismatch
  // throws inside `add` instead of being summed as if it were the same money.
  const credited = issued.reduce<Money>(
    (acc, c) => add(acc, fromMajor(c.amount, c.currency)),
    zero(currency),
  );
  const remaining: Money = subtract(subtract(due, paid), credited);
  const outstanding = remaining.minor > 0 ? remaining : zero(currency);
  const over = remaining.minor < 0 ? subtract(add(paid, credited), due) : zero(currency);
  return {
    paid: toMajor(paid),
    credited: toMajor(credited),
    creditCount: issued.length,
    outstanding: toMajor(outstanding),
    settled:
      due.minor > 0
        ? remaining.minor <= 0
        : isZero(due) && (paid.minor > 0 || credited.minor > 0),
    overpaidBy: toMajor(over),
  };
}

/**
 * What has been received against a total, and what is still owed — with no
 * credit notes. Kept for its callers; it is `invoiceBalance` with an empty
 * credit list, not a second implementation.
 */
export function settlement(
  total: number | string | null | undefined,
  payments: CalcPayment[],
  currency: string,
): Settlement {
  const { paid, outstanding, settled, overpaidBy } = invoiceBalance({ total, currency, payments });
  return { paid, outstanding, settled, overpaidBy };
}

export type CreditCheck =
  | { ok: true; available: number }
  | { ok: false; available: number; error: string };

/**
 * May this credit note be issued against this invoice? The over-credit guard,
 * in one place, called by the server before it writes — the form's own limit
 * is a convenience, not a control.
 *
 * `available` is the invoice's outstanding balance with every OTHER issued
 * credit note already taken off: pass the credit being checked as `credit`,
 * never inside `invoice.credits`. A credit note can never take an invoice
 * below zero — that would be the practice owing the client money it never
 * received, which is a refund, not a credit.
 */
export function checkCreditNote(
  invoice: {
    status: InvoiceStatus;
    total: number | string | null | undefined;
    currency: string;
    payments: CalcPayment[];
    credits?: CalcCredit[];
  },
  credit: { amount: number | string | null | undefined; currency: string },
): CreditCheck {
  if (invoice.status === "DRAFT" || invoice.status === "VOID") {
    return { ok: false, available: 0, error: "Only an issued invoice can be credited." };
  }
  if (credit.currency !== invoice.currency) {
    return {
      ok: false,
      available: 0,
      error: "A credit note must be in the same currency as its invoice.",
    };
  }
  const { outstanding } = invoiceBalance(invoice);
  const asked = fromMajor(credit.amount, invoice.currency);
  if (asked.minor <= 0) {
    return { ok: false, available: outstanding, error: "A credit note has to be for more than zero." };
  }
  if (asked.minor > fromMajor(outstanding, invoice.currency).minor) {
    return {
      ok: false,
      available: outstanding,
      error: "A credit note cannot exceed the invoice's outstanding balance.",
    };
  }
  return { ok: true, available: outstanding };
}

/**
 * What is left to credit on each invoice line: its amount, less what ISSUED
 * credit notes have already taken back from it. Pass only the other credit
 * notes' lines (the one being checked is what is being measured against this).
 * Never below zero.
 */
export function creditableByLine(
  invoiceLines: { id: string; amount: number | string | null | undefined }[],
  creditedLines: { invoiceLineId: string | null; amount: number | string | null | undefined }[],
  currency: string,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const line of invoiceLines) {
    const taken = sum(
      creditedLines
        .filter((c) => c.invoiceLineId === line.id)
        .map((c) => fromMajor(c.amount, currency)),
      currency,
    );
    const left = subtract(fromMajor(line.amount, currency), taken);
    out.set(line.id, toMajor(left.minor > 0 ? left : zero(currency)));
  }
  return out;
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
  credits?: CalcCredit[];
  currency: string;
}): InvoiceStatus {
  if (invoice.status === "DRAFT" || invoice.status === "VOID") return invoice.status;
  const { paid, settled, credited } = invoiceBalance(invoice);
  // Settled with nothing received: the practice took the whole bill back.
  // Settled with money received (and perhaps a credit for the rest): paid.
  if (settled) return paid === 0 && credited > 0 ? "CREDITED" : "PAID";
  if (paid > 0) return "PART_PAID";
  return "ISSUED";
}

/** `{prefix}-{year}-{NNN}`, one past the highest number ever used in that series. */
function nextSeriesNumber(prefix: string, existing: string[], year: number): string {
  let max = 0;
  for (const number of existing) {
    const m = /(\d+)\s*$/.exec(number);
    if (m && Number(m[1]) > max) max = Number(m[1]);
  }
  return `${prefix}-${year}-${String(max + 1).padStart(3, "0")}`;
}

/** `INV-{year}-{NNN}`, one past the highest number ever used in the practice. */
export function nextInvoiceNumber(existing: string[], year: number): string {
  return nextSeriesNumber("INV", existing, year);
}

/**
 * `CN-{year}-{NNN}`, exactly the way invoice numbers are made: one past the
 * highest credit-note number ever used in the practice, voided and deleted
 * drafts included, so a number is never reused.
 */
export function nextCreditNoteNumber(existing: string[], year: number): string {
  return nextSeriesNumber("CN", existing, year);
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
  /** Issued credit notes against those invoices. billed − paid − credited = outstanding. */
  credited: number;
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
    /** From `invoiceBalance`; absent means no credit notes. */
    credited?: number;
    /** Net of payments AND issued credit notes — `invoiceBalance`. */
    outstanding: number;
    dueDate?: string | null;
  }[],
  today: string,
  currency: string,
): ReceivablesSummary {
  let billed = zero(currency);
  let paid = zero(currency);
  let credited = zero(currency);
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
    credited = add(credited, fromMajor(inv.credited ?? 0, currency));
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
    credited: toMajor(credited),
    outstanding: toMajor(outstanding),
    overdue: toMajor(overdue),
    drafts,
    ageing,
  };
}
