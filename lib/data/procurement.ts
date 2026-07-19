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
import { poTotals, receiptProgress } from "@/lib/procurement/calc";
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
      receivedQty: Number(o.receivedQty) || 0,
    };
  });
}

/** Sanitize incoming lines and drop empty rows (no description and no amount).
 *  Preserves receivedQty (receiving workflow) so form edits don't wipe receipts,
 *  clamped to the ordered quantity. */
function cleanLines(lines: PurchaseOrderLine[]): PurchaseOrderLine[] {
  return (lines ?? [])
    .map((l) => {
      const quantity = Number(l.quantity) || 0;
      const receivedQty = Math.max(0, Math.min(Number(l.receivedQty) || 0, quantity));
      return {
        description: (l.description ?? "").trim(),
        quantity,
        unit: (l.unit ?? "").trim(),
        unitPrice: Number(l.unitPrice) || 0,
        receivedQty,
      };
    })
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

export interface PoFromSelectionsInput {
  selectionIds: string[];
  vendorName: string;
  vendorContact?: string | null;
  vendorEmail?: string | null;
}

/**
 * Bridge: turn approved material selections into a draft purchase order.
 * Each selection becomes a PO line; the selections are linked to the new PO
 * and marked ORDERED. Only selections that aren't already on a PO are used
 * (re-read here so the client can't order the same item twice). Both reads and
 * writes are tenant-scoped by the Prisma extension.
 */
export async function createPurchaseOrderFromSelections(
  input: PoFromSelectionsInput,
): Promise<{ po: PurchaseOrderDTO; linked: number }> {
  const session = await getServerSession(authOptions);
  const sels = await prisma.materialSelection.findMany({
    where: { id: { in: input.selectionIds }, purchaseOrderId: null },
  });
  if (sels.length === 0) {
    throw new Error("No orderable selections found — they may already be on a purchase order.");
  }
  const lines: PurchaseOrderLine[] = sels.map((s) => ({
    description: [s.productName, s.manufacturer, s.modelNumber, s.finish].filter(Boolean).join(" · "),
    quantity: Number(s.quantity) || 0,
    unit: s.unit ?? "",
    unitPrice: Number(s.unitCost) || 0,
  }));
  const totals = poTotals({ lineItems: lines, taxPercentage: 0, shipping: 0 });
  const existing = await listPurchaseOrders();
  // Carry the project through only if every selection shares one.
  const firstProject = sels[0].projectId;
  const sameProject = sels.every((s) => s.projectId === firstProject);
  const row = await prisma.purchaseOrder.create({
    data: {
      poNumber: nextPoNumber(existing.map((p) => p.poNumber), new Date().getFullYear()),
      projectId: sameProject ? firstProject : null,
      projectName: sameProject ? sels[0].projectName : null,
      vendorName: input.vendorName.trim(),
      vendorContact: input.vendorContact ?? null,
      vendorEmail: input.vendorEmail ?? null,
      status: "DRAFT",
      currency: sels[0].currency ?? "USD",
      lineItems: lines as unknown as Prisma.InputJsonValue,
      subtotal: totals.subtotal,
      taxPercentage: 0,
      shipping: 0,
      total: totals.total,
      createdById: session?.user?.id ?? null,
      createdByName: session?.user?.name ?? null,
    },
  });
  const linked = await prisma.materialSelection.updateMany({
    where: { id: { in: sels.map((s) => s.id) } },
    data: { purchaseOrderId: row.id, status: "ORDERED" },
  });
  return { po: toDto(row), linked: linked.count };
}

/**
 * Record a receipt against a purchase order. `receivedQtys` aligns to the PO's
 * line order; each is clamped to that line's ordered quantity. Status is
 * derived — RECEIVED when every line is fully received, PARTIAL when some is —
 * without overriding a CANCELLED or CLOSED order. receivedDate is stamped once
 * the order is fully received.
 */
export async function recordReceipt(
  id: string,
  receivedQtys: number[],
): Promise<PurchaseOrderDTO> {
  const po = await prisma.purchaseOrder.findFirstOrThrow({ where: { id } });
  const lines = parseLines(po.lineItems).map((l, i) => {
    const next = receivedQtys[i] ?? l.receivedQty ?? 0;
    return { ...l, receivedQty: Math.max(0, Math.min(Number(next) || 0, l.quantity)) };
  });
  const prog = receiptProgress(lines);

  const locked = po.status === "CANCELLED" || po.status === "CLOSED";
  const status: PurchaseOrderStatus = locked
    ? po.status
    : prog.fullyReceived
      ? "RECEIVED"
      : prog.anyReceived
        ? "PARTIAL"
        : po.status;
  const receivedDate = prog.fullyReceived ? (po.receivedDate ?? new Date()) : po.receivedDate;

  const row = await prisma.purchaseOrder.update({
    where: { id },
    data: { lineItems: lines as unknown as Prisma.InputJsonValue, status, receivedDate },
  });
  return toDto(row);
}
