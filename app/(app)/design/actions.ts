"use server";

import { revalidatePath } from "next/cache";
import {
  createDeliverable,
  updateDeliverable,
  deleteDeliverable,
  DuplicateNumberError,
} from "@/lib/data/design";
import { DISCIPLINE_SLUG } from "@/lib/design/types";
import type { DesignDeliverableInput } from "@/lib/design/types";

export type SaveResult =
  | { ok: true; id: string; number: string }
  | { ok: false; error: string };

function validate(input: DesignDeliverableInput): string | null {
  if (!input.number || !input.number.trim()) return "Enter a drawing / document number.";
  if (!input.title || !input.title.trim()) return "Enter a title.";
  return null;
}

function revalidate(discipline: DesignDeliverableInput["discipline"]) {
  revalidatePath("/design");
  revalidatePath(`/design/${DISCIPLINE_SLUG[discipline]}`);
}

export async function createDeliverableAction(input: DesignDeliverableInput): Promise<SaveResult> {
  const err = validate(input);
  if (err) return { ok: false, error: err };
  try {
    const d = await createDeliverable(input);
    revalidate(input.discipline);
    return { ok: true, id: d.id, number: d.number };
  } catch (e) {
    if (e instanceof DuplicateNumberError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create deliverable." };
  }
}

export async function updateDeliverableAction(
  id: string,
  input: DesignDeliverableInput,
): Promise<SaveResult> {
  const err = validate(input);
  if (err) return { ok: false, error: err };
  try {
    const d = await updateDeliverable(id, input);
    revalidate(input.discipline);
    revalidatePath(`/design/deliverable/${id}`);
    return { ok: true, id: d.id, number: d.number };
  } catch (e) {
    if (e instanceof DuplicateNumberError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update deliverable." };
  }
}

export async function deleteDeliverableAction(id: string): Promise<{ ok: true }> {
  await deleteDeliverable(id);
  revalidatePath("/design");
  return { ok: true };
}
