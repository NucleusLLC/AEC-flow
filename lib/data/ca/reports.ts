/** CA Reports repository (Prisma-first, seed fallback). */
import { prisma } from "@/lib/db";
import { caRead, ymd, ymdReq } from "@/lib/data/ca/repo";
import { SEED_REPORTS } from "@/lib/ca/seed-data";
import { CA_REPORT_TYPE_LABEL } from "@/lib/ca/labels";
import type { CaReport, CaReportType, CaReportStatus, ManpowerRow } from "@/lib/ca/types";

export type ReportInput = {
  projectId: string;
  projectName?: string | null;
  reportType: CaReportType;
  reportingPeriodStart?: string | null;
  reportingPeriodEnd?: string | null;
  preparedBy?: string | null;
  reviewedBy?: string | null;
  status?: CaReportStatus;
  weatherSummary?: string | null;
  siteConditions?: string | null;
  workCompleted?: string | null;
  workPlannedNextPeriod?: string | null;
  manpowerSummary?: ManpowerRow[];
  materialDeliveries?: string | null;
  safetyIncidents?: string | null;
  qualityIssues?: string | null;
  delays?: string | null;
  risks?: string | null;
  notes?: string | null;
};

type Row = Awaited<ReturnType<typeof prisma.caReport.findFirstOrThrow>>;

function manpower(v: unknown): ManpowerRow[] {
  return Array.isArray(v) ? (v as ManpowerRow[]) : [];
}

function toDto(r: Row): CaReport {
  return {
    id: r.id,
    projectId: r.projectId,
    projectName: r.projectName ?? r.projectId,
    reportType: r.reportType,
    reportNumber: r.reportNumber,
    version: r.version,
    reportingPeriodStart: ymd(r.reportingPeriodStart),
    reportingPeriodEnd: ymd(r.reportingPeriodEnd),
    preparedBy: r.preparedBy,
    reviewedBy: r.reviewedBy,
    approvedBy: r.approvedBy,
    status: r.status,
    weatherSummary: r.weatherSummary,
    siteConditions: r.siteConditions,
    workCompleted: r.workCompleted,
    workPlannedNextPeriod: r.workPlannedNextPeriod,
    manpowerSummary: manpower(r.manpowerSummary),
    materialDeliveries: r.materialDeliveries,
    safetyIncidents: r.safetyIncidents,
    qualityIssues: r.qualityIssues,
    delays: r.delays,
    risks: r.risks,
    notes: r.notes,
    createdAt: ymdReq(r.createdAt),
    updatedAt: ymdReq(r.updatedAt),
  };
}

export async function listReports(projectId?: string): Promise<CaReport[]> {
  return caRead(
    async () => {
      const rows = await prisma.caReport.findMany({
        where: projectId ? { projectId } : undefined,
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toDto);
    },
    () =>
      SEED_REPORTS.filter((r) => !projectId || r.projectId === projectId).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
  );
}

export async function getReport(id: string): Promise<CaReport | null> {
  return caRead(
    async () => {
      const row = await prisma.caReport.findFirst({ where: { OR: [{ id }, { reportNumber: id }] } });
      return row ? toDto(row) : null;
    },
    () => SEED_REPORTS.find((r) => r.id === id || r.reportNumber === id) ?? null,
  );
}

export async function createReport(input: ReportInput): Promise<CaReport> {
  const existing = await listReports(input.projectId);
  const row = await prisma.caReport.create({
    data: {
      projectId: input.projectId,
      projectName: input.projectName ?? null,
      reportType: input.reportType,
      reportNumber: nextReportNumber(input.reportType, input.projectId, existing.map((r) => r.reportNumber)),
      reportingPeriodStart: input.reportingPeriodStart ? new Date(input.reportingPeriodStart) : null,
      reportingPeriodEnd: input.reportingPeriodEnd ? new Date(input.reportingPeriodEnd) : null,
      preparedBy: input.preparedBy ?? null,
      reviewedBy: input.reviewedBy ?? null,
      status: input.status ?? "DRAFT",
      weatherSummary: input.weatherSummary ?? null,
      siteConditions: input.siteConditions ?? null,
      workCompleted: input.workCompleted ?? null,
      workPlannedNextPeriod: input.workPlannedNextPeriod ?? null,
      manpowerSummary: input.manpowerSummary ?? [],
      materialDeliveries: input.materialDeliveries ?? null,
      safetyIncidents: input.safetyIncidents ?? null,
      qualityIssues: input.qualityIssues ?? null,
      delays: input.delays ?? null,
      risks: input.risks ?? null,
      notes: input.notes ?? null,
    },
  });
  return toDto(row);
}

export async function updateReport(id: string, input: ReportInput): Promise<CaReport> {
  const row = await prisma.caReport.update({
    where: { id },
    data: {
      projectName: input.projectName ?? null,
      reportType: input.reportType,
      reportingPeriodStart: input.reportingPeriodStart ? new Date(input.reportingPeriodStart) : null,
      reportingPeriodEnd: input.reportingPeriodEnd ? new Date(input.reportingPeriodEnd) : null,
      preparedBy: input.preparedBy ?? null,
      reviewedBy: input.reviewedBy ?? null,
      ...(input.status ? { status: input.status } : {}),
      weatherSummary: input.weatherSummary ?? null,
      siteConditions: input.siteConditions ?? null,
      workCompleted: input.workCompleted ?? null,
      workPlannedNextPeriod: input.workPlannedNextPeriod ?? null,
      manpowerSummary: input.manpowerSummary ?? [],
      materialDeliveries: input.materialDeliveries ?? null,
      safetyIncidents: input.safetyIncidents ?? null,
      qualityIssues: input.qualityIssues ?? null,
      delays: input.delays ?? null,
      risks: input.risks ?? null,
      notes: input.notes ?? null,
      // reportNumber + reportType prefix stay stable once created.
    },
  });
  return toDto(row);
}

const TYPE_PREFIX: Record<CaReportType, string> = {
  DAILY: "DR",
  WEEKLY: "WR",
  BIWEEKLY: "BW",
  MONTHLY: "MR",
  EXECUTIVE: "ER",
  PROGRESS_CERTIFICATION: "PC",
  BANK_DRAW: "BD",
  COMPLETION: "CR",
};

export function nextReportNumber(
  type: CaReportType,
  projectId: string,
  existing: string[],
  year = 2026,
): string {
  const prefix = TYPE_PREFIX[type];
  const suffix = projectId.replace(/[^0-9]/g, "").slice(-3).padStart(3, "0");
  let max = 0;
  for (const n of existing) {
    if (!n.startsWith(prefix + "-")) continue;
    const m = /(\d+)$/.exec(n);
    if (m && Number(m[1]) > max) max = Number(m[1]);
  }
  return `${prefix}-${year}-${suffix}-${String(max + 1).padStart(3, "0")}`;
}

export { CA_REPORT_TYPE_LABEL };
