import { listChangeOrders, createChangeOrder } from "@/lib/data/ca/change-orders";
import { ok, created, badRequest, fail, n } from "@/lib/ca/api";

export async function GET(req: Request) {
  const projectId = new URL(req.url).searchParams.get("projectId") ?? undefined;
  try {
    return ok(await listChangeOrders(projectId));
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
    const co = await createChangeOrder({
      projectId: String(body.projectId),
      projectName: (body.projectName as string) ?? null,
      title: String(body.title),
      description: (body.description as string) ?? null,
      reason: (body.reason as string) ?? null,
      requestedBy: (body.requestedBy as string) ?? null,
      contractor: (body.contractor as string) ?? null,
      architect: (body.architect as string) ?? null,
      engineer: (body.engineer as string) ?? null,
      owner: (body.owner as string) ?? null,
      status: body.status as never,
      currency: (body.currency as string) ?? "USD",
      costLabor: n(body.costLabor),
      costMaterial: n(body.costMaterial),
      costEquipment: n(body.costEquipment),
      costSubcontractor: n(body.costSubcontractor),
      overheadPercentage: n(body.overheadPercentage),
      profitPercentage: n(body.profitPercentage),
      contingencyPercentage: n(body.contingencyPercentage),
      vatPercentage: n(body.vatPercentage),
      scheduleImpactDays: n(body.scheduleImpactDays),
      originalContractValue: n(body.originalContractValue),
      approvedChangeOrdersToDate: n(body.approvedChangeOrdersToDate),
      estimateLineItemId: (body.estimateLineItemId as string) ?? null,
      notes: (body.notes as string) ?? null,
    });
    return created(co);
  } catch (err) {
    return fail(err);
  }
}
