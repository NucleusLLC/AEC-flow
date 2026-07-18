/**
 * Material selections (finish schedule) data-access. SERVER-ONLY.
 *
 * Additive and self-contained — never touches the protected Estimates or
 * Schedule systems. MaterialSelection is tenant-scoped by the Prisma extension
 * in lib/db.ts, so every function here operates within the current company.
 */
import "server-only";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { materialTotal } from "@/lib/materials/calc";
import type {
  MaterialSelectionDTO,
  MaterialSelectionInput,
  MaterialSelectionStatus,
} from "@/lib/materials/types";
import type { Prisma } from "@prisma/client";

type Row = Awaited<ReturnType<typeof prisma.materialSelection.findFirstOrThrow>>;

function num(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

function ymd(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDto(r: Row): MaterialSelectionDTO {
  return {
    id: r.id,
    tag: r.tag,
    projectId: r.projectId,
    projectName: r.projectName,
    category: r.category,
    location: r.location,
    productName: r.productName,
    manufacturer: r.manufacturer,
    modelNumber: r.modelNumber,
    finish: r.finish,
    specification: r.specification,
    status: r.status,
    currency: r.currency,
    quantity: num(r.quantity),
    unit: r.unit,
    unitCost: num(r.unitCost),
    totalCost: num(r.totalCost),
    supplier: r.supplier,
    purchaseOrderId: r.purchaseOrderId,
    approvedBy: r.approvedBy,
    selectedDate: ymd(r.selectedDate),
    notes: r.notes,
    createdByName: r.createdByName,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function listMaterialSelections(projectId?: string): Promise<MaterialSelectionDTO[]> {
  const rows = await prisma.materialSelection.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: [{ category: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(toDto);
}

export async function getMaterialSelection(id: string): Promise<MaterialSelectionDTO | null> {
  const row = await prisma.materialSelection.findFirst({ where: { OR: [{ id }, { tag: id }] } });
  return row ? toDto(row) : null;
}

/** Next tag in the MS-{year}-{NNN} series, sequential within the company. */
export function nextTag(existing: string[], year: number): string {
  let max = 0;
  for (const t of existing) {
    const m = /(\d+)\s*$/.exec(t);
    if (m && Number(m[1]) > max) max = Number(m[1]);
  }
  return `MS-${year}-${String(max + 1).padStart(3, "0")}`;
}

export async function createMaterialSelection(
  input: MaterialSelectionInput,
): Promise<MaterialSelectionDTO> {
  const session = await getServerSession(authOptions);
  const existing = await listMaterialSelections();
  const totalCost = materialTotal({ quantity: input.quantity, unitCost: input.unitCost });
  const row = await prisma.materialSelection.create({
    data: {
      tag: nextTag(existing.map((m) => m.tag), new Date().getFullYear()),
      projectId: input.projectId ?? null,
      projectName: input.projectName ?? null,
      category: input.category.trim(),
      location: input.location ?? null,
      productName: input.productName.trim(),
      manufacturer: input.manufacturer ?? null,
      modelNumber: input.modelNumber ?? null,
      finish: input.finish ?? null,
      specification: input.specification ?? null,
      status: input.status ?? "PROPOSED",
      currency: input.currency ?? "USD",
      quantity: input.quantity ?? 0,
      unit: input.unit ?? null,
      unitCost: input.unitCost ?? 0,
      totalCost,
      supplier: input.supplier ?? null,
      purchaseOrderId: input.purchaseOrderId ?? null,
      approvedBy: input.approvedBy ?? null,
      selectedDate: toDate(input.selectedDate),
      notes: input.notes ?? null,
      createdById: session?.user?.id ?? null,
      createdByName: session?.user?.name ?? null,
    },
  });
  return toDto(row);
}

export async function updateMaterialSelection(
  id: string,
  input: MaterialSelectionInput,
): Promise<MaterialSelectionDTO> {
  const totalCost = materialTotal({ quantity: input.quantity, unitCost: input.unitCost });
  const row = await prisma.materialSelection.update({
    where: { id },
    data: {
      projectId: input.projectId ?? null,
      projectName: input.projectName ?? null,
      category: input.category.trim(),
      location: input.location ?? null,
      productName: input.productName.trim(),
      manufacturer: input.manufacturer ?? null,
      modelNumber: input.modelNumber ?? null,
      finish: input.finish ?? null,
      specification: input.specification ?? null,
      status: input.status,
      currency: input.currency,
      quantity: input.quantity ?? 0,
      unit: input.unit ?? null,
      unitCost: input.unitCost ?? 0,
      totalCost,
      supplier: input.supplier ?? null,
      purchaseOrderId: input.purchaseOrderId ?? null,
      approvedBy: input.approvedBy ?? null,
      selectedDate: toDate(input.selectedDate),
      notes: input.notes ?? null,
    },
  });
  return toDto(row);
}

export async function deleteMaterialSelection(id: string): Promise<void> {
  await prisma.materialSelection.deleteMany({ where: { id } });
}

export interface MaterialsSummary {
  total: number;
  pending: number;
  approved: number;
  selectedValue: number;
  currency: string;
  byStatus: Record<MaterialSelectionStatus, number>;
}

export async function materialsSummary(): Promise<MaterialsSummary> {
  const items = await listMaterialSelections();
  const byStatus = {
    PROPOSED: 0,
    SUBMITTED: 0,
    APPROVED: 0,
    REJECTED: 0,
    ORDERED: 0,
    INSTALLED: 0,
  } as Record<MaterialSelectionStatus, number>;
  let selectedValue = 0;
  for (const m of items) {
    byStatus[m.status] += 1;
    if (m.status !== "REJECTED") selectedValue += m.totalCost;
  }
  return {
    total: items.length,
    pending: byStatus.PROPOSED + byStatus.SUBMITTED,
    approved: byStatus.APPROVED + byStatus.ORDERED + byStatus.INSTALLED,
    selectedValue: Math.round(selectedValue * 100) / 100,
    currency: items[0]?.currency ?? "USD",
    byStatus,
  };
}
