/**
 * One project's finances, put together for the project's FINANCE tab. PURE —
 * no Prisma, no React, no I/O.
 *
 * ─── IT INVENTS NO MONEY MATH ───────────────────────────────────────────────
 * Every figure is one the finance module already computes: what was billed,
 * received, outstanding and overdue comes from `receivablesSummary`
 * (lib/finance/calc.ts); work waiting to be billed from `unbilledByProject`
 * (lib/finance/timesheet.ts); hours by phase from `phaseHours`
 * (lib/projects/phases.ts). The only arithmetic here is against the contract
 * value — billed as a share of it, and what is left to bill — and that goes
 * through `lib/proposals/engine/money.ts` like every other sum in finance.
 *
 * ─── PER CURRENCY ───────────────────────────────────────────────────────────
 * A job invoiced in two currencies has two sets of numbers. The contract value
 * is in the project's currency, so it is set against invoices in that currency
 * only; an invoice in any other currency is shown on its own, never converted.
 */
import { fromMajor, subtract, toMajor } from "@/lib/proposals/engine/money";
import { receivablesSummary, type ReceivablesSummary } from "./calc";
import {
  roundHours,
  unbilledByProject,
  type CalcExpense,
  type CalcTimeEntry,
} from "./timesheet";
import type { InvoiceStatus } from "./types";
import type { PhaseHoursReport } from "@/lib/projects/phases";

export type ProjectBillingInvoice = {
  status: InvoiceStatus;
  currency: string;
  total: number;
  paid: number;
  outstanding: number;
  dueDate?: string | null;
};

export type ProjectBilling = {
  currency: string;
  /** The project's contract value, only on the row in the project's own currency; null when none is set. */
  contractValue: number | null;
  summary: ReceivablesSummary;
  /** Billed as a percentage of the contract value, one decimal. Null without a contract value. */
  billedPct: number | null;
  /** Contract value less what has been billed. Negative when billed beyond the contract. */
  leftToBill: number | null;
};

/**
 * Contract against what has been invoiced, one row per currency.
 *
 * The project's own currency comes first and is always present when a contract
 * value is set — "nothing billed yet against 120,000" is the most useful thing
 * the tab can say about a new job. A contract value of zero counts as not set:
 * the project form stores a blank as nothing and reads nothing back as 0.
 */
export function projectBilling(
  invoices: ProjectBillingInvoice[],
  contract: { value: number | null | undefined; currency: string },
  today: string,
): ProjectBilling[] {
  const contractMinor = fromMajor(contract.value ?? 0, contract.currency);
  const hasContract = contractMinor.minor > 0;

  const currencies = new Set(invoices.map((i) => i.currency));
  if (hasContract) currencies.add(contract.currency);

  const ordered = [...currencies].sort((a, b) =>
    a === contract.currency ? -1 : b === contract.currency ? 1 : a.localeCompare(b),
  );

  return ordered.map((currency) => {
    const summary = receivablesSummary(
      invoices.filter((i) => i.currency === currency),
      today,
      currency,
    );
    if (!hasContract || currency !== contract.currency) {
      return { currency, contractValue: null, summary, billedPct: null, leftToBill: null };
    }
    const billed = fromMajor(summary.billed, currency);
    return {
      currency,
      contractValue: toMajor(contractMinor),
      summary,
      // A ratio of two exact minor-unit amounts, not a sum of money.
      billedPct: Math.round((billed.minor / contractMinor.minor) * 1000) / 10,
      leftToBill: toMajor(subtract(contractMinor, billed)),
    };
  });
}

export type ProjectWip = {
  currency: string;
  hours: number;
  timeValue: number;
  expenseValue: number;
  total: number;
};

/**
 * Approved, billable, not-yet-invoiced work on this project, per currency —
 * `unbilledByProject` filtered to the one job. Currencies with nothing waiting
 * are left out.
 */
export function projectWip(
  entries: (CalcTimeEntry & { currency: string })[],
  expenses: (CalcExpense & { currency: string })[],
  projectId: string,
): ProjectWip[] {
  const currencies = new Set<string>([
    ...entries.map((e) => e.currency),
    ...expenses.map((x) => x.currency),
  ]);
  const out: ProjectWip[] = [];
  for (const currency of [...currencies].sort()) {
    const row = unbilledByProject(
      entries.filter((e) => e.currency === currency && e.projectId === projectId),
      expenses.filter((x) => x.currency === currency && x.projectId === projectId),
      currency,
    ).find((r) => r.projectId === projectId);
    if (!row || (row.total <= 0 && row.hours <= 0)) continue;
    out.push({
      currency,
      hours: row.hours,
      timeValue: row.timeValue,
      expenseValue: row.expenseValue,
      total: row.total,
    });
  }
  return out;
}

export type PersonHours = {
  userId: string;
  userName: string;
  approved: number;
  pending: number;
  hours: number;
};

/**
 * Everyone's hours on the job, across all phases — the per-phase report's
 * people merged. Hours only: what a colleague is paid or charged out at is not
 * this list's business. Most hours first.
 */
export function hoursByPerson(report: PhaseHoursReport): PersonHours[] {
  const people = new Map<string, PersonHours>();
  for (const row of report.rows) {
    for (const p of row.people) {
      const acc =
        people.get(p.userId) ??
        { userId: p.userId, userName: p.userName, approved: 0, pending: 0, hours: 0 };
      acc.approved = roundHours(acc.approved + p.approved);
      acc.pending = roundHours(acc.pending + p.pending);
      acc.hours = roundHours(acc.hours + p.hours);
      people.set(p.userId, acc);
    }
  }
  return [...people.values()].sort((a, b) => b.hours - a.hours || a.userName.localeCompare(b.userName));
}
