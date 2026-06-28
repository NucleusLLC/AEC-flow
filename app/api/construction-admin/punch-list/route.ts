import { listPunchItems, createPunchItem } from "@/lib/data/ca/punch-list";
import { ok, created, badRequest, fail } from "@/lib/ca/api";

export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get("projectId") ?? undefined;
  try {
    return ok(await listPunchItems(projectId));
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
  if (!body.projectId || !body.description) {
    return badRequest("projectId and description are required");
  }
  try {
    const item = await createPunchItem({
      projectId: String(body.projectId),
      projectName: (body.projectName as string) ?? null,
      description: String(body.description),
      location: (body.location as string) ?? null,
      trade: (body.trade as string) ?? null,
      responsibleParty: (body.responsibleParty as string) ?? null,
      priority: body.priority as never,
      status: body.status as never,
      dueDate: (body.dueDate as string) ?? null,
      notes: (body.notes as string) ?? null,
    });
    return created(item);
  } catch (err) {
    return fail(err);
  }
}
