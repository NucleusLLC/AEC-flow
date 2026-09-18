"use server";

import { revalidatePath } from "next/cache";
import {
  saveEstimate,
  getEstimateById,
  duplicateEstimate,
  setEstimateLock,
  copyTasksToProject,
  listCopyDestinations,
} from "@/lib/data/estimates";
import { savePriceBook } from "@/lib/data/price-lists";
import { saveNormSet } from "@/lib/data/norm-set";
import { saveGeneralConditions } from "@/lib/data/general-conditions-db";
import { saveTemplates } from "@/lib/data/estimate-templates";
import { saveWikiArticles } from "@/lib/data/estimating-wiki-db";
import { estimateTotals } from "@/lib/estimates/calc";
import type { CostEstimate, CopyDestination } from "@/lib/data/estimates.types";
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

/** The projects a selection of tasks could be copied into. See listCopyDestinations. */
export async function listCopyDestinationsAction(
  excludeProjectId: string,
): Promise<CopyDestination[]> {
  try {
    return await listCopyDestinations(excludeProjectId);
  } catch {
    // An empty list reads as "nowhere to copy to", which the dialog states. It is
    // the honest degradation: the alternative is a picker that looks broken.
    return [];
  }
}

/**
 * Copy chosen coded tasks from this estimate into another project's estimate.
 *
 * The browser sends WHICH tasks and two options — never the rows. The source is
 * read server-side and lib/estimates/copy-lines decides what travels, so a
 * client cannot post a price into a sheet and have it look typed in.
 *
 * Returns the destination's id so the caller can offer to open it, and whether
 * it had to be created — a project with no estimate yet is a legitimate
 * destination, and that is the "new project" half of the request.
 */
export async function copyTasksToProjectAction(input: {
  sourceEstimateId: string;
  targetProjectId: string;
  selection: { sections: string[]; items: string[] };
  options: { includeQuantities?: boolean; includePrices?: boolean };
}): Promise<
  | {
      ok: true;
      estimateId: string;
      created: boolean;
      taskCount: number;
      sectionCount: number;
      pricesWithheld: boolean;
    }
  | { ok: false; error: string }
> {
  try {
    const res = await copyTasksToProject(input);
    // The estimates list changes too: the destination gains an estimate, or a
    // bigger one, and its cached amount is recomputed.
    revalidatePath("/estimates");
    return { ok: true, ...res };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message ?? "The tasks could not be copied." };
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
