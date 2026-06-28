import { prisma } from "@/lib/db";
import { getChangeOrder, updateChangeOrder } from "@/lib/data/ca/change-orders";
import { ok, notFound, badRequest, fail, n } from "@/lib/ca/api";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    const co = await getChangeOrder(id);
    return co ? ok(co) : notFound("Change order not found");
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
    const co = await updateChangeOrder(id, {
      projectId: String(body.projectId ?? ""),
      projectName: (body.projectName as string) ?? null,
      title: String(body.title ?? ""),
      description: (body.description as string) ?? null,
      reason: (body.reason as string) ?? null,
      requestedBy: (body.requestedBy as string) ?? null,
      contractor: (body.contractor as string) ?? null,
      architect: (body.architect as string) ?? null,
      engineer: (body.engineer as string) ?? null,
      owner: (body.owner as string) ?? null,
      status: body.status as never,
      currency: (body.currency as string) ?? undefined,
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
    return ok(co);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    await prisma.changeOrder.delete({ where: { id } });
    return ok({ id, deleted: true });
  } catch (err) {
    return fail(err);
  }
}
