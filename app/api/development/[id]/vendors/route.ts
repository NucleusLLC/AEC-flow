import { saveVendors } from "@/lib/data/development";
import { ok, badRequest, fail } from "@/lib/development/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  let body: { vendors?: unknown };
  try { body = await req.json(); } catch { return badRequest("Invalid JSON body"); }
  if (!Array.isArray(body.vendors)) return badRequest("vendors[] is required");
  try {
    await saveVendors(id, body.vendors as never);
    return ok({ saved: body.vendors.length });
  } catch (err) {
    return fail(err);
  }
}
