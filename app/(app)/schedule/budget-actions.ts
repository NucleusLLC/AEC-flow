"use server";

import { revalidatePath } from "next/cache";
import { getEstimateBudgetSource } from "@/lib/integrations/estimates/adapter";
import { getProjectCommitments, setCommitmentTask } from "@/lib/data/schedule-budget";
import { getSystemCurrency } from "@/lib/format";
import type { Commitment, EstimateLine } from "@/lib/schedule/budget";

/**
 * Schedule Budget — server reads for the budget panel.
 *
 * PROTECTED SYSTEM (schedule) — additive layer, approved 2026-08-04. A NEW file rather
 * than an addition to `actions.ts`: the existing action is the programme save and has
 * nothing to do with cost, and keeping them apart means a change here can never alter
 * how a schedule is persisted.
 *
 * LOADED ON DEMAND. The panel calls this when the Budget toggle is first switched on,
 * not on every schedule render. Reading a project's estimate and every purchase order
 * to paint a Gantt nobody asked to cost-load would be a tax on the common case.
 *
 * Estimates are reached ONLY through `lib/integrations/estimates/adapter` — read-only,
 * reusing the estimate's own calculations. Nothing here writes to an estimate.
 */

export interface ScheduleBudgetData {
  /** Rollup currency: the org System Currency. Schedule carries no currency of its own,
   *  and a per-task budget with no stated unit is worse than none. */
  currency: string;
  commitments: Commitment[];
  estimate: {
    found: boolean;
    currency: string;
    version: string;
    grandTotal: number;
    direct: number;
    lines: EstimateLine[];
    /** True when the estimate is priced in a different unit than the rollup. Its
     *  figures are then shown but never summed into the budget — see the panel. */
    currencyMismatch: boolean;
  };
}

export type LoadBudgetResult =
  | { ok: true; data: ScheduleBudgetData }
  | { ok: false; error: string };

export async function loadScheduleBudgetAction(projectId: string): Promise<LoadBudgetResult> {
  if (!projectId) return { ok: false, error: "Missing project id." };
  try {
    const currency = getSystemCurrency();
    const [commitments, estimate] = await Promise.all([
      getProjectCommitments(projectId),
      getEstimateBudgetSource(projectId),
    ]);
    return {
      ok: true,
      data: {
        currency,
        commitments,
        estimate: {
          found: estimate.found,
          currency: estimate.currency,
          version: estimate.version,
          grandTotal: estimate.grandTotal,
          direct: estimate.direct,
          lines: estimate.lines,
          currencyMismatch: estimate.found && estimate.currency !== currency,
        },
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to load budget data." };
  }
}

export type AssignCommitmentResult = { ok: true } | { ok: false; error: string };

/**
 * Attribute a purchase order to a schedule activity, or clear it back to unassigned.
 *
 * This writes to `PurchaseOrder`, never to an estimate, and never to the schedule's own
 * task rows — an attribution is procurement metadata, so it persists immediately rather
 * than waiting for the programme's Save button. The budget figures themselves ride on
 * the tasks and are saved with the programme, which is why only this one write is here.
 */
export async function assignCommitmentAction(input: {
  purchaseOrderId: string;
  projectId: string;
  taskKey: string | null;
}): Promise<AssignCommitmentResult> {
  if (!input.purchaseOrderId || !input.projectId) {
    return { ok: false, error: "Missing purchase order or project." };
  }
  try {
    const { updated } = await setCommitmentTask({
      purchaseOrderId: input.purchaseOrderId,
      projectId: input.projectId,
      taskKey: input.taskKey && input.taskKey !== "" ? input.taskKey : null,
    });
    if (updated === 0) {
      return { ok: false, error: "That purchase order is not on this project." };
    }
    revalidatePath("/procurement");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to assign the order." };
  }
}
