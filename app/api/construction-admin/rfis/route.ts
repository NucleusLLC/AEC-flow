import { listRfis, createRfi } from "@/lib/data/ca/rfis";
import { ok, created, badRequest, fail } from "@/lib/ca/api";

export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get("projectId") ?? undefined;
  try {
    return ok(await listRfis(projectId));
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
  if (!body.projectId || !body.subject) return badRequest("projectId and subject are required");
  try {
    const rfi = await createRfi({
      projectId: String(body.projectId),
      projectName: (body.projectName as string) ?? null,
      subject: String(body.subject),
      question: (body.question as string) ?? null,
      submittedBy: (body.submittedBy as string) ?? null,
      assignedTo: (body.assignedTo as string) ?? null,
      discipline: body.discipline as never,
      priority: body.priority as never,
      dateRequired: (body.dateRequired as string) ?? null,
      linkedChangeOrderId: (body.linkedChangeOrderId as string) ?? null,
    });
    return created(rfi);
  } catch (err) {
    return fail(err);
  }
}
