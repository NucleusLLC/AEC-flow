import { saveInvoices } from "@/lib/data/development";
import { ok, badRequest, fail } from "@/lib/development/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  let body: { invoices?: unknown };
  try { body = await req.json(); } catch { return badRequest("Invalid JSON body"); }
  if (!Array.isArray(body.invoices)) return badRequest("invoices[] is required");
  try {
    await saveInvoices(id, body.invoices as never);
    return ok({ saved: body.invoices.length });
  } catch (err) {
    return fail(err);
  }
}
