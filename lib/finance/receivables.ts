/**
 * Receivables by client and the client Statement of Account. PURE — no Prisma,
 * no React, no I/O.
 *
 * NOTHING HERE IS A SECOND RULE. What an invoice still owes is `settlement`,
 * which bucket a debt falls in is `daysOverdue` + `ageingBucket`, and what is
 * "on the books" is what `receivablesSummary` counts — all in ./calc.ts. A
 * client's row is literally `receivablesSummary` run over that client's
 * invoices, so the per-client figures add up to the register's tiles by
 * construction rather than by two implementations agreeing. Money goes through
 * lib/proposals/engine/money.ts and nowhere else.
 *
 * DRAFT AND VOID. A draft has not been asked for and a void has been withdrawn,
 * so neither is a debt — and a payment recorded against a voided invoice is
 * ignored with it, exactly as the register's tiles ignore it.
 *
 * NEVER ACROSS CURRENCIES. Every figure is per currency. A client billed in two
 * currencies has two rows and two ledgers; nothing ever adds them together.
 */
import { add, fromMajor, subtract, sum, toMajor, zero } from "@/lib/proposals/engine/money";
import { receivablesSummary, settlement, type AgeingBucket } from "./calc";
import type { InvoiceStatus } from "./types";

export const AGEING_BUCKETS: readonly AgeingBucket[] = ["current", "1-30", "31-60", "61-90", "90+"];

/** An invoice as receivables and the statement need it. */
export type LedgerInvoice = {
  id: string;
  number: string;
  /** The derived status (`invoiceStatus`); only DRAFT and VOID matter here. */
  status: InvoiceStatus;
  currency: string;
  clientId: string | null;
  clientName: string;
  issueDate: string | null;
  dueDate: string | null;
  /** Fallback document date for an issued invoice with no issue date. */
  createdAt?: string | null;
  total: number;
  payments: { id?: string; paidAt: string; amount: number; reference?: string | null }[];
};

/** On the books: issued, part-paid or paid. Drafts and voids are not debts. */
export function onBooks(status: InvoiceStatus): boolean {
  return status !== "DRAFT" && status !== "VOID";
}

/** The date an invoice debits the client: its issue date, else when it was raised. */
export function invoiceDate(inv: Pick<LedgerInvoice, "issueDate" | "createdAt">): string | null {
  const d = inv.issueDate ?? inv.createdAt ?? null;
  return d ? d.slice(0, 10) : null;
}

