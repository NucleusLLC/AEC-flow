/**
 * Turnover-tax report (Aruba BBO / BAVP and whatever else the invoices carry).
 * PURE — no Prisma, no React, no I/O.
 *
 * WHAT IT DOES AND, AS IMPORTANTLY, WHAT IT DOES NOT. It adds up the tax the
 * practice's invoices actually hold. It does not know Aruban tax law: it never
 * decides a rate, never imputes the 7% BBO default to an invoice that carries
 * none, and never splits one tax into two. An invoice stores one tax snapshot
 * (name, percent, mode, stored tax total — see prisma/schema.prisma, model
 * Invoice) and, since 0.26.0, an optional SECOND one (tax2Name, tax2Percent,
 * tax2Total — BBO and BAVP on one invoice). Each is summed under its own name
 * and rate, so an invoice carrying both contributes to both lines, with the
 * same base on each (both are charged on the same taxable turnover). An
 * invoice with no tax is listed in the notes, not guessed at.
 *
 * TWO BASES, NEVER MIXED:
 *  - INVOICED (accrual): every invoice issued in the period, by issue date.
 *    Drafts are not in the books; voided invoices were withdrawn. Both are left
 *    out. The figures are the STORED ones — what the client was asked to pay.
 *  - RECEIVED (cash): every payment dated in the period, whatever date its
 *    invoice was issued. The tax inside a payment is the invoice's tax pro rata
 *    to what has been paid, worked out cumulatively so the tax of all an
 *    invoice's payments adds back to the invoice's own tax to the cent — per
 *    tax, so each of two taxes adds back to its own stored figure.
 *
 * Currencies are never added together: every total is per currency.
 *
 * MONEY IS NEVER A FLOAT: every sum goes through lib/proposals/engine/money.ts.
 */
import { add, fromMajor, money, subtract, toMajor, zero, type Money } from "@/lib/proposals/engine/money";
import { militaryDate } from "@/lib/building-permits/register";
import type { InvoiceStatus } from "./types";
import type { DateRange } from "./export";

// ── Periods ────────────────────────────────────────────────────────────────

