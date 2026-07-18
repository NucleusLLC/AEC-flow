/**
 * Procurement (Purchase Orders) data-access. SERVER-ONLY.
 *
 * Additive and self-contained — it never touches the protected Estimates or
 * Schedule systems. PurchaseOrder is tenant-scoped by the Prisma extension in
 * lib/db.ts (companyId injected on write, filtered on read), so every function
 * here operates within the current company automatically.
 */
import "server-only";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { poTotals } from "@/lib/procurement/calc";
import type {
  PurchaseOrderDTO,
  PurchaseOrderInput,
  PurchaseOrderLine,
  PurchaseOrderStatus,
} from "@/lib/procurement/types";
import { PO_OPEN_STATUSES } from "@/lib/procurement/types";
import type { Prisma } from "@prisma/client";

type Row = Awaited<ReturnType<typeof prisma.purchaseOrder.findFirstOrThrow>>;

function num(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(v);
}

function ymd(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** Parse the JSON line-items column into a typed, sanitized array. */
function parseLines(raw: unknown): PurchaseOrderLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((l) => {
    const o = (l ?? {}) as Record<string, unknown>;
    return {
      description: typeof o.description === "string" ? o.description : "",
      quantity: Number(o.quantity) || 0,
      unit: typeof o.unit === "string" ? o.unit : "",
      unitPrice: Number(o.unitPrice) || 0,
    };
  });
}

/** Sanitize incoming lines and drop empty rows (no description and no amount). */
function cleanLines(lines: PurchaseOrderLine[]): PurchaseOrderLine[] {
  return (lines ?? [])
    .map((l) => ({
      description: (l.description ?? "").trim(),
      quantity: Number(l.quantity) || 0,
      unit: (l.unit ?? "").trim(),
      unitPrice: Number(l.unitPrice) || 0,
    }))
    .filter((l) => l.description !== "" || l.quantity !== 0 || l.unitPrice !== 0);
}

function toDto(r: Row): PurchaseOrderDTO {
  return {
    id: r.id,
    poNumber: r.poNumber,
    projectId: r.projectId,
    projectName: r.projectName,
    vendorName: r.vendorName,
    vendorContact: r.vendorContact,
    vendorEmail: r.vendorEmail,
    status: r.status,
    currency: r.currency,
    lineItems: parseLines(r.lineItems),
    subtotal: num(r.subtotal),
    taxPercentage: num(r.taxPercentage),
    shipping: num(r.shipping),
    total: num(r.total),
    orderDate: ymd(r.orderDate),
    expectedDate: ymd(r.expectedDate),
    receivedDate: ymd(r.receivedDate),
    terms: r.terms,
    notes: r.notes,
    createdByName: r.createdByName,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function listPurchaseOrders(): Promise<PurchaseOrderDTO[]> {
  const rows = await prisma.purchaseOrder.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(toDto);
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrderDTO | null> {
  const row = await prisma.purchaseOrder.findFirst({ where: { OR: [{ id }, { poNumber: id }] } });
  return row ? toDto(row) : null;
}

/** Next PO number in the PO-{year}-{NNN} series, sequential within the company. */
export function nextPoNumber(existing: string[], year: number): string {
  let max = 0;
  for (const p of existing) {
    const m = /(\d+)\s*$/.exec(p);
    if (m && Number(m[1]) > max) max = Number(m[1]);
  }
  return `PO-${year}-${String(max + 1).padStart(3, "0")}`;
}

function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createPurchaseOrder(input: PurchaseOrderInput): Promise<PurchaseOrderDTO> {
  const session = await getServerSession(authOptions);
  const existing = await listPurchaseOrders();
  const lines = cleanLines(input.lineItems);
  const totals = poTotals({
    lineItems: lines,
    taxPercentage: input.taxPercentage,
    shipping: input.shipping,
  });
  const row = await prisma.purchaseOrder.create({
    data: {
      poNumber: nextPoNumber(existing.map((p) => p.poNumber), new Date().getFullYear()),
      projectId: input.projectId ?? null,
      projectName: input.projectName ?? null,
      vendorName: input.vendorName.trim(),
      vendorContact: input.vendorContact ?? null,
      vendorEmail: input.vendorEmail ?? null,
      status: input.status ?? "DRAFT",
      currency: input.currency ?? "USD",
      lineItems: lines as unknown as Prisma.InputJsonValue,
      subtotal: totals.subtotal,
      taxPercentage: input.taxPercentage ?? 0,
      shipping: totals.shipping,
      total: totals.total,
      orderDate: toDate(input.orderDate),
      expectedDate: toDate(input.expectedDate),
      receivedDate: toDate(input.receivedDate),
      terms: input.terms ?? null,
      notes: input.notes ?? null,
      createdById: session?.user?.id ?? null,
      createdByName: session?.user?.name ?? null,
    },
  });
  return toDto(row);
}

export async function updatePurchaseOrder(
  id: string,
  input: PurchaseOrderInput,
): Promise<PurchaseOrderDTO> {
  const lines = cleanLines(input.lineItems);
  const totals = poTotals({
    lineItems: lines,
    taxPercentage: input.taxPercentage,
    shipping: input.shipping,
  });
  const row = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      projectId: input.projectId ?? null,
      projectName: input.projectName ?? null,
      vendorName: input.vendorName.trim(),
      vendorContact: input.vendorContact ?? null,
      vendorEmail: input.vendorEmail ?? null,
      status: input.status,
      currency: input.currency,
      lineItems: lines as unknown as Prisma.InputJsonValue,
      subtotal: totals.subtotal,
      taxPercentage: input.taxPercentage ?? 0,
      shipping: totals.shipping,
      total: totals.total,
      orderDate: toDate(input.orderDate),
      expectedDate: toDate(input.expectedDate),
      receivedDate: toDate(input.receivedDate),
      terms: input.terms ?? null,
      notes: input.notes ?? null,
    },
  });
  return toDto(row);
}

export async function deletePurchaseOrder(id: string): Promise<void> {
  await prisma.purchaseOrder.deleteMany({ where: { id } });
}

export interface ProcurementSummary {
  total: number;
  open: number;
  openValue: number;
  receivedValue: number;
  currency: string;
  byStatus: Record<PurchaseOrderStatus, number>;
}

export async function procurementSummary(): Promise<ProcurementSummary> {
  const orders = await listPurchaseOrders();
  const byStatus = {
    DRAFT: 0,
    ISSUED: 0,
    PARTIAL: 0,
    RECEIVED: 0,
    CLOSED: 0,
    CANCELLED: 0,
  } as Record<PurchaseOrderStatus, number>;
  let openValue = 0;
  let receivedValue = 0;
  for (const o of orders) {
    byStatus[o.status] += 1;
    if (PO_OPEN_STATUSES.includes(o.status)) openValue += o.total;
    if (o.status === "RECEIVED" || o.status === "CLOSED") receivedValue += o.total;
  }
  const open = byStatus.DRAFT + byStatus.ISSUED + byStatus.PARTIAL;
  return {
    total: orders.length,
    open,
    openValue: Math.round(openValue * 100) / 100,
    receivedValue: Math.round(receivedValue * 100) / 100,
    currency: orders[0]?.currency ?? "USD",
    byStatus,
  };
}
