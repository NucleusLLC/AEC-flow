/**
 * Accounting export: the practice's invoices, invoice lines, payments, credit
 * notes, approved time and approved expenses as CSV files an accountant or a bookkeeping
 * package can import.
 *
 * Pure: DTOs in, a table out, a CSV string out. The route that serves it is
 * app/api/export/finance/[kind]/route.ts; who may download is decided there.
 *
 * Format decisions, each one because an import broke without it:
 *  - Dates are ISO (YYYY-MM-DD). A spreadsheet reads them as dates in every
 *    locale; "01/10/2026" means January in one and October in the other.
 *  - Money is a plain decimal with two places and a dot, no thousands
 *    separator and no currency symbol. The currency has its own column, and
 *    nothing is converted or summed across currencies.
 *  - A cell that a spreadsheet would run as a formula (=, +, @, a tab, or a
 *    minus not followed by a number) gets a leading apostrophe. A client name
 *    is typed by a user; it must not become a formula on the accountant's PC.
 *  - UTF-8 with a byte-order mark, so Excel shows "Café Oranjestad", not
 *    "CafÃ© Oranjestad"; CRLF line ends.
 *  - Drafts are left out: a draft invoice is not in the books. Voided invoices
 *    are kept, with their status, because their number was issued.
 *  - Credit notes are their own file, one row per credit note, because they
 *    are their own documents with their own numbers (CN-YYYY-NNN). Their
 *    amounts are positive, as printed; the "Credited" column on the invoices
 *    file is what they took off each invoice, so Paid + Credited + Outstanding
 *    = Total on every row that is not void. Voided credit notes are kept, with
 *    their status, for the same reason as voided invoices.
 */
import type { CreditNoteDTO, ExpenseDTO, InvoiceDTO, TimeEntryDTO } from "./types";
import { buildTaxReport } from "./tax-report";

export const EXPORT_KINDS = [
  "invoices",
  "invoice-lines",
  "payments",
  "credit-notes",
  "time",
  "expenses",
  "tax",
] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

export function isExportKind(v: string): v is ExportKind {
  return (EXPORT_KINDS as readonly string[]).includes(v);
}

export type DateRange = { from: string | null; to: string | null };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Reads ?from=&to= into a range. Either end may be open. Returns an error
 * message (an English key, translated by the caller) for a bad date or a
 * range that ends before it starts.
 */
export function parseRange(
  from: string | null | undefined,
  to: string | null | undefined,
): { ok: true; range: DateRange } | { ok: false; error: string } {
  const f = from?.trim() || null;
  const t = to?.trim() || null;
  if (f && !validDate(f)) return { ok: false, error: "The start date is not a valid date." };
  if (t && !validDate(t)) return { ok: false, error: "The end date is not a valid date." };
  if (f && t && f > t) return { ok: false, error: "The end date is before the start date." };
  return { ok: true, range: { from: f, to: t } };
}

/** Inclusive on both ends; compares the YYYY-MM-DD part only. */
export function inRange(date: string | null | undefined, range: DateRange): boolean {
  if (!date) return !range.from && !range.to;
  const d = date.slice(0, 10);
  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}

export type Cell = string | number | boolean | null | undefined;
export type Table = { columns: string[]; rows: Cell[][] };

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "";
  // Add then remove a tiny epsilon so 1.005 rounds the way a person expects.
  const r = Math.round((n + Math.sign(n) * 1e-9) * 100) / 100;
  return (Object.is(r, -0) ? 0 : r).toFixed(2);
}

function day(s: string | null | undefined): string {
  return s ? s.slice(0, 10) : "";
}

// ── Tables ─────────────────────────────────────────────────────────────────

/** Issued, part-paid, paid and voided invoices whose issue date is in range. */
export function invoicesTable(invoices: InvoiceDTO[], range: DateRange): Table {
  const rows = invoices
    .filter((i) => i.status !== "DRAFT" && inRange(i.issueDate, range))
    .sort(byIssueThenNumber)
    .map((i) => [
      i.number,
      i.status,
      day(i.issueDate),
      day(i.dueDate),
      i.clientName,
      i.projectName ?? "",
      i.proposalNumber ?? "",
      i.title ?? "",
      i.currency,
      money(i.subtotal),
      i.taxName ?? "",
      i.taxPercent,
      i.taxMode,
      money(i.taxTotal),
      money(i.total),
      money(i.paid),
      money(i.credited ?? 0),
      money(i.status === "VOID" ? 0 : i.outstanding),
      day(i.voidedAt),
    ]);
  return {
    columns: [
      "Invoice number", "Status", "Issue date", "Due date", "Client", "Project", "Proposal",
      "Title", "Currency", "Net", "Tax name", "Tax %", "Tax mode", "Tax", "Total", "Paid",
      "Credited", "Outstanding", "Voided on",
    ],
    rows,
  };
}

