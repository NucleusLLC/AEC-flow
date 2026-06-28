import { updateDevProject } from "@/lib/data/development";
import { ok, badRequest, fail } from "@/lib/development/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
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
