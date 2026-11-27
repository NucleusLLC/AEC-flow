import { saveLandAndAcquisition } from "@/lib/data/development";
import { ok, badRequest, fail } from "@/lib/development/api";
import { routeDenied } from "@/lib/server/route-gate";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const denied = await routeDenied("write");
  if (denied) return denied;
  const { id } = await params;
  let body: { landUse?: unknown; acquisition?: unknown };
  try { body = await req.json(); } catch { return badRequest("Invalid JSON body"); }
  if (!body.landUse || !body.acquisition) return badRequest("landUse and acquisition are required");
  try {
    await saveLandAndAcquisition(id, body.landUse as never, body.acquisition as never);
    return ok({ saved: true });
  } catch (err) {
    return fail(err);
  }
}
