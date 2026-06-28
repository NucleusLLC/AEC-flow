"use server";

import { revalidatePath } from "next/cache";
import { createClient, updateClient } from "@/lib/data/clients";
import { logActivity, getActivityActorId } from "@/lib/data/activity";
import type { ClientWriteInput } from "@/lib/data/clients.types";

export type SaveClientResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Persist a client (create or update) and revalidate the affected routes.
 * Returns a tagged result so the client form can redirect on success or show
 * the error inline on failure — never throws to the client.
 */
export async function saveClient(
  mode: "new" | "edit",
  input: ClientWriteInput,
): Promise<SaveClientResult> {
  if (!input.name?.trim()) {
    return { ok: false, error: "Client name is required." };
  }
  try {
    const cleaned = { ...input, name: input.name.trim() };
    const { id } = mode === "new" ? await createClient(cleaned) : await updateClient(cleaned);
    revalidatePath("/clients");
    revalidatePath(`/clients/${id}`);
    const userId = await getActivityActorId();
    if (userId) {
      await logActivity({
        userId,
        action: mode === "new" ? "created" : "updated",
        entityType: "client",
        entityId: id,
        clientId: id,
        meta: input.name ? { label: input.name } : undefined,
      });
    }
    return { ok: true, id };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Failed to save client.";
    return { ok: false, error };
  }
}
