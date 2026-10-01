/**
 * Take-Off "ADD NEW" — the checks for a Norm Set task typed in from the
 * Take-Off sheet, when the item the estimator needs is not in the dropdown.
 *
 * CLIENT-SAFE and pure, so the form and the server action run the same rules.
 * The task joins the firm-wide Norm Set (the same library the Norm Set tab
 * edits), so it is offered on every later take-off and estimate too.
 */
import { ESTIMATE_UNITS } from "@/lib/data/estimates.types";
import type { NormSetTask } from "@/lib/data/estimate-presets";

/** What the form sends. Numbers arrive as typed text. */
export type NormTaskDraft = {
  task: string;
  trade: string;
  unit: string;
  laborNorm: string;
  materialUnitCost: string;
  equipmentUnitCost: string;
  subcontractUnitCost: string;
  code: string;
};

export type NormTaskField = keyof NormTaskDraft;

export type NormTaskCheck =
  | { ok: true; task: Omit<NormSetTask, "id"> }
  | { ok: false; errors: Partial<Record<NormTaskField, string>> };

export const EMPTY_NORM_TASK_DRAFT: NormTaskDraft = {
  task: "",
  trade: "",
  unit: "m²",
  laborNorm: "",
  materialUnitCost: "",
  equipmentUnitCost: "",
  subcontractUnitCost: "",
  code: "",
};

/** Blank is "no figure"; anything else must be a number of zero or more. */
function money(raw: string): { value: number | undefined; bad: boolean } {
  const s = raw.trim().replace(/,/g, "");
  if (!s) return { value: undefined, bad: false };
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? { value: n, bad: false } : { value: undefined, bad: true };
}

/**
 * Validate and normalise a draft. Error messages are English keys, translated
 * where they are shown.
 *
 * - DESCRIPTION and TRADE are required: the trade is the dropdown's group.
 * - UNIT must be one the estimate sheet knows.
 * - LABOUR NORM (hours per unit) may be left blank, read as 0 — a supply-only
 *   item has none — but if typed it must be a number of zero or more.
 * - The three unit costs are optional, zero or more.
 */
export function checkNormTaskDraft(d: NormTaskDraft): NormTaskCheck {
  const errors: Partial<Record<NormTaskField, string>> = {};
  const task = d.task.trim().replace(/\s+/g, " ");
  const trade = d.trade.trim().replace(/\s+/g, " ");
  const code = d.code.trim();

  if (!task) errors.task = "DESCRIPTION is required.";
  else if (task.length > 200) errors.task = "DESCRIPTION is too long (200 characters at most).";
  if (!trade) errors.trade = "TRADE is required.";
  else if (trade.length > 80) errors.trade = "TRADE is too long (80 characters at most).";
  if (!ESTIMATE_UNITS.includes(d.unit)) errors.unit = "Choose a UNIT from the list.";

  const norm = money(d.laborNorm);
  if (norm.bad) errors.laborNorm = "Enter a number of 0 or more.";
  const mat = money(d.materialUnitCost);
  if (mat.bad) errors.materialUnitCost = "Enter a number of 0 or more.";
  const equip = money(d.equipmentUnitCost);
  if (equip.bad) errors.equipmentUnitCost = "Enter a number of 0 or more.";
  const sub = money(d.subcontractUnitCost);
  if (sub.bad) errors.subcontractUnitCost = "Enter a number of 0 or more.";
  if (code.length > 40) errors.code = "CODE is too long (40 characters at most).";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    task: {
      task,
      trade,
      unit: d.unit,
      laborNorm: norm.value ?? 0,
      materialUnitCost: mat.value,
      equipmentUnitCost: equip.value,
      subcontractUnitCost: sub.value,
      code: code || undefined,
    },
  };
}

/** Take-Off's measuring method for a unit, the same mapping the row uses when a task is linked. */
export function methodForUnit(unit: string): "area" | "volume" | "linear" | "count" {
  if (unit === "m³") return "volume";
  if (unit === "m" || unit === "lm") return "linear";
  if (unit === "no" || unit === "set") return "count";
  return "area";
}
