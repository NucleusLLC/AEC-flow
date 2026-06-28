import { listCertifications, createCertification } from "@/lib/data/ca/certifications";
import { ok, created, badRequest, fail, n } from "@/lib/ca/api";

export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get("projectId") ?? undefined;
  try {
    return ok(await listCertifications(projectId));
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
  if (!body.projectId) return badRequest("projectId is required");
  try {
    const cert = await createCertification({
      projectId: String(body.projectId),
      projectName: (body.projectName as string) ?? null,
      inspectionDate: (body.inspectionDate as string) ?? null,
      certifiedBy: (body.certifiedBy as string) ?? null,
      lenderName: (body.lenderName as string) ?? null,
      contractorName: (body.contractorName as string) ?? null,
      contractValue: n(body.contractValue),
      currency: (body.currency as string) ?? "USD",
      previousPercentComplete: n(body.previousPercentComplete),
      currentPercentComplete: n(body.currentPercentComplete),
      retentionPercentage: n(body.retentionPercentage),
      previousPaymentsValue: n(body.previousPaymentsValue),
      deficiencies: (body.deficiencies as string) ?? null,
      recommendation: (body.recommendation as string) ?? null,
      status: body.status as never,
    });
    return created(cert);
  } catch (err) {
    return fail(err);
  }
}
