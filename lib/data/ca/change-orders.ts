/** Change Orders repository (Prisma-first, seed fallback). */
import { prisma } from "@/lib/db";
import { caRead, num, ymd, ymdReq } from "@/lib/data/ca/repo";
import { changeOrderTotal, revisedContractValue } from "@/lib/ca/calc";
import { SEED_CHANGE_ORDERS } from "@/lib/ca/seed-data";
import type { ChangeOrder, ChangeOrderStatus } from "@/lib/ca/types";

export type ChangeOrderInput = {
  projectId: string;
  projectName?: string | null;
  title: string;
  description?: string | null;
  reason?: string | null;
  requestedBy?: string | null;
  contractor?: string | null;
  architect?: string | null;
  engineer?: string | null;
  owner?: string | null;
  status?: ChangeOrderStatus;
  currency?: string;
  costLabor?: number;
  costMaterial?: number;
  costEquipment?: number;
  costSubcontractor?: number;
  overheadPercentage?: number;
  profitPercentage?: number;
  contingencyPercentage?: number;
  vatPercentage?: number;
  scheduleImpactDays?: number;
  originalContractValue?: number;
  approvedChangeOrdersToDate?: number;
  estimateLineItemId?: string | null;
  notes?: string | null;
};

type Row = Awaited<ReturnType<typeof prisma.changeOrder.findFirstOrThrow>>;

function toDto(r: Row): ChangeOrder {
  return {
    id: r.id,
    projectId: r.projectId,
    projectName: r.projectName ?? r.projectId,
    changeOrderNumber: r.changeOrderNumber,
    version: r.version,
    title: r.title,
    description: r.description,
    reason: r.reason,
    requestedBy: r.requestedBy,
    contractor: r.contractorId,
    architect: r.architectId,
    engineer: r.engineerId,
    owner: r.ownerId,
    status: r.status,
    currency: r.currency,
    costLabor: num(r.costLabor),
    costMaterial: num(r.costMaterial),
    costEquipment: num(r.costEquipment),
    costSubcontractor: num(r.costSubcontractor),
    overheadPercentage: num(r.overheadPercentage),
    profitPercentage: num(r.profitPercentage),
    contingencyPercentage: num(r.contingencyPercentage),
    vatPercentage: num(r.vatPercentage),
    totalCost: num(r.totalCost),
    scheduleImpactDays: r.scheduleImpactDays,
    originalContractValue: num(r.originalContractValue),
    approvedChangeOrdersToDate: num(r.approvedChangeOrdersToDate),
    revisedContractValue: num(r.revisedContractValue),
    estimateLineItemId: r.estimateLineItemId,
    dateRequested: ymd(r.dateRequested),
    dateSubmitted: ymd(r.dateSubmitted),
    dateApproved: ymd(r.dateApproved),
    notes: r.notes,
    createdAt: ymdReq(r.createdAt),
    updatedAt: ymdReq(r.updatedAt),
  };
}

/** Computed money + status-driven date fields, shared by create/update. */
function derive(input: ChangeOrderInput, prevStatus?: ChangeOrderStatus) {
  const costs = {
    costLabor: input.costLabor ?? 0,
    costMaterial: input.costMaterial ?? 0,
    costEquipment: input.costEquipment ?? 0,
    costSubcontractor: input.costSubcontractor ?? 0,
    overheadPercentage: input.overheadPercentage ?? 0,
    profitPercentage: input.profitPercentage ?? 0,
    contingencyPercentage: input.contingencyPercentage ?? 0,
    vatPercentage: input.vatPercentage ?? 0,
  };
  const totalCost = changeOrderTotal(costs);
  const original = input.originalContractValue ?? 0;
  const approvedToDate = input.approvedChangeOrdersToDate ?? 0;
  // An approved CO rolls its own total into the revised contract value.
  const approvedTotal = approvedToDate + (input.status === "APPROVED" ? totalCost : 0);
  const now = new Date();
  const becameApproved = input.status === "APPROVED" && prevStatus !== "APPROVED";
  const becameSubmitted = input.status === "SUBMITTED" && prevStatus !== "SUBMITTED";
  return {
    ...costs,
    totalCost,
    revisedContractValue: revisedContractValue(original, approvedTotal),
    dateApproved: becameApproved ? now : undefined,
    dateSubmitted: becameSubmitted ? now : undefined,
  };
}

