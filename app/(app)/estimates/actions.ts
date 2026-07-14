"use server";

import { revalidatePath } from "next/cache";
import { saveEstimate, getEstimateById, duplicateEstimate, setEstimateLock } from "@/lib/data/estimates";
import { savePriceBook } from "@/lib/data/price-lists";
import { saveNormSet } from "@/lib/data/norm-set";
import { saveGeneralConditions } from "@/lib/data/general-conditions-db";
import { saveTemplates } from "@/lib/data/estimate-templates";
import { saveWikiArticles } from "@/lib/data/estimating-wiki-db";
import { estimateTotals } from "@/lib/estimates/calc";
import type { CostEstimate } from "@/lib/data/estimates.types";
import type { PriceItem } from "@/lib/data/price-lists.types";
import type { NormSetTask, EstimateTemplate } from "@/lib/data/estimate-presets";
import type { GeneralConditionItem } from "@/lib/data/general-conditions";
import type { WikiArticle } from "@/lib/data/estimating-wiki";

type SaveResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Load a single estimate's FULL sheet (header + its own categories/items) by id.
 * Used when a project is opened so the workspace shows that estimate's real lines
 * — not the base demo estimate. Returns null if the id no longer exists.
 */
export async function loadEstimateAction(id: string): Promise<CostEstimate | null> {
  return getEstimateById(id);
}

/**
 * Persist the full estimate sheet. The stored `amount` (shown in the estimate
 * list) is recomputed server-side from the same calc the screen/PDF use, so the
 * list total always matches the sheet. General Conditions are excluded here to
 * match the editor's default-off markup base.
 */
export async function saveEstimateAction(estimate: CostEstimate): Promise<SaveResult> {
  try {
    const amount = Math.round(estimateTotals(estimate).grandTotal);
    const { id } = await saveEstimate(estimate, amount);
    revalidatePath("/estimates");
    revalidatePath(`/print/estimates/${id}`);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? "Save failed" };
  }
}

/**
 * Copy an estimate into a new, editable version (new id, deep-copied lines). Lock the
 * source first if it's the one being superseded — this action does not lock it for you,
 * because duplicating is also how you branch a scenario you intend to keep editing.
 */
export async function duplicateEstimateAction(id: string, version: string): Promise<SaveResult> {
  try {
    const label = version.trim();
    if (!label) return { ok: false, error: "A version name is required." };
    const res = await duplicateEstimate(id, label);
    revalidatePath("/estimates");
    return { ok: true, id: res.id };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? "Could not duplicate this estimate." };
  }
}

/** Freeze / unfreeze a version. Locked rows are refused by every server write path. */
export async function setEstimateLockAction(id: string, locked: boolean): Promise<SaveResult> {
  try {
    if (!id) return { ok: false, error: "Save the estimate before locking it." };
    await setEstimateLock(id, locked);
    revalidatePath("/estimates");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? "Could not change the lock." };
  }
}

type SimpleResult = { ok: true } | { ok: false; error: string };

/** Persist the firm-wide price book (materials + equipment). */
export async function savePriceBookAction(materials: PriceItem[], equipment: PriceItem[]): Promise<SimpleResult> {
  try {
    await savePriceBook(materials, equipment);
    revalidatePath("/estimates");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? "Save failed" };
  }
}

/** Persist the firm-wide Norm Set (standard task library). */
export async function saveNormSetAction(tasks: NormSetTask[]): Promise<SimpleResult> {
  try {
    await saveNormSet(tasks);
    revalidatePath("/estimates");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? "Save failed" };
  }
}

/** Persist the firm-wide General Conditions template (preliminaries). */
export async function saveGeneralConditionsAction(items: GeneralConditionItem[]): Promise<SimpleResult> {
  try {
    await saveGeneralConditions(items);
    revalidatePath("/estimates");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? "Save failed" };
  }
}

/** Persist the firm estimate-template library. */
export async function saveTemplatesAction(templates: EstimateTemplate[]): Promise<SimpleResult> {
  try {
    await saveTemplates(templates);
    revalidatePath("/estimates");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? "Save failed" };
  }
}

/** Persist the estimating Wiki knowledge base. */
export async function saveWikiAction(articles: WikiArticle[]): Promise<SimpleResult> {
  try {
    await saveWikiArticles(articles);
    revalidatePath("/estimates");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? "Save failed" };
  }
}
