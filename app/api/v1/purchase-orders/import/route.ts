/**
 * POST /api/v1/purchase-orders/import — a connected app (M.E.P.flow, W&Dflow)
 * sends a material take-off; it becomes ONE new DRAFT purchase order in the
 * token's practice (Procurement), quantities only (every unit price 0, the
 * supplier "To be assigned").
 *
 * The sibling of /api/v1/estimates/import, with the SAME body, limits and
 * errors. PUBLIC in proxy.ts (the whole /api/v1/ prefix): the Bearer token is
 * the authentication. Order of work:
 *  1. the token (401 / 403) — before the body is even read;
 *  2. the body: at most 1 MB, JSON, the estimates-import zod gate (400 bad_request);
 *  3. the project, when one is named, found INSIDE the practice (404);
 *  4. the PO number + the row, in one transaction (lib/data/api-v1.ts).
 * Answers 201 { id, poNumber, url }. docs/api/v1.md.
 */
import { apiJson, withApiToken } from "@/lib/api/v1/http";
import { IMPORT_LIMITS, parseImportPayload } from "@/lib/api/v1/estimate-import";
import { planPoImport, purchaseOrderUrl } from "@/lib/api/v1/po-import";
import { createImportedPurchaseOrder, findImportProject } from "@/lib/data/api-v1";
import { publicBaseUrl } from "@/lib/payments/pay-link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function badRequest(message: string) {
  return apiJson({ error: "bad_request", message }, 400);
}

export function POST(req: Request) {
  return withApiToken(req, async (auth) => {
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

    const po = await createImportedPurchaseOrder(planPoImport(parsed.payload, project, auth.tokenName));
    return apiJson({ id: po.id, poNumber: po.poNumber, url: purchaseOrderUrl(publicBaseUrl(process.env), po.id) }, 201);
  });
}