export type TaxPeriod = {
  kind: "month" | "quarter" | "range";
  /** `2026-09`, `2026-Q3`, or `2026-07-01_2026-08-15` for a free range. */
  key: string;
  /** First and last day, inclusive, `YYYY-MM-DD`. */
  from: string;
  to: string;
  /** `SEP 2026`, `Q3 2026`, or `01 JUL 2026 – 15 AUG 2026`. */
  label: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Last day of a month (1-12), read without a timezone. */
function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function monthPeriod(year: number, month: number): TaxPeriod {
  const from = `${year}-${pad(month)}-01`;
  return {
    kind: "month",
    key: `${year}-${pad(month)}`,
    from,
    to: `${year}-${pad(month)}-${pad(lastDay(year, month))}`,
    // "01 SEP 2026" → "SEP 2026"
    label: militaryDate(from).slice(3),
  };
}

export function quarterPeriod(year: number, quarter: number): TaxPeriod {
  const first = (quarter - 1) * 3 + 1;
  return {
    kind: "quarter",
    key: `${year}-Q${quarter}`,
    from: `${year}-${pad(first)}-01`,
    to: `${year}-${pad(first + 2)}-${pad(lastDay(year, first + 2))}`,
    label: `Q${quarter} ${year}`,
  };
}

/** The last month that has fully ended on `today` (`YYYY-MM-DD`). */
export function lastFullMonth(today: string): TaxPeriod {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  return m === 1 ? monthPeriod(y - 1, 12) : monthPeriod(y, m - 1);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * `?period=` into a period: `2026-09` (a month) or `2026-Q3` (a quarter).
 * Anything else — blank, garbage, a month 13 — is the default, the last full
 * month, so a bad link still shows a sensible report rather than an error.
 */
export function parsePeriod(key: string | null | undefined, today: string): TaxPeriod {
  const k = (key ?? "").trim().toUpperCase();
  const month = /^(\d{4})-(\d{2})$/.exec(k);
  if (month) {
    const y = Number(month[1]);
    const m = Number(month[2]);
    if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12) return monthPeriod(y, m);
  }
  const quarter = /^(\d{4})-Q([1-4])$/.exec(k);
  if (quarter) {
    const y = Number(quarter[1]);
    if (y >= 2000 && y <= 2100) return quarterPeriod(y, Number(quarter[2]));
  }
  return lastFullMonth(today);
}

/**
 * `?from=&to=` (the print page and the CSV) into a period. A range that is
 * exactly a calendar month or quarter is labelled as one; any other valid range
 * is shown by its two dates. Null for a missing, invalid or backwards range.
 */
export function periodFromRange(from: string | null | undefined, to: string | null | undefined): TaxPeriod | null {
  const f = from?.trim() ?? "";
  const t = to?.trim() ?? "";
  if (!validDate(f) || !validDate(t) || f > t) return null;
  const y = Number(f.slice(0, 4));
  const m = Number(f.slice(5, 7));
  if (f.slice(8) === "01") {
    const asMonth = monthPeriod(y, m);
    if (asMonth.to === t) return asMonth;
    if ((m - 1) % 3 === 0) {
      const asQuarter = quarterPeriod(y, (m - 1) / 3 + 1);
      if (asQuarter.to === t) return asQuarter;
    }
  }
  return { kind: "range", key: `${f}_${t}`, from: f, to: t, label: `${militaryDate(f)} – ${militaryDate(t)}` };
}

/** The period `delta` steps before (negative) or after a month or a quarter. */
export function shiftPeriod(p: TaxPeriod, delta: number): TaxPeriod {
  const y = Number(p.from.slice(0, 4));
  const m = Number(p.from.slice(5, 7));
  if (p.kind === "quarter") {
    const index = y * 4 + (m - 1) / 3 + delta;
    return quarterPeriod(Math.floor(index / 4), (index % 4) + 1);
  }
  const index = y * 12 + (m - 1) + delta;
  return monthPeriod(Math.floor(index / 12), (index % 12) + 1);
}

/** The picker's choices: the last `months` months and `quarters` quarters, newest first. */
export function periodOptions(today: string, months = 12, quarters = 6): { months: TaxPeriod[]; quarters: TaxPeriod[] } {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const thisMonth = monthPeriod(year, month);
  const thisQuarter = quarterPeriod(year, Math.floor((month - 1) / 3) + 1);
  return {
    months: Array.from({ length: months }, (_, i) => shiftPeriod(thisMonth, -i)),
    quarters: Array.from({ length: quarters }, (_, i) => shiftPeriod(thisQuarter, -i)),
  };
}

/** Inclusive on both ends; compares the `YYYY-MM-DD` part only. */
function inPeriod(date: string | null | undefined, range: DateRange): boolean {
  if (!date) return false;
  const d = date.slice(0, 10);
  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}

// ── Inputs ─────────────────────────────────────────────────────────────────

/** The parts of an invoice the report reads. `InvoiceDTO` satisfies it. */
export type TaxInvoice = {
  id: string;
  number: string;
  status: InvoiceStatus;
  currency: string;
  clientName: string;
  issueDate: string | null;
  subtotal: number;
  taxableSubtotal: number;
  taxTotal: number;
  total: number;
  taxName: string | null;
  taxPercent: number;
  taxMode: "EXCLUSIVE" | "INCLUSIVE";
  /** The optional second tax. Absent / null / 0 on a one-tax invoice. */
  tax2Name?: string | null;
  tax2Percent?: number | null;
  tax2Total?: number | null;
  payments: { id?: string; paidAt: string; amount: number }[];
};

// ── Outputs ────────────────────────────────────────────────────────────────

/** BBO, BAVP or anything else, read off the tax name on the invoice. */
export type TaxKind = "BBO" | "BAVP" | "OTHER";

export function taxKind(name: string | null | undefined): TaxKind {
  const n = (name ?? "").toUpperCase();
  if (/\bBBO\b/.test(n)) return "BBO";
  if (/\bBAVP\b/.test(n)) return "BAVP";
  return "OTHER";
}

export type TaxLine = {
  /** `BBO|7|INCLUSIVE` — one line per name, rate and mode the invoices carry. */
  key: string;
  kind: TaxKind;
  /** The name on the invoices; null when an invoice charged a tax with no name. */
  name: string | null;
  percent: number;
  mode: "EXCLUSIVE" | "INCLUSIVE";
  /** The turnover the tax was charged on, excluding the tax itself. */
  base: number;
  tax: number;
  /** Invoices (invoiced basis) or payments (received basis) behind the line. */
  count: number;
};

export type CurrencyTotals = {
  currency: string;
  /** Invoices issued (invoiced basis) or payments received (received basis). */
  count: number;
  /** What the client pays / paid, tax included. */
  gross: number;
  /** Turnover excluding tax: gross − tax. */
  net: number;
  tax: number;
  /** The part of `net` no tax was charged on (no-tax invoices, non-taxable lines). */
  untaxed: number;
  lines: TaxLine[];
};

export type TaxInvoiceRow = {
  id: string;
  number: string;
  issueDate: string;
  clientName: string;
  currency: string;
  status: InvoiceStatus;
  taxName: string | null;
  taxPercent: number;
  taxMode: "EXCLUSIVE" | "INCLUSIVE";
  /** The second tax, when the invoice carries one; null / 0 otherwise. */
  tax2Name: string | null;
  tax2Percent: number;
  net: number;
  /** ALL the tax on the invoice (both taxes). net + tax = gross. */
  tax: number;
  /** The second tax's part of `tax`. */
  tax2: number;
  gross: number;
};

export type TaxPaymentRow = {
  paidAt: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  currency: string;
  taxName: string | null;
  taxPercent: number;
  taxMode: "EXCLUSIVE" | "INCLUSIVE";
  tax2Name: string | null;
  tax2Percent: number;
  /** The payment, tax included. */
  gross: number;
  /** The invoice's tax (both taxes) contained in this payment, pro rata. */
  tax: number;
  /** The second tax's part of `tax`, pro rata on its own. */
  tax2: number;
  net: number;
};

export type TaxNoteKind =
  /** Issued in the period with no tax on it. Counted at zero tax; nothing imputed. */
  | "no-tax"
  /** A rate is set but every line is non-taxable, so the stored tax is zero. */
  | "zero-tax"
  /** A tax was charged under no name. */
  | "unnamed-tax"
  /** Voided invoice issued in the period: left out of every total. */
  | "void"
  /** A payment in the period on a voided invoice: left out of the received basis. */
  | "void-payment"
  /** Payments exceed the invoice total: the excess carries no tax. */
  | "overpaid"
  /** A payment on an invoice whose total is zero or less: no tax can be pro-rated. */
  | "no-total";

export type TaxNote = {
  kind: TaxNoteKind;
  invoiceId: string;
  invoiceNumber: string;
  currency: string;
  /** The amount the note is about, when there is one (the invoice net, the payment). */
  amount?: number;
};

export type TaxReport = {
  range: DateRange;
  invoiced: CurrencyTotals[];
  received: CurrencyTotals[];
  invoices: TaxInvoiceRow[];
  payments: TaxPaymentRow[];
  notes: TaxNote[];
  /** Left out of the invoiced basis, counted so the screen can say so. */
  excluded: { drafts: number; voids: number };
};

// ── Arithmetic ─────────────────────────────────────────────────────────────

type Bucket = { name: string | null; kind: TaxKind; percent: number; mode: "EXCLUSIVE" | "INCLUSIVE"; base: Money; tax: Money; count: number };
type Acc = { count: number; gross: Money; tax: Money; untaxed: Money; lines: Map<string, Bucket> };

function cleanName(name: string | null | undefined): string | null {
  const n = (name ?? "").trim();
  return n ? n : null;
}

/** One of the (at most two) taxes an invoice carries, as the report reads it. */
type TaxPart = { name: string | null; percent: number; mode: "EXCLUSIVE" | "INCLUSIVE"; total: Money };

/**
 * The taxes on an invoice: the first always (it may be nothing), the second
 * only when it has a rate or a stored amount — a one-tax invoice has one part.
 */
function taxParts(inv: TaxInvoice): TaxPart[] {
  const cur = inv.currency;
  const parts: TaxPart[] = [
    { name: cleanName(inv.taxName), percent: inv.taxPercent, mode: inv.taxMode, total: fromMajor(inv.taxTotal, cur) },
  ];
  const p2 = typeof inv.tax2Percent === "number" && Number.isFinite(inv.tax2Percent) ? inv.tax2Percent : 0;
  const t2 = fromMajor(inv.tax2Total ?? 0, cur);
  if (p2 > 0 || t2.minor !== 0) parts.push({ name: cleanName(inv.tax2Name), percent: p2, mode: inv.taxMode, total: t2 });
  return parts;
}

/** True when the invoice carries no tax at all: no rate and no stored tax. */
function carriesNoTax(parts: TaxPart[]): boolean {
  return parts.every((t) => !(t.percent > 0) && t.total.minor === 0);
}

function lineKey(t: TaxPart): string {
  return `${(t.name ?? "").toUpperCase()}|${t.percent}|${t.mode}`;
}

function accFor(map: Map<string, Acc>, currency: string): Acc {
  let a = map.get(currency);
  if (!a) {
    a = { count: 0, gross: zero(currency), tax: zero(currency), untaxed: zero(currency), lines: new Map() };
    map.set(currency, a);
  }
  return a;
}

function addToLine(acc: Acc, t: TaxPart, base: Money, tax: Money): void {
  const key = lineKey(t);
  let b = acc.lines.get(key);
  if (!b) {
    b = { name: t.name, kind: taxKind(t.name), percent: t.percent, mode: t.mode, base: zero(base.currency), tax: zero(base.currency), count: 0 };
    acc.lines.set(key, b);
  }
  b.base = add(b.base, base);
  b.tax = add(b.tax, tax);
  b.count += 1;
}

const KIND_ORDER: Record<TaxKind, number> = { BBO: 0, BAVP: 1, OTHER: 2 };

function finish(map: Map<string, Acc>): CurrencyTotals[] {
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, a]) => ({
      currency,
      count: a.count,
      gross: toMajor(a.gross),
      net: toMajor(subtract(a.gross, a.tax)),
      tax: toMajor(a.tax),
      untaxed: toMajor(a.untaxed),
      lines: [...a.lines.entries()]
        .map(([key, b]) => ({ key, kind: b.kind, name: b.name, percent: b.percent, mode: b.mode, base: toMajor(b.base), tax: toMajor(b.tax), count: b.count }))
        .sort((x, y) => KIND_ORDER[x.kind] - KIND_ORDER[y.kind] || (x.name ?? "").localeCompare(y.name ?? "") || x.percent - y.percent),
    }));
}

