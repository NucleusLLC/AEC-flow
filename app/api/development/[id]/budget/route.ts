import { saveBudget } from "@/lib/data/development";
import { ok, badRequest, fail } from "@/lib/development/api";
import { routeDenied } from "@/lib/server/route-gate";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const denied = await routeDenied("write");
  if (denied) return denied;
  const { id } = await params;
  let body: { lines?: unknown };
  try { body = await req.json(); } catch { return badRequest("Invalid JSON body"); }
  if (!Array.isArray(body.lines)) return badRequest("lines[] is required");
  try {
    await saveBudget(id, body.lines as never);
    return ok({ saved: body.lines.length });
  } catch (err) {
    return fail(err);
  }
}
