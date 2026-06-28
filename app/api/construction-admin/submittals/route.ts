import { listSubmittals, createSubmittal } from "@/lib/data/ca/submittals";
import { ok, created, badRequest, fail } from "@/lib/ca/api";

export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get("projectId") ?? undefined;
  try {
    return ok(await listSubmittals(projectId));
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  if (!body.projectId || !body.title) return badRequest("projectId and title are required");
  try {
    const sub = await createSubmittal({
      projectId: String(body.projectId),
      projectName: (body.projectName as string) ?? null,
      title: String(body.title),
      description: (body.description as string) ?? null,
      submittedBy: (body.submittedBy as string) ?? null,
      reviewedBy: (body.reviewedBy as string) ?? null,
      discipline: body.discipline as never,
      status: body.status as never,
      dateRequired: (body.dateRequired as string) ?? null,
    });
    return created(sub);
  } catch (err) {
    return fail(err);
  }
}