function emptyAgeing(): Record<AgeingBucket, number> {
  return { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
}

// ── Receivables by client ──────────────────────────────────────────────────

export type ClientReceivable = {
  /** `clientId`, or `name:<clientName>` for an invoice raised with no client record. */
  key: string;
  clientId: string | null;
  clientName: string;
  currency: string;
  ageing: Record<AgeingBucket, number>;
  outstanding: number;
  /** The open invoice with the earliest date. */
  oldest: { id: string; number: string; date: string | null } | null;
  /** The latest payment on any of the client's invoices in this currency. */
  lastPaymentDate: string | null;
  openCount: number;
};

/**
 * One row per client per currency with money still owed, sorted by currency,
 * then by what is owed (largest first), then by name.
 */
export function receivablesByClient(invoices: LedgerInvoice[], today: string): ClientReceivable[] {
  const groups = new Map<string, LedgerInvoice[]>();
  for (const inv of invoices) {
    if (!onBooks(inv.status)) continue;
    const key = inv.clientId ?? `name:${inv.clientName.trim().toLowerCase()}`;
    const g = `${inv.currency}\u0000${key}`;
    const list = groups.get(g);
    if (list) list.push(inv);
    else groups.set(g, [inv]);
  }

  const rows: ClientReceivable[] = [];
  for (const list of groups.values()) {
    const { currency, clientId } = list[0];
    const settled = list.map((inv) => ({
      inv,
      ...settlement(inv.total, inv.payments, currency),
    }));
    const summary = receivablesSummary(
      settled.map((s) => ({
        status: s.inv.status,
        total: s.inv.total,
        paid: s.paid,
        outstanding: s.outstanding,
        dueDate: s.inv.dueDate,
      })),
      today,
      currency,
    );
    if (summary.outstanding <= 0) continue;

    const open = settled
      .filter((s) => s.outstanding > 0)
      .sort((a, b) =>
        (invoiceDate(a.inv) ?? "9999").localeCompare(invoiceDate(b.inv) ?? "9999") ||
        a.inv.number.localeCompare(b.inv.number),
      );
    let lastPaymentDate: string | null = null;
    for (const inv of list) {
      for (const p of inv.payments) {
        const d = p.paidAt.slice(0, 10);
        if (!lastPaymentDate || d > lastPaymentDate) lastPaymentDate = d;
      }
    }
    // The newest name on the books is the one to show; names get corrected.
    const named = [...list].sort((a, b) =>
      (invoiceDate(b) ?? "").localeCompare(invoiceDate(a) ?? ""),
    )[0];

    rows.push({
      key: clientId ?? `name:${named.clientName.trim().toLowerCase()}`,
      clientId,
      clientName: named.clientName,
      currency,
      ageing: summary.ageing,
      outstanding: summary.outstanding,
      oldest: open[0]
        ? { id: open[0].inv.id, number: open[0].inv.number, date: invoiceDate(open[0].inv) }
        : null,
      lastPaymentDate,
      openCount: open.length,
    });
  }

  return rows.sort(
    (a, b) =>
      a.currency.localeCompare(b.currency) ||
      b.outstanding - a.outstanding ||
      a.clientName.localeCompare(b.clientName),
  );
}

export type ReceivablesTotal = {
  currency: string;
  clients: number;
  ageing: Record<AgeingBucket, number>;
  outstanding: number;
};

/** The footer: one total per currency, never one across them. */
export function receivablesTotals(rows: ClientReceivable[]): ReceivablesTotal[] {
  const by = new Map<string, ClientReceivable[]>();
  for (const r of rows) {
    const list = by.get(r.currency);
    if (list) list.push(r);
    else by.set(r.currency, [r]);
  }
  return [...by.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, list]) => {
      const ageing = emptyAgeing();
      for (const bucket of AGEING_BUCKETS) {
        ageing[bucket] = toMajor(sum(list.map((r) => fromMajor(r.ageing[bucket], currency)), currency));
      }
      return {
        currency,
        clients: list.length,
        ageing,
        outstanding: toMajor(sum(list.map((r) => fromMajor(r.outstanding, currency)), currency)),
      };
    });
}

