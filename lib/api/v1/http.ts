/**
 * The shared shell of every /api/v1 route: JSON out, never cached, the token
 * checked first, and the work run inside the token's practice.
 *
 * SERVER-ONLY. No CORS: the callers are desktop add-ins, not browsers, and a
 * browser on another origin has no business reading a practice's data.
 */
import { NextResponse } from "next/server";
import { authenticateApiToken, type ApiAuth } from "@/lib/server/api-token";
import { runAsCompany } from "@/lib/server/request-company";

const NO_STORE = { "Cache-Control": "no-store" };

export function apiJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/**
 * Authenticate, then run `fn` with every tenant-scoped query limited to the
 * token's company. 401 / 403 come back before `fn` is ever called; an
 * unexpected failure inside it is a 500 with no detail.
 */
export async function withApiToken(
  req: Request,
  fn: (auth: ApiAuth) => Promise<NextResponse>,
): Promise<NextResponse> {
  let auth;
  try {
    auth = await authenticateApiToken(req);
  } catch (e) {
    console.error("[api/v1] token lookup failed", e instanceof Error ? e.message : e);
    return apiJson({ error: "server_error" }, 500);
  }
  if (!auth.ok) return apiJson({ error: auth.error }, auth.status);
  const ok = auth;
  try {
    return await runAsCompany(ok.companyId, () => fn(ok));
  } catch (e) {
    console.error("[api/v1] request failed", e instanceof Error ? e.message : e);
    return apiJson({ error: "server_error" }, 500);
  }
}
