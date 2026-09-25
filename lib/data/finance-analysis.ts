/**
 * What a job earned and what it cost — data access. SERVER-ONLY.
 *
 * ─── IT COMPUTES NOTHING ITSELF ─────────────────────────────────────────────
 * Every figure comes from `lib/finance/timesheet.ts` — `projectProfitability`
 * and `unbilledByProject` — which are pure and already tested. This module
 * loads the rows, groups them by currency, and hands them over. A second
 * implementation of "what is billable" living in a data layer is how two
 * screens come to disagree about the same job.
 *
 * ─── PER CURRENCY, BECAUSE A TOTAL ACROSS CURRENCIES MEANS NOTHING ──────────
 * The same rule the receivables and expense registers keep. A practice billing
 * a job in USD and another in AWG has two numbers, not one.
 *
 * ─── COST IS NOT A COLLEAGUE'S BUSINESS ─────────────────────────────────────
 * Margin is computed from internal cost rates, which are close to salaries. The
 * screen is for member administrators only, and the gate is here as well as on
 * the page — a server action and a page are both public endpoints.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";
import {
  projectProfitability,
  unbilledByProject,
  timesheetTotals,
  utilisationPct,
  type CalcExpense,
  type CalcTimeEntry,
  type ProjectProfitability,
  type UnbilledProject,
} from "@/lib/finance/timesheet";
import type { FinanceApprovalStatus } from "@/lib/finance/types";

export class ProfitForbiddenError extends Error {
  constructor() {
    super("Only a director or an administrator can see what a job costs.");
    this.name = "ProfitForbiddenError";
  }
}

export type CurrencyAnalysis = {
  currency: string;
  projects: ProjectProfitability[];
  unbilled: UnbilledProject[];
  totals: {
    hours: number;
    billableHours: number;
    utilisation: number;
    earned: number;
    cost: number;
    margin: number;
    marginPct: number;
    unbilled: number;
  };
};

export type ProfitFilter = {
  /** `YYYY-MM-DD`; omit for everything. */
  from?: string;
  to?: string;
  projectId?: string;
};

type DecimalLike = { toNumber(): number } | number | string | null | undefined;

function num(v: DecimalLike): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  const n = v.toNumber();
  return Number.isFinite(n) ? n : 0;
}

function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(`${s.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateWhere(filter: ProfitFilter | undefined) {
  const from = toDate(filter?.from);
  const to = toDate(filter?.to);
  if (!from && !to) return {};
  return { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } };
}

/**
 * The practice's jobs, by currency: what each earned, what it cost, and what
 * is still waiting to be billed.
 */
export async function profitByProject(filter?: ProfitFilter): Promise<CurrencyAnalysis[]> {
  const actor = await requireActor();
  if (!canManagePasswords(actor.role, actor.isFounder)) throw new ProfitForbiddenError();

  const where = {
    deletedAt: null,
    ...(filter?.projectId ? { projectId: filter.projectId } : {}),
    ...dateWhere(filter),
  };

  const [timeRows, expenseRows] = await Promise.all([
    prisma.timeEntry.findMany({
      where,
      select: {
        date: true,
        hours: true,
        billable: true,
        status: true,
        chargeRate: true,
        costRate: true,
        currency: true,
        invoicedAt: true,
        projectId: true,
        projectName: true,
      },
      take: 20_000,
    }),
    prisma.expense.findMany({
      where,
      select: {
        date: true,
        amount: true,
        markupPercent: true,
        billable: true,
        status: true,
        currency: true,
        invoicedAt: true,
        projectId: true,
        projectName: true,
      },
      take: 20_000,
    }),
  ]);

  const currencies = new Set<string>();
  for (const r of timeRows) currencies.add(r.currency || "AWG");
  for (const r of expenseRows) currencies.add(r.currency || "AWG");
  if (currencies.size === 0) return [];

  const out: CurrencyAnalysis[] = [];

  for (const currency of [...currencies].sort()) {
    const entries: CalcTimeEntry[] = timeRows
      .filter((r) => (r.currency || "AWG") === currency)
      .map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        hours: num(r.hours),
        billable: r.billable,
        status: r.status as FinanceApprovalStatus,
        chargeRate: num(r.chargeRate),
        costRate: num(r.costRate),
        invoicedAt: r.invoicedAt?.toISOString() ?? null,
        projectId: r.projectId,
        projectName: r.projectName,
      }));

    const expenses: CalcExpense[] = expenseRows
      .filter((r) => (r.currency || "AWG") === currency)
      .map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        amount: num(r.amount),
        markupPercent: num(r.markupPercent),
        billable: r.billable,
        status: r.status as FinanceApprovalStatus,
        invoicedAt: r.invoicedAt?.toISOString() ?? null,
        projectId: r.projectId,
        projectName: r.projectName,
      }));

    const projects = projectProfitability(entries, expenses, currency);
    const unbilled = unbilledByProject(entries, expenses, currency);
    const hours = timesheetTotals(entries, currency);

    const earned = projects.reduce((t, p) => t + p.earned, 0);
    const cost = projects.reduce((t, p) => t + p.cost, 0);
    const margin = Math.round((earned - cost) * 100) / 100;

    out.push({
      currency,
      projects,
      unbilled,
      totals: {
        hours: hours.hours,
        billableHours: hours.billableHours,
        utilisation: utilisationPct(hours.billableHours, hours.hours),
        earned: Math.round(earned * 100) / 100,
        cost: Math.round(cost * 100) / 100,
        margin,
        marginPct: earned > 0 ? Math.round((margin / earned) * 1000) / 10 : 0,
        unbilled: Math.round(unbilled.reduce((t, u) => t + u.total, 0) * 100) / 100,
      },
    });
  }

  return out;
}

/** May the signed-in person see cost and margin at all? */
export async function canSeeProfit(): Promise<boolean> {
  try {
    const actor = await requireActor();
    return canManagePasswords(actor.role, actor.isFounder);
  } catch {
    return false;
  }
}
