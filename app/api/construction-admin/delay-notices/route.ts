import { listDelayNotices, createDelayNotice } from "@/lib/data/ca/delay-notices";
import { ok, created, badRequest, fail, n } from "@/lib/ca/api";

export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get("projectId") ?? undefined;
  try {
    return ok(await listDelayNotices(projectId));
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
    const dn = await createDelayNotice({
      projectId: String(body.projectId),
      projectName: (body.projectName as string) ?? null,
      title: String(body.title),
      description: (body.description as string) ?? null,
      cause: (body.cause as string) ?? null,
      responsibleParty: (body.responsibleParty as string) ?? null,
      claimedDays: n(body.claimedDays),
      costImpact: n(body.costImpact),
      status: body.status as never,
      dateStarted: (body.dateStarted as string) ?? null,
    });
    return created(dn);
  } catch (err) {
    return fail(err);
  }
}
