import { listSiteInstructions, createSiteInstruction } from "@/lib/data/ca/site-instructions";
import { ok, created, badRequest, fail } from "@/lib/ca/api";

export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get("projectId") ?? undefined;
  try {
    return ok(await listSiteInstructions(projectId));
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
    const si = await createSiteInstruction({
      projectId: String(body.projectId),
      projectName: (body.projectName as string) ?? null,
      title: String(body.title),
      description: (body.description as string) ?? null,
      issuedBy: (body.issuedBy as string) ?? null,
      issuedTo: (body.issuedTo as string) ?? null,
      discipline: body.discipline as never,
      costImpact: body.costImpact as never,
      scheduleImpact: body.scheduleImpact as never,
      status: body.status as never,
      linkedChangeOrderId: (body.linkedChangeOrderId as string) ?? null,
    });
    return created(si);
  } catch (err) {
    return fail(err);
  }
}
