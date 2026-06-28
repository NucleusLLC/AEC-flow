import { saveCashFlow } from "@/lib/data/development";
import { ok, badRequest, fail } from "@/lib/development/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  let body: { months?: unknown };
  try { body = await req.json(); } catch { return badRequest("Invalid JSON body"); }
  if (!Array.isArray(body.months)) return badRequest("months[] is required");
  try {
    await saveCashFlow(id, body.months as never);
    return ok({ saved: body.months.length });
  } catch (err) {
    return fail(err);
  }
}
