import { saveReservations } from "@/lib/data/development";
import { ok, badRequest, fail } from "@/lib/development/api";
import { routeDenied } from "@/lib/server/route-gate";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const denied = await routeDenied("development.finance");
  if (denied) return denied;
  const { id } = await params;
  let body: { reservations?: unknown };
  try { body = await req.json(); } catch { return badRequest("Invalid JSON body"); }
  if (!Array.isArray(body.reservations)) return badRequest("reservations[] is required");
  try {
    await saveReservations(id, body.reservations as never);
    return ok({ saved: body.reservations.length });
  } catch (err) {
    return fail(err);
  }
}
