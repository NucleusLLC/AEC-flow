import { saveLots } from "@/lib/data/development";
import { ok, badRequest, fail } from "@/lib/development/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  let body: { lots?: unknown };
  try { body = await req.json(); } catch { return badRequest("Invalid JSON body"); }
  if (!Array.isArray(body.lots)) return badRequest("lots[] is required");
  try {
    await saveLots(id, body.lots as never);
    return ok({ saved: body.lots.length });
  } catch (err) {
    return fail(err);
  }
}