/**
 * The share of `part` that `paid` stands for, out of `total` — cumulative paid
 * clamped to [0, total], so once an invoice is paid in full the share is
 * exactly `part` and its payments' slices add back to it to the cent.
 */
function shareOf(paidSoFar: Money, total: Money, part: Money): Money {
  if (total.minor <= 0) return zero(part.currency);
  const paid = Math.min(Math.max(paidSoFar.minor, 0), total.minor);
  if (paid === total.minor) return part;
  // Integer minor units in, integer out; one division, rounded half away from zero.
  const exact = (paid * part.minor) / total.minor;
  return money(exact < 0 ? -Math.round(-exact) : Math.round(exact), part.currency);
}

/**
 * The tax report for one period. `range` is inclusive on both ends; an open end
 * (null) is unbounded, which the CSV export uses for "from the start".
 */
export function buildTaxReport(invoices: TaxInvoice[], range: DateRange): TaxReport {
  const invoiced = new Map<string, Acc>();
  const received = new Map<string, Acc>();
  const invoiceRows: TaxInvoiceRow[] = [];
  const paymentRows: TaxPaymentRow[] = [];
  const notes: TaxNote[] = [];
  const excluded = { drafts: 0, voids: 0 };

  const sorted = [...invoices].sort(
    (a, b) => (a.issueDate ?? "").localeCompare(b.issueDate ?? "") || a.number.localeCompare(b.number),
  );

  for (const inv of sorted) {
    const cur = inv.currency;
    const issuedInPeriod = inPeriod(inv.issueDate, range);
    const total = fromMajor(inv.total, cur);
    const parts = taxParts(inv);
    const second = parts[1];
    // ALL the tax on the invoice: one tax, or both.
    const tax = parts.reduce<Money>((acc, t) => add(acc, t.total), zero(cur));
    const subtotal = fromMajor(inv.subtotal, cur);
    const taxable = fromMajor(inv.taxableSubtotal, cur);
    // Exclusive: the taxable lines are the base. Inclusive: they contain the tax
    // (both taxes). Either way it is the SAME base for each tax: neither is
    // charged on the other.
    const base = inv.taxMode === "INCLUSIVE" ? subtract(taxable, tax) : taxable;
    const exempt = subtract(subtotal, taxable);
    const noTax = carriesNoTax(parts);

    if (inv.status === "DRAFT") {
      if (issuedInPeriod) excluded.drafts += 1;
      continue;
    }

    // ── Invoiced basis ──
    if (inv.status === "VOID") {
      if (issuedInPeriod) {
        excluded.voids += 1;
        notes.push({ kind: "void", invoiceId: inv.id, invoiceNumber: inv.number, currency: cur, amount: toMajor(total) });
      }
    } else if (issuedInPeriod) {
      const a = accFor(invoiced, cur);
      a.count += 1;
      a.gross = add(a.gross, total);
      a.tax = add(a.tax, tax);
      const net = subtract(total, tax);
      if (noTax) {
        a.untaxed = add(a.untaxed, net);
        notes.push({ kind: "no-tax", invoiceId: inv.id, invoiceNumber: inv.number, currency: cur, amount: toMajor(net) });
      } else {
        a.untaxed = add(a.untaxed, exempt);
        for (const t of parts) addToLine(a, t, base, t.total);
        if (tax.minor === 0) notes.push({ kind: "zero-tax", invoiceId: inv.id, invoiceNumber: inv.number, currency: cur, amount: toMajor(net) });
        if (parts.some((t) => !t.name)) notes.push({ kind: "unnamed-tax", invoiceId: inv.id, invoiceNumber: inv.number, currency: cur });
      }
      invoiceRows.push({
        id: inv.id,
        number: inv.number,
        issueDate: (inv.issueDate ?? "").slice(0, 10),
        clientName: inv.clientName,
        currency: cur,
        status: inv.status,
        taxName: cleanName(inv.taxName),
        taxPercent: noTax ? 0 : inv.taxPercent,
        taxMode: inv.taxMode,
        tax2Name: second?.name ?? null,
        tax2Percent: second?.percent ?? 0,
        net: toMajor(net),
        tax: toMajor(tax),
        tax2: second ? toMajor(second.total) : 0,
        gross: toMajor(total),
      });
    }

    // ── Received basis ──
    const payments = [...inv.payments].sort((a, b) => a.paidAt.localeCompare(b.paidAt) || (a.id ?? "").localeCompare(b.id ?? ""));
    let paidSoFar = zero(cur);
    let overpaidNoted = false;
    for (const p of payments) {
      const amount = fromMajor(p.amount, cur);
      const before = paidSoFar;
      paidSoFar = add(paidSoFar, amount);
      if (!inPeriod(p.paidAt, range)) continue;

      if (inv.status === "VOID") {
        notes.push({ kind: "void-payment", invoiceId: inv.id, invoiceNumber: inv.number, currency: cur, amount: toMajor(amount) });
        continue;
      }
      if (total.minor <= 0) {
        notes.push({ kind: "no-total", invoiceId: inv.id, invoiceNumber: inv.number, currency: cur, amount: toMajor(amount) });
      }
      if (paidSoFar.minor > total.minor && total.minor > 0 && !overpaidNoted) {
        overpaidNoted = true;
        notes.push({ kind: "overpaid", invoiceId: inv.id, invoiceNumber: inv.number, currency: cur, amount: toMajor(subtract(paidSoFar, total)) });
      }

      // Each tax pro rata on its own, so each adds back to its own stored total.
      const pParts = parts.map((t) => subtract(shareOf(paidSoFar, total, t.total), shareOf(before, total, t.total)));
      const pTax = pParts.reduce<Money>((acc, m) => add(acc, m), zero(cur));
      const pBase = subtract(shareOf(paidSoFar, total, base), shareOf(before, total, base));
      const pNet = subtract(amount, pTax);

      const a = accFor(received, cur);
      a.count += 1;
      a.gross = add(a.gross, amount);
      a.tax = add(a.tax, pTax);
      if (noTax) a.untaxed = add(a.untaxed, pNet);
      else {
        a.untaxed = add(a.untaxed, subtract(pNet, pBase));
        parts.forEach((t, i) => addToLine(a, t, pBase, pParts[i]));
      }
      paymentRows.push({
        paidAt: p.paidAt.slice(0, 10),
        invoiceId: inv.id,
        invoiceNumber: inv.number,
        clientName: inv.clientName,
        currency: cur,
        taxName: cleanName(inv.taxName),
        taxPercent: noTax ? 0 : inv.taxPercent,
        taxMode: inv.taxMode,
        tax2Name: second?.name ?? null,
        tax2Percent: second?.percent ?? 0,
        gross: toMajor(amount),
        tax: toMajor(pTax),
        tax2: second ? toMajor(pParts[1]) : 0,
        net: toMajor(pNet),
      });
    }
  }

  paymentRows.sort((a, b) => a.paidAt.localeCompare(b.paidAt) || a.invoiceNumber.localeCompare(b.invoiceNumber));
  return {
    range,
    invoiced: finish(invoiced),
    received: finish(received),
    invoices: invoiceRows,
    payments: paymentRows,
    notes,
    excluded,
  };
}
