import { getRfi, updateRfi } from "@/lib/data/ca/rfis";
import { ok, notFound, badRequest, fail } from "@/lib/ca/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const rfi = await getRfi(id);
    return rfi ? ok(rfi) : notFound("RFI not found");
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
    const rfi = await updateRfi(id, {
      subject: body.subject as string | undefined,
      question: (body.question as string) ?? undefined,
      assignedTo: (body.assignedTo as string) ?? undefined,
      discipline: body.discipline as never,
      priority: body.priority as never,
      status: body.status as never,
      response: (body.response as string) ?? undefined,
      responseBy: (body.responseBy as string) ?? undefined,
      dateRequired: (body.dateRequired as string) ?? undefined,
      linkedChangeOrderId: (body.linkedChangeOrderId as string) ?? undefined,
    });
    return ok(rfi);
  } catch (err) {
    return fail(err);
  }
}
