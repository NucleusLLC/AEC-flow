import { getPunchItem, updatePunchItem } from "@/lib/data/ca/punch-list";
import { ok, notFound, badRequest, fail } from "@/lib/ca/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const item = await getPunchItem(id);
    return item ? ok(item) : notFound("Punch item not found");
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  try {
    const item = await updatePunchItem(id, {
      description: body.description as string | undefined,
      location: (body.location as string) ?? undefined,
      trade: (body.trade as string) ?? undefined,
      responsibleParty: (body.responsibleParty as string) ?? undefined,
      priority: body.priority as never,
      status: body.status as never,
      dueDate: (body.dueDate as string) ?? undefined,
      verifiedBy: (body.verifiedBy as string) ?? undefined,
      notes: (body.notes as string) ?? undefined,
    });
    return ok(item);
  } catch (err) {
    return fail(err);
  }
}
