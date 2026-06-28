import { listReports, createReport } from "@/lib/data/ca/reports";
import { ok, created, badRequest, fail } from "@/lib/ca/api";
import type { ManpowerRow } from "@/lib/ca/types";

export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get("projectId") ?? undefined;
  try {
    return ok(await listReports(projectId));
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  if (!body.projectId || !body.reportType) return badRequest("projectId and reportType are required");
  try {
    const report = await createReport({
      projectId: String(body.projectId),
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
      manpowerSummary: Array.isArray(body.manpowerSummary)
        ? (body.manpowerSummary as ManpowerRow[])
        : [],
      materialDeliveries: (body.materialDeliveries as string) ?? null,
      safetyIncidents: (body.safetyIncidents as string) ?? null,
      qualityIssues: (body.qualityIssues as string) ?? null,
      delays: (body.delays as string) ?? null,
      risks: (body.risks as string) ?? null,
      notes: (body.notes as string) ?? null,
    });
    return created(report);
  } catch (err) {
    return fail(err);
  }
}
