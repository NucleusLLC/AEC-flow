import { getReport, updateReport } from "@/lib/data/ca/reports";
import { ok, notFound, badRequest, fail } from "@/lib/ca/api";
import type { ManpowerRow } from "@/lib/ca/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const report = await getReport(id);
    return report ? ok(report) : notFound("Report not found");
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  try {
    const report = await updateReport(id, {
      projectId: String(body.projectId ?? ""),
      projectName: (body.projectName as string) ?? null,
      reportType: body.reportType as never,
      reportingPeriodStart: (body.reportingPeriodStart as string) ?? null,
      reportingPeriodEnd: (body.reportingPeriodEnd as string) ?? null,
      preparedBy: (body.preparedBy as string) ?? null,
      reviewedBy: (body.reviewedBy as string) ?? null,
      status: body.status as never,
      weatherSummary: (body.weatherSummary as string) ?? null,
      siteConditions: (body.siteConditions as string) ?? null,
      workCompleted: (body.workCompleted as string) ?? null,
      workPlannedNextPeriod: (body.workPlannedNextPeriod as string) ?? null,
      manpowerSummary: Array.isArray(body.manpowerSummary) ? (body.manpowerSummary as ManpowerRow[]) : undefined,
      materialDeliveries: (body.materialDeliveries as string) ?? null,
      safetyIncidents: (body.safetyIncidents as string) ?? null,
      qualityIssues: (body.qualityIssues as string) ?? null,
      delays: (body.delays as string) ?? null,
      risks: (body.risks as string) ?? null,
      notes: (body.notes as string) ?? null,
    });
    return ok(report);
  } catch (err) {
    return fail(err);
  }
}
