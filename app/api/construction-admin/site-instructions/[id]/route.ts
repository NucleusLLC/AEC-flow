import { getSiteInstruction, updateSiteInstruction } from "@/lib/data/ca/site-instructions";
import { ok, notFound, badRequest, fail } from "@/lib/ca/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const si = await getSiteInstruction(id);
    return si ? ok(si) : notFound("Site instruction not found");
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
    const si = await updateSiteInstruction(id, {
      title: body.title as string | undefined,
      description: (body.description as string) ?? undefined,
      issuedBy: (body.issuedBy as string) ?? undefined,
      issuedTo: (body.issuedTo as string) ?? undefined,
      discipline: body.discipline as never,
      costImpact: body.costImpact as never,
      scheduleImpact: body.scheduleImpact as never,
      status: body.status as never,
      linkedChangeOrderId: (body.linkedChangeOrderId as string) ?? undefined,
    });
    return ok(si);
  } catch (err) {
    return fail(err);
  }
}
