import { getCertification, updateCertification } from "@/lib/data/ca/certifications";
import { ok, notFound, badRequest, fail, n } from "@/lib/ca/api";
import { routeDenied } from "@/lib/server/route-gate";
import { certificationWriteIsDecision } from "@/lib/permissions/role-gates";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const cert = await getCertification(id);
    return cert ? ok(cert) : notFound("Certification not found");
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await routeDenied("write");
  if (denied) return denied;
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  try {
    // Issuing or approving a certification — or editing one that is — certifies
    // money: administrator, director or founder only (security audit D-6).
    const current = await getCertification(id);
    if (!current) return notFound("Certification not found");
    if (certificationWriteIsDecision(current.status, body.status as string | undefined)) {
      const refused = await routeDenied("certification.decide");
      if (refused) return refused;
    }
    const cert = await updateCertification(id, {
      projectId: String(body.projectId ?? ""),
      projectName: (body.projectName as string) ?? null,
      inspectionDate: (body.inspectionDate as string) ?? null,
      certifiedBy: (body.certifiedBy as string) ?? null,
      lenderName: (body.lenderName as string) ?? null,
      contractorName: (body.contractorName as string) ?? null,
      contractValue: n(body.contractValue),
      currency: (body.currency as string) ?? undefined,
      previousPercentComplete: n(body.previousPercentComplete),
      currentPercentComplete: n(body.currentPercentComplete),
      retentionPercentage: n(body.retentionPercentage),
      previousPaymentsValue: n(body.previousPaymentsValue),
      deficiencies: (body.deficiencies as string) ?? null,
      recommendation: (body.recommendation as string) ?? null,
      status: body.status as never,
    });
    return ok(cert);
  } catch (err) {
    return fail(err);
  }
}