export async function listChangeOrders(projectId?: string): Promise<ChangeOrder[]> {
  return caRead(
    async () => {
      const rows = await prisma.changeOrder.findMany({
        where: projectId ? { projectId } : undefined,
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toDto);
    },
    () =>
      SEED_CHANGE_ORDERS.filter((c) => !projectId || c.projectId === projectId).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
  );
}

export async function getChangeOrder(id: string): Promise<ChangeOrder | null> {
  return caRead(
    async () => {
      const row = await prisma.changeOrder.findFirst({
        where: { OR: [{ id }, { changeOrderNumber: id }] },
      });
      return row ? toDto(row) : null;
    },
    () => SEED_CHANGE_ORDERS.find((c) => c.id === id || c.changeOrderNumber === id) ?? null,
  );
}

export async function createChangeOrder(input: ChangeOrderInput): Promise<ChangeOrder> {
  const existing = await listChangeOrders(input.projectId);
  const d = derive(input);
  const row = await prisma.changeOrder.create({
    data: {
      projectId: input.projectId,
      projectName: input.projectName ?? null,
      changeOrderNumber: nextChangeOrderNumber(input.projectId, existing.map((c) => c.changeOrderNumber)),
      title: input.title,
      description: input.description ?? null,
      reason: input.reason ?? null,
      requestedBy: input.requestedBy ?? null,
      contractorId: input.contractor ?? null,
      architectId: input.architect ?? null,
      engineerId: input.engineer ?? null,
      ownerId: input.owner ?? null,
      status: input.status ?? "DRAFT",
      currency: input.currency ?? "USD",
      costLabor: d.costLabor,
      costMaterial: d.costMaterial,
      costEquipment: d.costEquipment,
      costSubcontractor: d.costSubcontractor,
      overheadPercentage: d.overheadPercentage,
      profitPercentage: d.profitPercentage,
      contingencyPercentage: d.contingencyPercentage,
      vatPercentage: d.vatPercentage,
      totalCost: d.totalCost,
      scheduleImpactDays: input.scheduleImpactDays ?? 0,
      originalContractValue: input.originalContractValue ?? 0,
      approvedChangeOrdersToDate: input.approvedChangeOrdersToDate ?? 0,
      revisedContractValue: d.revisedContractValue,
      estimateLineItemId: input.estimateLineItemId ?? null,
      dateRequested: new Date(),
      dateSubmitted: d.dateSubmitted ?? null,
      dateApproved: d.dateApproved ?? null,
      notes: input.notes ?? null,
    },
  });
  return toDto(row);
}

export async function updateChangeOrder(
  id: string,
  input: ChangeOrderInput,
): Promise<ChangeOrder> {
  const current = await prisma.changeOrder.findUniqueOrThrow({ where: { id } });
  const d = derive(input, current.status);
  const row = await prisma.changeOrder.update({
    where: { id },
    data: {
      projectId: input.projectId,
      projectName: input.projectName ?? current.projectName,
      title: input.title,
      description: input.description ?? null,
      reason: input.reason ?? null,
      requestedBy: input.requestedBy ?? null,
      contractorId: input.contractor ?? null,
      architectId: input.architect ?? null,
      engineerId: input.engineer ?? null,
      ownerId: input.owner ?? null,
      status: input.status ?? current.status,
      currency: input.currency ?? current.currency,
      costLabor: d.costLabor,
      costMaterial: d.costMaterial,
      costEquipment: d.costEquipment,
      costSubcontractor: d.costSubcontractor,
      overheadPercentage: d.overheadPercentage,
      profitPercentage: d.profitPercentage,
      contingencyPercentage: d.contingencyPercentage,
      vatPercentage: d.vatPercentage,
      totalCost: d.totalCost,
      scheduleImpactDays: input.scheduleImpactDays ?? current.scheduleImpactDays,
      originalContractValue: input.originalContractValue ?? num(current.originalContractValue),
      approvedChangeOrdersToDate:
        input.approvedChangeOrdersToDate ?? num(current.approvedChangeOrdersToDate),
      revisedContractValue: d.revisedContractValue,
      estimateLineItemId: input.estimateLineItemId ?? current.estimateLineItemId,
      dateSubmitted: d.dateSubmitted ?? current.dateSubmitted,
      dateApproved: d.dateApproved ?? current.dateApproved,
      notes: input.notes ?? null,
    },
  });
  return toDto(row);
}

/** Next CO number in the CO-{year}-{projectSuffix}-{NNN} series. */
export function nextChangeOrderNumber(projectId: string, existing: string[], year = 2026): string {
  const suffix = projectId.replace(/[^0-9]/g, "").slice(-3).padStart(3, "0");
  let max = 0;
  for (const n of existing) {
    const m = /(\d+)$/.exec(n);
    if (m && Number(m[1]) > max) max = Number(m[1]);
  }
  return `CO-${year}-${suffix}-${String(max + 1).padStart(3, "0")}`;
}
