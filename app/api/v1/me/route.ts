/**
 * GET /api/v1/me — which practice a connected-app token belongs to. The add-in
 * calls it to test a pasted token and to show "Connected to <practice>".
 * PUBLIC in proxy.ts: the Bearer token is the authentication. docs/api/v1.md.
 */
import { apiJson, withApiToken } from "@/lib/api/v1/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(req: Request) {
  return withApiToken(req, async (auth) =>
    apiJson({ company: { id: auth.companyId, name: auth.companyName }, token: { name: auth.tokenName } }),
  );
}
