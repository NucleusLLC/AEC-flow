import { getSubmittal, updateSubmittal } from "@/lib/data/ca/submittals";
import { ok, notFound, badRequest, fail } from "@/lib/ca/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const sub = await getSubmittal(id);
    return sub ? ok(sub) : notFound("Submittal not found");
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
    const sub = await updateSubmittal(id, {
      title: body.title as string | undefined,
      description: (body.description as string) ?? undefined,
      submittedBy: (body.submittedBy as string) ?? undefined,
      reviewedBy: (body.reviewedBy as string) ?? undefined,
      discipline: body.discipline as never,
      status: body.status as never,
      dateRequired: (body.dateRequired as string) ?? undefined,
      reviewerComments: (body.reviewerComments as string) ?? undefined,
    });
    return ok(sub);
  } catch (err) {
    return fail(err);
  }
}
