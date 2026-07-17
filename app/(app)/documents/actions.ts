"use server";

import { revalidatePath } from "next/cache";
import {
  createGeneratedDocument,
  type CreateResult,
} from "@/lib/documents/registry";
import { isSourceSystem } from "@/lib/documents/catalog";
import { isModuleKey, type ModuleKey } from "@/lib/modules";

export interface RecordDocInput {
  sourceSystem: string;
  docType: string;
  title: string;
  sourceRecordId: string;
  sourceRecordVersion?: string | null;
  moduleKey?: string;
}

/** Record a generated document in the register (spec §11/§14). Does NOT touch
 *  the source estimate/schedule — it only writes the additive register row. */
export async function recordGeneratedDocument(input: RecordDocInput): Promise<CreateResult> {
  if (!isSourceSystem(input.sourceSystem)) {
    return { ok: false, error: "Unknown source system" };
  }
  if (!input.sourceRecordId) {
    return { ok: false, error: "No source record selected" };
  }
  const moduleKey: ModuleKey | undefined = isModuleKey(input.moduleKey)
    ? input.moduleKey
    : "estimating_timeframe";

  const result = await createGeneratedDocument({
    sourceSystem: input.sourceSystem,
    docType: input.docType,
    title: input.title,
    sourceRecordId: input.sourceRecordId,
    sourceRecordVersion: input.sourceRecordVersion ?? null,
    moduleKey,
  });

  if (result.ok) revalidatePath("/documents/register");
  return result;
}
