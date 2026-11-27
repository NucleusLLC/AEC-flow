import { saveContracts } from "@/lib/data/development";
import { ok, badRequest, fail } from "@/lib/development/api";
import { routeDenied } from "@/lib/server/route-gate";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const denied = await routeDenied("development.finance");
  if (denied) return denied;
  const { id } = await params;
  let body: { contracts?: unknown };
  try { body = await req.json(); } catch { return badRequest("Invalid JSON body"); }
  if (!Array.isArray(body.contracts)) return badRequest("contracts[] is required");
  try {
    await saveContracts(id, body.contracts as never);
    return ok({ saved: body.contracts.length });
  } catch (err) {
    return fail(err);
  }
}
