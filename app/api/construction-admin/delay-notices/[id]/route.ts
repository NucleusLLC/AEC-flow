import { getDelayNotice, updateDelayNotice } from "@/lib/data/ca/delay-notices";
import { ok, notFound, badRequest, fail, n } from "@/lib/ca/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const dn = await getDelayNotice(id);
    return dn ? ok(dn) : notFound("Delay notice not found");
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
    const dn = await updateDelayNotice(id, {
      title: body.title as string | undefined,
      description: (body.description as string) ?? undefined,
      cause: (body.cause as string) ?? undefined,
      responsibleParty: (body.responsibleParty as string) ?? undefined,
      claimedDays: body.claimedDays === undefined ? undefined : n(body.claimedDays),
      approvedDays: body.approvedDays === undefined ? undefined : n(body.approvedDays),
      costImpact: body.costImpact === undefined ? undefined : n(body.costImpact),
      status: body.status as never,
      dateStarted: (body.dateStarted as string) ?? undefined,
    });
    return ok(dn);
  } catch (err) {
    return fail(err);
  }
}