// ── Statement of Account ───────────────────────────────────────────────────

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function validYmd(s: string | null | undefined): s is string {
  if (!s || !YMD.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** The same calendar date `years` earlier; 29 FEB falls back to 28 FEB. */
function yearsBefore(day: string, years: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const target = new Date(Date.UTC(y - years, m - 1, d));
  if (target.getUTCMonth() !== m - 1) target.setUTCDate(0);
  return target.toISOString().slice(0, 10);
}

/**
 * The statement period from the query string. Default: the last 12 months to
 * today. An unreadable date falls back to its default; a period given backwards
 * is turned round rather than rejected.
 */
export function statementPeriod(
  from: string | null | undefined,
  to: string | null | undefined,
  today: string,
): { from: string; to: string } {
  const end = validYmd(to) ? to : today;
  const start = validYmd(from) ? from : yearsBefore(end, 1);
  return start <= end ? { from: start, to: end } : { from: end, to: start };
}

export type StatementEntry = {
  date: string;
  kind: "invoice" | "payment";
  invoiceId: string;
  invoiceNumber: string;
  /** Payment reference, or the invoice's due date for an invoice line. */
  reference: string | null;
  dueDate: string | null;
  debit: number;
  credit: number;
  balance: number;
};

export type Statement = {
  currency: string;
  from: string;
  to: string;
  opening: number;
  entries: StatementEntry[];
  debits: number;
  credits: number;
  closing: number;
  /** What is owed at `to`, by how overdue it was on `to`. */
  ageing: Record<AgeingBucket, number>;
  /** Σ of the ageing buckets — what is owed on invoices still open at `to`. */
  owed: number;
  /** Money received beyond what was billed (overpayment), at `to`. owed − credit = closing. */
  credit: number;
};

/**
 * A currency with nothing to say for this period: no movement, nothing brought
 * forward and nothing owed. Left off the statement rather than printed as zeros.
 */
export function isEmptyStatement(s: Statement): boolean {
  return s.entries.length === 0 && s.opening === 0 && s.closing === 0 && s.owed === 0;
}

/** The currencies a client has anything on the books in, sorted. */
export function statementCurrencies(invoices: LedgerInvoice[]): string[] {
  return [...new Set(invoices.filter((i) => onBooks(i.status)).map((i) => i.currency))].sort();
}

/**
 * A running-balance ledger for one currency over [from, to], both inclusive.
 *
 * Opening balance = every debit before `from` less every credit before `from`.
 * Each invoice is a debit on its date (issue date, else the date it was raised);
 * each payment is a credit on its date. Same-day order: invoices before
 * payments, then by invoice number. Entries after `to` are not on the statement.
 *
 * The closing balance's ageing is the register's rule applied AS AT `to`: each
 * invoice's outstanding is `settlement` over the payments received by `to`, and
 * the bucket is `daysOverdue` against `to`.
 */
export function clientStatement(
  invoices: LedgerInvoice[],
  period: { from: string; to: string },
  currency: string,
): Statement {
  const { from, to } = period;
  const books = invoices.filter((i) => i.currency === currency && onBooks(i.status));

  type Raw = Omit<StatementEntry, "balance">;
  const raw: Raw[] = [];
  for (const inv of books) {
    const date = invoiceDate(inv);
    if (date) {
      raw.push({
        date,
        kind: "invoice",
        invoiceId: inv.id,
        invoiceNumber: inv.number,
        reference: null,
        dueDate: inv.dueDate ? inv.dueDate.slice(0, 10) : null,
        debit: toMajor(fromMajor(inv.total, currency)),
        credit: 0,
      });
    }
    for (const p of inv.payments) {
      raw.push({
        date: p.paidAt.slice(0, 10),
        kind: "payment",
        invoiceId: inv.id,
        invoiceNumber: inv.number,
        reference: p.reference ?? null,
        dueDate: null,
        debit: 0,
        credit: toMajor(fromMajor(p.amount, currency)),
      });
    }
  }
  raw.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.kind === b.kind ? 0 : a.kind === "invoice" ? -1 : 1) ||
      a.invoiceNumber.localeCompare(b.invoiceNumber),
  );

  let opening = zero(currency);
  let debits = zero(currency);
  let credits = zero(currency);
  let balance = zero(currency);
  const entries: StatementEntry[] = [];
  for (const e of raw) {
    const dr = fromMajor(e.debit, currency);
    const cr = fromMajor(e.credit, currency);
    if (e.date < from) {
      opening = subtract(add(opening, dr), cr);
      balance = opening;
      continue;
    }
    if (e.date > to) continue;
    debits = add(debits, dr);
    credits = add(credits, cr);
    balance = subtract(add(balance, dr), cr);
    entries.push({ ...e, balance: toMajor(balance) });
  }
  const closing = subtract(add(opening, debits), credits);

  // Ageing as at `to`.
  const asAt = books
    .filter((inv) => {
      const d = invoiceDate(inv);
      return d !== null && d <= to;
    })
    .map((inv) => {
      const s = settlement(
        inv.total,
        inv.payments.filter((p) => p.paidAt.slice(0, 10) <= to),
        currency,
      );
      return { status: inv.status, total: inv.total, paid: s.paid, outstanding: s.outstanding, dueDate: inv.dueDate };
    });
  const summary = receivablesSummary(asAt, to, currency);
  const owed = fromMajor(summary.outstanding, currency);

  return {
    currency,
    from,
    to,
    opening: toMajor(opening),
    entries,
    debits: toMajor(debits),
    credits: toMajor(credits),
    closing: toMajor(closing),
    ageing: summary.ageing,
    owed: toMajor(owed),
    credit: toMajor(subtract(owed, closing)),
  };
}
