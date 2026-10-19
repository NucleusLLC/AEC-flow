/**
 * The Finance overview's tiles: outstanding, overdue, received this month and
 * drafts — one row per currency, never one across them (a total that adds
 * florins to dollars is a number with no meaning; docs/finance/SPEC.md).
 *
 * No new money arithmetic lives here. What is owed and what is overdue are
 * `receivablesSummary` (lib/finance/calc.ts), the function the register and
 * the project Finance tab already read; the overdue count is `isOverdue`
 * (lib/finance/overdue.ts), the chase list's own rule; and the month's receipts
 * are summed in exact minor units with the shared money primitive. Pure.
 */
import { receivablesSummary } from "@/lib/finance/calc";
import { isOverdue } from "@/lib/finance/overdue";
import { add, fromMajor, toMajor, zero } from "@/lib/proposals/engine/money";
import type { InvoiceStatus, InvoiceSummaryDTO } from "@/lib/finance/types";

export type HubPayment = {
  currency: string;
  amount: number;
  /** YYYY-MM-DD (or an ISO timestamp; only the date is read). */
  paidAt: string | null;
  /** The status of the invoice the payment was recorded against. */
  invoiceStatus: InvoiceStatus;
};

export type HubCurrencyTiles = {
  currency: string;
  outstanding: number;
  /** Invoices with money still owed. */
  openCount: number;
  overdue: number;
  overdueCount: number;
  /** Payments dated in the calendar month of `today`. */
  receivedThisMonth: number;
  receivedThisMonthCount: number;
  drafts: number;
};

type HubInvoice = Pick<
  InvoiceSummaryDTO,
  | "id"
  | "number"
  | "status"
  | "currency"
  | "clientId"
  | "clientName"
  | "dueDate"
  | "total"
  | "paid"
  | "credited"
  | "outstanding"
>;

/** "2026-10" for any date or timestamp in October 2026. */
function monthOf(date: string | null | undefined): string | null {
  const m = /^(\d{4}-\d{2})-\d{2}/.exec(String(date ?? ""));
  return m ? m[1] : null;
}

/**
 * One tile row per currency that has anything to show, the preferred (system)
 * currency first, then alphabetical. A currency whose every figure is zero is
 * left out so a practice billing in one currency sees one row.
 */
export function financeHubTiles(
  invoices: readonly HubInvoice[],
  payments: readonly HubPayment[],
  today: string,
  preferredCurrency?: string,
): HubCurrencyTiles[] {
  const month = monthOf(today);
  const currencies = new Set<string>();
  for (const i of invoices) currencies.add(i.currency);
  for (const p of payments) currencies.add(p.currency);

  const rows: HubCurrencyTiles[] = [];
  for (const currency of currencies) {
    const mine = invoices.filter((i) => i.currency === currency);
    const summary = receivablesSummary(mine, today, currency);
    const overdueCount = mine.filter((i) =>
      isOverdue({ ...i, dueDate: i.dueDate ?? null }, today),
    ).length;
    const openCount = mine.filter(
      (i) => i.status !== "DRAFT" && i.status !== "VOID" && fromMajor(i.outstanding, currency).minor > 0,
    ).length;

    // A payment against a voided invoice was withdrawn with it; one against a
    // draft cannot exist (lib/data/invoices.ts refuses it). Neither is income.
    const received = payments.filter(
      (p) =>
        p.currency === currency &&
        p.invoiceStatus !== "VOID" &&
        p.invoiceStatus !== "DRAFT" &&
        month !== null &&
        monthOf(p.paidAt) === month,
    );
    const receivedThisMonth = toMajor(
      received.reduce((acc, p) => add(acc, fromMajor(p.amount, currency)), zero(currency)),
    );

    const row: HubCurrencyTiles = {
      currency,
      outstanding: summary.outstanding,
      openCount,
      overdue: summary.overdue,
      overdueCount,
      receivedThisMonth,
      receivedThisMonthCount: received.length,
      drafts: summary.drafts,
    };
    if (row.outstanding !== 0 || row.receivedThisMonth !== 0 || row.drafts > 0 || row.overdue !== 0) {
      rows.push(row);
    }
  }

  return rows.sort((a, b) => {
    if (preferredCurrency) {
      if (a.currency === preferredCurrency && b.currency !== preferredCurrency) return -1;
      if (b.currency === preferredCurrency && a.currency !== preferredCurrency) return 1;
    }
    return a.currency.localeCompare(b.currency);
  });
}
