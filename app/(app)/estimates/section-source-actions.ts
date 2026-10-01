"use server";

import { requireActor } from "@/lib/server/actor";
import { getEstimateById } from "@/lib/data/estimates";
import { listSectionSources } from "@/lib/data/estimate-section-sources";
import type { CostEstimate } from "@/lib/data/estimates.types";
import type { SectionSource } from "@/lib/estimates/section-sources";

/**
 * "Copy Section over" — read-only actions behind the dialog.
 *
 * Both require a signed-in, active member. The tenant extension scopes the reads
 * to the caller's practice, but only when there IS a session: without one the
 * query runs unscoped, so a sessionless call must stop here rather than list
 * every practice's estimates.
 */

export type SourcesResult = { ok: true; sources: SectionSource[] } | { ok: false; error: string };
export type SourceSheetResult = { ok: true; estimate: CostEstimate } | { ok: false; error: string };

export async function listSectionSourcesAction(excludeEstimateId: string): Promise<SourcesResult> {
  try {
    await requireActor();
    return { ok: true, sources: await listSectionSources(excludeEstimateId) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "The Job Orders could not be loaded." };
  }
}

export async function loadSectionSourceAction(id: string): Promise<SourceSheetResult> {
  try {
    await requireActor();
    const estimate = await getEstimateById(id);
    if (!estimate) return { ok: false, error: "That estimate no longer exists." };
    return { ok: true, estimate };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "That estimate could not be loaded." };
  }
}
