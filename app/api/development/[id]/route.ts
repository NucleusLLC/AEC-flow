import { updateDevProject } from "@/lib/data/development";
import { ok, badRequest, fail } from "@/lib/development/api";
import { routeDenied } from "@/lib/server/route-gate";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await routeDenied("write");
  if (denied) return denied;
  const { id } = await params;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return badRequest("Invalid JSON body"); }
  try {
    await updateDevProject(id, body as never);
    return ok({ saved: true });
  } catch (err) {
    return fail(err);
  }
}
