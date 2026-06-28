"use server";

import { revalidatePath } from "next/cache";
import { createOrder, updateOrder } from "@/lib/data/orders";
import { logActivity, getActivityActorId } from "@/lib/data/activity";
import type { OrderWriteInput } from "@/lib/data/orders.types";

export type SaveOrderResult =
  | { ok: true; id: string; orderNumber: string }
  | { ok: false; error: string };

/**
 * Persist an order (create or update) and revalidate the affected routes.
 * Returns a tagged result so the client form can redirect on success or show
 * the error inline on failure — never throws to the client. Mirrors saveProposal.
 */
export async function saveOrder(
  mode: "new" | "edit",
  input: OrderWriteInput,
): Promise<SaveOrderResult> {
  try {
    const res = mode === "new" ? await createOrder(input) : await updateOrder(input);
    revalidatePath("/orders");
    revalidatePath(`/orders/${res.id}`);
    const userId = await getActivityActorId();
    if (userId) {
      await logActivity({
        userId,
        action: mode === "new" ? "created" : "updated",
        entityType: "order",
        entityId: res.id,
        meta: input.title ? { label: input.title } : undefined,
      });
    }
    return { ok: true, id: res.id, orderNumber: res.orderNumber };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Failed to save order.";
    return { ok: false, error };
  }
}
