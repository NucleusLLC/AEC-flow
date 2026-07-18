"use server";

import { revalidatePath } from "next/cache";
import {
  createMaterialSelection,
  updateMaterialSelection,
  deleteMaterialSelection,
} from "@/lib/data/materials";
import type { MaterialSelectionInput } from "@/lib/materials/types";

export type SaveResult =
  | { ok: true; id: string; tag: string }
  | { ok: false; error: string };

function validate(input: MaterialSelectionInput): string | null {
  if (!input.productName || !input.productName.trim()) return "Enter a product / material name.";
  if (!input.category || !input.category.trim()) return "Choose a category.";
  return null;
}

export async function createMaterialAction(input: MaterialSelectionInput): Promise<SaveResult> {
  const err = validate(input);
  if (err) return { ok: false, error: err };
  try {
    const m = await createMaterialSelection(input);
    revalidatePath("/materials");
    return { ok: true, id: m.id, tag: m.tag };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to create selection." };
  }
}

export async function updateMaterialAction(
  id: string,
  input: MaterialSelectionInput,
): Promise<SaveResult> {
  const err = validate(input);
  if (err) return { ok: false, error: err };
  try {
    const m = await updateMaterialSelection(id, input);
    revalidatePath("/materials");
    revalidatePath(`/materials/${id}`);
    return { ok: true, id: m.id, tag: m.tag };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update selection." };
  }
}

export async function deleteMaterialAction(id: string): Promise<{ ok: true }> {
  await deleteMaterialSelection(id);
  revalidatePath("/materials");
  return { ok: true };
}
