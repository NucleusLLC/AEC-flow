"use server";

import { revalidatePath } from "next/cache";
import { createClient, updateClient, getClients } from "@/lib/data/clients";
import { logActivity, getActivityActorId } from "@/lib/data/activity";
import type { ClientWriteInput } from "@/lib/data/clients.types";
import { getServerT } from "@/lib/i18n/server";
import { requireActor } from "@/lib/server/actor";
import { firstNewClientError, validateNewClient, type NewClientErrors } from "@/lib/clients/new-client";

export type SaveClientResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: NewClientErrors };

/**
 * Persist a client (create or update) and revalidate the affected routes.
 * Returns a tagged result so the client form can redirect on success or show
 * the error inline on failure — never throws to the client.
 *
 * A NEW client must carry CLIENT NAME, EMAIL and CELL NUMBER — every "add a
 * client" control in the app ends here, so this is the one gate that holds.
 * `fieldErrors` (translated) lets each form mark the field itself. An EDIT
 * only needs a name: clients from before the rule may have no email or cell.
 */
export async function saveClient(
  mode: "new" | "edit",
  input: ClientWriteInput,
): Promise<SaveClientResult> {
  try {
    await requireActor();
  } catch {
    const t = await getServerT();
    return { ok: false, error: t("You must be signed in.") };
  }
  let cleaned: ClientWriteInput;
  if (mode === "new") {
    const checked = validateNewClient(input);
    if (!checked.ok) {
      const t = await getServerT();
      const fieldErrors: NewClientErrors = {};
      for (const [k, v] of Object.entries(checked.errors) as [keyof NewClientErrors, string][]) {
        fieldErrors[k] = t(v);
      }
      return { ok: false, error: firstNewClientError(fieldErrors) ?? "", fieldErrors };
    }
    cleaned = { ...input, name: checked.name, email: checked.email, mobile: checked.mobile };
  } else {
    if (!input.name?.trim()) {
      const t = await getServerT();
      return { ok: false, error: t("Client name is required.") };
    }
    cleaned = { ...input, name: input.name.trim() };
  }
  try {
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
        meta: cleaned.name ? { label: cleaned.name } : undefined,
      });
    }
    return { ok: true, id };
  } catch (e) {
    const t = await getServerT();
    const error = e instanceof Error ? e.message : t("Failed to save client.");
    return { ok: false, error };
  }
}

/**
 * Id + name of every client, for pickers that must offer client creation but
 * whose host cannot hand them the list.
 *
 * WHY AN ACTION AND NOT A PROP. `ProjectSelect` has to nest a client picker
 * inside its "add a project" form, and its hosts include the Schedule and
 * Estimates panels, which are protected files — adding a required prop there is
 * not available to us. Reading through an action keeps the fetch server-side,
 * company-scoped by the same `getClients()` every page uses, and costs nothing
 * until a user actually opens a create form.
 */
export async function listClientOptions(): Promise<{ id: string; name: string }[]> {
  await requireActor();
  const clients = await getClients();
  return clients.map((c) => ({ id: c.id, name: c.name }));
}
