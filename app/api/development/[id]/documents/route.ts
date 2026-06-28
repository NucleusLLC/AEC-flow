import { saveDocuments } from "@/lib/data/development";
import { ok, badRequest, fail } from "@/lib/development/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  let body: { documents?: unknown };
  try { body = await req.json(); } catch { return badRequest("Invalid JSON body"); }
  if (!Array.isArray(body.documents)) return badRequest("documents[] is required");
  try {
    await saveDocuments(id, body.documents as never);
    return ok({ saved: body.documents.length });
  } catch (err) {
    return fail(err);
  }
}