/** Every line of the invoices in `invoicesTable`, in invoice order. */
export function invoiceLinesTable(invoices: InvoiceDTO[], range: DateRange): Table {
  const rows: Cell[][] = [];
  for (const i of invoices.filter((x) => x.status !== "DRAFT" && inRange(x.issueDate, range)).sort(byIssueThenNumber)) {
    for (const l of [...i.lines].sort((a, b) => a.sortOrder - b.sortOrder)) {
      rows.push([
        i.number,
        i.status,
        day(i.issueDate),
        i.clientName,
        i.projectName ?? "",
        l.description,
        l.milestoneName ?? "",
        l.quantity ?? "",
        money(l.unitRate),
        money(l.amount),
        l.taxable ? "Yes" : "No",
        i.currency,
      ]);
    }
  }
  return {
    columns: [
      "Invoice number", "Invoice status", "Issue date", "Client", "Project", "Description",
      "Milestone", "Quantity", "Unit rate", "Amount", "Taxable", "Currency",
    ],
    rows,
  };
}

/** Payments received in range, whatever date their invoice was issued. */
export function paymentsTable(invoices: InvoiceDTO[], range: DateRange): Table {
  const rows: Cell[][] = [];
  for (const i of invoices) {
    if (i.status === "DRAFT") continue;
    for (const p of i.payments) {
      if (!inRange(p.paidAt, range)) continue;
      rows.push([
        day(p.paidAt),
        i.number,
        i.clientName,
        i.projectName ?? "",
        money(p.amount),
        i.currency,
        p.method,
        p.reference ?? "",
        p.recordedByName ?? "",
      ]);
    }
  }
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])));
  return {
    columns: [
      "Paid on", "Invoice number", "Client", "Project", "Amount", "Currency", "Method",
      "Reference", "Recorded by",
    ],
    rows,
  };
}

/**
 * Issued and voided credit notes dated in range, one row per credit note, with
 * the invoice each one credits. Drafts are left out — not in the books.
 */
export function creditNotesTable(notes: CreditNoteDTO[], range: DateRange): Table {
  const rows = notes
    .filter((c) => c.status !== "DRAFT" && inRange(c.date, range))
    .sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number))
    .map((c) => [
      c.number,
      c.status,
      day(c.date),
      c.invoiceNumber,
      c.clientName,
      c.projectName ?? "",
      c.reason,
      c.currency,
      money(c.subtotal),
      c.taxName ?? "",
      c.taxPercent,
      c.taxMode,
      money(c.taxTotal),
      money(c.total),
      day(c.voidedAt),
    ]);
  return {
    columns: [
      "Credit note number", "Status", "Date", "Invoice number", "Client", "Project", "Reason",
      "Currency", "Net", "Tax name", "Tax %", "Tax mode", "Tax", "Total", "Voided on",
    ],
    rows,
  };
}

/** Approved time in range: hours, the rates as they were, and billing state. */
export function timeTable(entries: TimeEntryDTO[], range: DateRange): Table {
  const rows = entries
    .filter((e) => e.status === "APPROVED" && inRange(e.date, range))
    .sort((a, b) => a.date.localeCompare(b.date) || a.userName.localeCompare(b.userName))
    .map((e) => [
      e.date,
      e.userName,
      e.projectName ?? "",
      e.phaseName ?? "",
      e.description ?? "",
      e.hours,
      e.billable ? "Yes" : "No",
      money(e.chargeRate),
      money(e.costRate),
      e.currency,
      money(e.value),
      money(e.costRate === null ? null : e.hours * e.costRate),
      e.invoiceNumber ?? "",
      day(e.invoicedAt),
    ]);
  return {
    columns: [
      "Date", "Person", "Project", "Phase", "Description", "Hours", "Billable", "Charge rate",
      "Cost rate", "Currency", "Charge value", "Cost", "Invoice number", "Invoiced on",
    ],
    rows,
  };
}

