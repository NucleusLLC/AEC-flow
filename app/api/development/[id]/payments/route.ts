import { savePayments } from "@/lib/data/development";
import { ok, badRequest, fail } from "@/lib/development/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  let body: { payments?: unknown };
  try { body = await req.json(); } catch { return badRequest("Invalid JSON body"); }
  if (!Array.isArray(body.payments)) return badRequest("payments[] is required");
  try {
    await savePayments(id, body.payments as never);
    return ok({ saved: body.payments.length });
  } catch (err) {
    return fail(err);
  }
}
