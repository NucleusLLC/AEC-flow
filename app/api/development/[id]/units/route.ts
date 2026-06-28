import { saveUnits } from "@/lib/data/development";
import { ok, badRequest, fail } from "@/lib/development/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  let body: { unitTypes?: unknown };
  try { body = await req.json(); } catch { return badRequest("Invalid JSON body"); }
  if (!Array.isArray(body.unitTypes)) return badRequest("unitTypes[] is required");
  try {
    await saveUnits(id, body.unitTypes as never);
    return ok({ saved: body.unitTypes.length });
  } catch (err) {
    return fail(err);
  }
}