/** Approved expenses in range, with markup, reimbursement and billing state. */
export function expensesTable(expenses: ExpenseDTO[], range: DateRange): Table {
  const rows = expenses
    .filter((e) => e.status === "APPROVED" && inRange(e.date, range))
    .sort((a, b) => a.date.localeCompare(b.date) || a.userName.localeCompare(b.userName))
    .map((e) => [
      e.date,
      e.userName,
      e.projectName ?? "",
      e.category,
      e.vendor ?? "",
      e.description,
      money(e.amount),
      e.currency,
      e.billable ? "Yes" : "No",
      e.markupPercent,
      money(e.chargeable),
      e.reimbursable ? "Yes" : "No",
      day(e.reimbursedAt),
      e.invoiceNumber ?? "",
      day(e.invoicedAt),
    ]);
  return {
    columns: [
      "Date", "Person", "Project", "Category", "Vendor", "Description", "Amount", "Currency",
      "Billable", "Markup %", "Chargeable", "Reimbursable", "Reimbursed on", "Invoice number",
      "Invoiced on",
    ],
    rows,
  };
}

/**
 * The turnover-tax ledger behind /finance/tax: one row per invoice issued in
 * range (basis "Invoiced") and one per payment received in range (basis
 * "Received", its tax pro rata). Built by lib/finance/tax-report.ts, so the CSV
 * and the screen cannot disagree. The two bases are alternatives — an
 * accountant sums one or the other, never both.
 */
export function taxTable(invoices: InvoiceDTO[], range: DateRange): Table {
  const report = buildTaxReport(invoices, range);
  const rows: Cell[][] = [
    ...report.invoices.map((r) => [
      "Invoiced", r.issueDate, r.number, r.clientName, r.currency, r.taxName ?? "",
      r.taxPercent, r.taxPercent > 0 ? r.taxMode : "", money(r.net), money(r.tax), money(r.gross),
    ]),
    ...report.payments.map((r) => [
      "Received", r.paidAt, r.invoiceNumber, r.clientName, r.currency, r.taxName ?? "",
      r.taxPercent, r.taxPercent > 0 ? r.taxMode : "", money(r.net), money(r.tax), money(r.gross),
    ]),
  ];
  return {
    columns: [
      "Basis", "Date", "Invoice number", "Client", "Currency", "Tax name", "Tax %", "Tax mode",
      "Net", "Tax", "Gross",
    ],
    rows,
  };
}

function byIssueThenNumber(a: InvoiceDTO, b: InvoiceDTO): number {
  return (a.issueDate ?? "").localeCompare(b.issueDate ?? "") || a.number.localeCompare(b.number);
}

// ── CSV ────────────────────────────────────────────────────────────────────

/** A user-typed value a spreadsheet would execute. Numbers are left alone. */
function guardFormula(s: string): string {
  return /^[=+@\t\r]/.test(s) || /^-(?![\d.])/.test(s) ? `'${s}` : s;
}

export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? guardFormula(v) : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const BOM = "﻿";

export function toCsv(table: Table): string {
  const lines = [table.columns.map(csvCell).join(","), ...table.rows.map((r) => r.map(csvCell).join(","))];
  return `${BOM}${lines.join("\r\n")}\r\n`;
}

/** "accounting-invoices-2026-01-01-to-2026-03-31.csv"; open ends say "start" / "today". */
export function exportFilename(kind: ExportKind, range: DateRange, today: string): string {
  return `accounting-${kind}-${range.from ?? "start"}-to-${range.to ?? today}.csv`;
}

export function buildTable(
  kind: ExportKind,
  data: {
    invoices?: InvoiceDTO[];
    creditNotes?: CreditNoteDTO[];
    time?: TimeEntryDTO[];
    expenses?: ExpenseDTO[];
  },
  range: DateRange,
): Table {
  switch (kind) {
    case "invoices":
      return invoicesTable(data.invoices ?? [], range);
    case "invoice-lines":
      return invoiceLinesTable(data.invoices ?? [], range);
    case "payments":
      return paymentsTable(data.invoices ?? [], range);
    case "credit-notes":
      return creditNotesTable(data.creditNotes ?? [], range);
    case "time":
      return timeTable(data.time ?? [], range);
    case "expenses":
      return expensesTable(data.expenses ?? [], range);
    case "tax":
      return taxTable(data.invoices ?? [], range);
  }
}
