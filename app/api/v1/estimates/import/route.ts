/**
 * POST /api/v1/estimates/import — a connected app (M.E.P.flow) sends a material
 * take-off; it becomes a new DRAFT cost estimate in the token's practice, with
 * quantities only (every unit cost 0, for the estimator to price).
 *
 * PUBLIC in proxy.ts: the Bearer token is the authentication. Order of work:
 *  1. the token (401 / 403) — before the body is even read;
 *  2. the body: at most 1 MB, JSON, the zod gate (400 bad_request);
 *  3. the project, when one is named, found INSIDE the practice (404);
 *  4. header + sections + lines in one transaction (lib/data/api-v1.ts).
 * Answers 201 { id, url }. docs/api/v1.md.
 */
import { apiJson, withApiToken } from "@/lib/api/v1/http";
import { IMPORT_LIMITS, estimateUrl, parseImportPayload, planEstimateImport } from "@/lib/api/v1/estimate-import";
import { createImportedEstimate, findImportProject } from "@/lib/data/api-v1";
import { publicBaseUrl } from "@/lib/payments/pay-link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function badRequest(message: string) {
  return apiJson({ error: "bad_request", message }, 400);
}

export function POST(req: Request) {
  return withApiToken(req, async () => {
    const declared = Number(req.headers.get("content-length") ?? "0");
    if (declared > IMPORT_LIMITS.maxBodyBytes) return badRequest("Body is larger than 1 MB");
    const raw = await req.text();
    if (Buffer.byteLength(raw, "utf8") > IMPORT_LIMITS.maxBodyBytes) return badRequest("Body is larger than 1 MB");

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return badRequest("Body is not valid JSON");
    }
    const parsed = parseImportPayload(body);
    if (!parsed.ok) return badRequest(parsed.message);

    let project = null;
    if (parsed.payload.projectId) {
      project = await findImportProject(parsed.payload.projectId);
      if (!project) return apiJson({ error: "project_not_found" }, 404);
    }

    const id = await createImportedEstimate(planEstimateImport(parsed.payload, project));
    return apiJson({ id, url: estimateUrl(publicBaseUrl(process.env), id) }, 201);
  });
}
