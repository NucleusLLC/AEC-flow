/**
 * GET /api/v1/projects — the practice's projects (not archived), newest first,
 * for the add-in's "send to project" picker. PUBLIC in proxy.ts: the Bearer
 * token is the authentication; the list is scoped to the token's practice by
 * runAsCompany (lib/api/v1/http.ts). docs/api/v1.md.
 */
import { apiJson, withApiToken } from "@/lib/api/v1/http";
import { listApiProjects } from "@/lib/data/api-v1";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(req: Request) {
  return withApiToken(req, async () => apiJson({ projects: await listApiProjects() }));
}
