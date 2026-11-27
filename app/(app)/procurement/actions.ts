"use server";

import { revalidatePath } from "next/cache";
import {
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  createPurchaseOrderFromSelections,
  recordReceipt,
} from "@/lib/data/procurement";
import type { PurchaseOrderInput } from "@/lib/procurement/types";
import { permissionDenied, requirePermission } from "@/lib/server/actor";

export type SaveResult =
  | { ok: true; id: string; poNumber: string }
  | { ok: false; error: string };

function validate(input: PurchaseOrderInput): string | null {
  if (!input.vendorName || !input.vendorName.trim()) return "Enter a supplier / vendor name.";
  const hasLine = (input.lineItems ?? []).some(
    (l) => (l.description ?? "").trim() !== "" || Number(l.quantity) !== 0 || Number(l.unitPrice) !== 0,
  );
  if (!hasLine) return "Add at least one line item.";
  return null;
}

export async function createPurchaseOrderAction(input: PurchaseOrderInput): Promise<SaveResult> {
  const denied = await permissionDenied("write");
  if (denied) return { ok: false, error: denied };
  const err = validate(input);
  if (err) return { ok: false, error: err };
  try {
    const po = await createPurchaseOrder(input);
    revalidatePath("/procurement");
    return { ok: true, id: po.id, poNumber: po.poNumber };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create purchase order." };
  }
}

export async function updatePurchaseOrderAction(
  id: string,
  input: PurchaseOrderInput,
): Promise<SaveResult> {
  const denied = await permissionDenied("write");
  if (denied) return { ok: false, error: denied };
  const err = validate(input);
  if (err) return { ok: false, error: err };
  try {
    const po = await updatePurchaseOrder(id, input);
    revalidatePath("/procurement");
    revalidatePath(`/procurement/${id}`);
    return { ok: true, id: po.id, poNumber: po.poNumber };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update purchase order." };
  }
}

/**
 * Deleting a purchase order and recording a receipt are for an administrator, a
 * director or the founder (security audit D-6); this one throws the refusal,
 * like any other failure here, because its callers expect `{ ok: true }` or a throw.
 */
export async function deletePurchaseOrderAction(id: string): Promise<{ ok: true }> {
  await requirePermission("purchaseOrder.delete");
  await deletePurchaseOrder(id);
  revalidatePath("/procurement");
  return { ok: true };
}

export async function receivePurchaseOrderAction(
  id: string,
  receivedQtys: number[],
): Promise<SaveResult> {
  const denied = await permissionDenied("purchaseOrder.receive");
  if (denied) return { ok: false, error: denied };
  try {
    const po = await recordReceipt(id, receivedQtys);
    revalidatePath("/procurement");
    revalidatePath(`/procurement/${id}`);
    return { ok: true, id: po.id, poNumber: po.poNumber };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to record receipt." };
  }
}

export async function createPoFromSelectionsAction(input: {
  selectionIds: string[];
  vendorName: string;
  vendorContact?: string | null;
  vendorEmail?: string | null;
}): Promise<SaveResult> {
  const denied = await permissionDenied("write");
  if (denied) return { ok: false, error: denied };
  if (!input.vendorName || !input.vendorName.trim()) {
    return { ok: false, error: "Enter a supplier / vendor name." };
  }
  if (!input.selectionIds || input.selectionIds.length === 0) {
    return { ok: false, error: "Select at least one material selection." };
  }
  try {
    const { po } = await createPurchaseOrderFromSelections(input);
    revalidatePath("/procurement");
    revalidatePath("/materials");
    return { ok: true, id: po.id, poNumber: po.poNumber };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create purchase order." };
  }
}
