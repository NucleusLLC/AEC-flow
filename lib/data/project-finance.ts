/**
 * One project's FINANCE tab — data access. SERVER-ONLY. READ-ONLY.
 *
 * ─── IT COMPUTES NOTHING ITSELF ─────────────────────────────────────────────
 * The rows are loaded through the existing readers (listInvoices, listExpenses,
 * getPhaseScreen, profitByProject) and handed to lib/finance/project-finance.ts,
 * which in turn only calls the finance module's own tested arithmetic.
 *
 * ─── TENANCY ────────────────────────────────────────────────────────────────
 * The project is loaded first through the tenant-scoped client (`findFirst`
 * with a narrow select, never `findUnique`); everything after is filtered by
 * that project's id, and Invoice, Expense and TimeEntry are tenant-scoped by
 * the extension in lib/db.ts as well.
 *
 * ─── WHO SEES WHAT ──────────────────────────────────────────────────────────
 * The tab is open to every member, like Invoices, Time and Expenses. Cost and
 * margin are not: they are worked out from internal cost rates, so `profit` is
 * only loaded for member administrators (canManagePasswords — the same gate as
 * /finance/profit and listTimekeepers) and is null for everyone else. The time
 * rows read here never select a cost rate at all.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";
import { listInvoices } from "@/lib/data/invoices";
import { listExpenses } from "@/lib/data/expenses";
import { getPhaseScreen } from "@/lib/data/project-phases";
import { profitByProject } from "@/lib/data/finance-analysis";
import {
  hoursByPerson,
  projectBilling,
  projectWip,
  type PersonHours,
  type ProjectBilling,
  type ProjectWip,
} from "@/lib/finance/project-finance";
import type { ProjectProfitability } from "@/lib/finance/timesheet";
import type { ExpenseDTO, FinanceApprovalStatus, InvoiceSummaryDTO } from "@/lib/finance/types";
import type { PhaseHoursFigures } from "@/lib/projects/phases";

export type PhaseHoursLine = Pick<PhaseHoursFigures, "approved" | "pending" | "hours"> & {
  phaseId: string | null;
  /** null = hours booked to the project with no phase. */
  phaseName: string | null;
};

export type ProjectFinance = {
  projectId: string;
  currency: string;
  billing: ProjectBilling[];
  wip: ProjectWip[];
  /** Per currency; null when the caller may not see cost. */
  profit: { currency: string; row: ProjectProfitability }[] | null;
  phases: PhaseHoursLine[];
  totalHours: Pick<PhaseHoursFigures, "approved" | "pending" | "hours">;
  people: PersonHours[];
  invoices: InvoiceSummaryDTO[];
  expenses: ExpenseDTO[];
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

export async function getProjectFinance(projectId: string, today: string): Promise<ProjectFinance | null> {
  const actor = await requireActor();
  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: { id: true, name: true, currency: true, contractValue: true },
  });
  if (!project) return null;

  const showCost = canManagePasswords(actor.role, actor.isFounder);

  const [invoices, expenses, timeRows, phaseScreen, analyses] = await Promise.all([
    listInvoices({ projectId: project.id }),
    listExpenses({ projectId: project.id }),
    // Only what the work-in-progress figure needs: charge-out, never cost.
    prisma.timeEntry.findMany({
      where: { projectId: project.id, deletedAt: null, billable: true, status: "APPROVED", invoicedAt: null },
      select: { hours: true, billable: true, status: true, chargeRate: true, currency: true, invoicedAt: true },
      take: 20_000,
    }),
    getPhaseScreen(project.id),
    showCost ? profitByProject({ projectId: project.id }) : Promise.resolve(null),
  ]);

  const currency = project.currency || "AWG";

  const billing = projectBilling(
    invoices,
    { value: project.contractValue === null ? null : num(project.contractValue), currency },
    today,
  );

  const wip = projectWip(
    timeRows.map((r) => ({
      hours: num(r.hours),
      billable: r.billable,
      status: r.status as FinanceApprovalStatus,
      chargeRate: num(r.chargeRate),
      invoicedAt: r.invoicedAt?.toISOString() ?? null,
      projectId: project.id,
      projectName: project.name,
      currency: r.currency || "AWG",
    })),
    expenses.map((x) => ({
      amount: x.amount,
      markupPercent: x.markupPercent,
      billable: x.billable,
      status: x.status,
      invoicedAt: x.invoicedAt,
      projectId: project.id,
      projectName: project.name,
      currency: x.currency || "AWG",
    })),
    project.id,
  );

  const profit = analyses
    ? analyses.flatMap((a) =>
        a.projects
          .filter((p) => p.projectId === project.id)
          .map((row) => ({ currency: a.currency, row })),
      )
    : null;

  const phaseName = new Map(phaseScreen.phases.map((p) => [p.id, p.name]));
  const phases: PhaseHoursLine[] = phaseScreen.hours.rows.map((r) => ({
    phaseId: r.phaseId,
    phaseName: r.phaseId ? (phaseName.get(r.phaseId) ?? null) : null,
    approved: r.approved,
    pending: r.pending,
    hours: r.hours,
  }));
  const { approved, pending, hours } = phaseScreen.hours.total;

  return {
    projectId: project.id,
    currency,
    billing,
    wip,
    profit,
    phases,
    totalHours: { approved, pending, hours },
    people: hoursByPerson(phaseScreen.hours),
    invoices,
    expenses,
  };
}
