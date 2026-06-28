/**
 * Estimate costing — the single source of truth for BOQ math.
 *
 * The same functions drive the on-screen Estimate view, the printable/PDF
 * document, and (later) the persisted API, so the number the client sees in
 * the app is exactly the number on the PDF. Mirrors the pattern used by the
 * Construction-Admin module's `lib/ca/calc.ts`.
 *
 * Per line item:
 *   Total Hrs   = qty × laborNorm (hrs/unit)
 *   Labor Cost  = Total Hrs × avg labor rate
 *   Material    = qty × materialUnitCost
 *   Equipment   = qty × equipmentUnitCost
 *   Subcontract = qty × subcontractUnitCost
 *   Item Total  = Labor + Material + Equipment + Subcontract
 *   Progress    = Item Total × POC%
 *
 * Roll-up:
 *   Direct cost = Σ item totals
 *   Markup base = Direct cost + General Conditions (optional preliminaries)
 *   Profit      = Markup base × profit%
 *   BBO/Overhead= Markup base × bbo%
 *   Grand total = Markup base + Profit + BBO
 */

import type { CostEstimate, EstimateCategory, EstimateItem } from "@/lib/data/estimates";
import { sumGeneralConditions, type GeneralConditionItem } from "@/lib/data/general-conditions";

export type ItemCalc = {
  hrs: number;
  labor: number;
  mat: number;
  equip: number;
  sub: number;
  total: number;
  prog: number;
};
export type Totals = ItemCalc;

export const ZERO: ItemCalc = { hrs: 0, labor: 0, mat: 0, equip: 0, sub: 0, total: 0, prog: 0 };

/**
 * Method Resolver — derives a line's labour hours + labour cost per its
 * `calculationMethod`. Both hours AND cost are returned so the Schedule Coupler
 * (hours) and the LABOR column (cost) stay consistent across every method.
 *
 * Today every method resolves to the Norm-Based path, so behaviour is identical
 * to the original `calcItem`. Labor/Rate and Assembly-Based plug in here in later
 * phases — without changing this function's `{ hrs, labor }` contract, so nothing
 * downstream (totals, reports, schedule, PayApp) is affected by the seam itself.
 */
export function resolveLineLabor(it: EstimateItem, rate: number): { hrs: number; labor: number } {
  const hrs = it.qty * it.laborNorm;
  // Labor/Rate: direct labour cost per unit. Hours still come from laborNorm, so the
  // Schedule Coupler reads accurate hours even though cost is decoupled.
  if ((it.calculationMethod ?? "norm") === "labor_rate") {
    return { hrs, labor: it.qty * (it.laborRatePerUnit ?? 0) };
  }
  // Norm-Based (default): Total Hrs = qty × laborNorm; Labor Cost = Total Hrs × rate.
  return { hrs, labor: hrs * rate };
}

/**
 * Assembly-Based: the line's cost is the sum of its typed components, each priced per
 * assembly unit (`it.qty` = number of assembly units). Components distribute into the
 * existing LABOR / MATERIAL / EQUIPMENT / SUBCONTRACT buckets; "other" folds into
 * SUBCONTRACT so the four report columns always sum to the line Total — no new column,
 * no new total formula. Labour components carry hours (qty = hrs/unit), keeping the
 * Schedule Coupler fed exactly like the other methods.
 */
export function calcAssembly(it: EstimateItem): ItemCalc {
  const units = it.qty;
  let hrs = 0, labor = 0, mat = 0, equip = 0, sub = 0;
  for (const comp of it.assembly ?? []) {
    const amount = units * comp.qty * comp.unitCost;
    switch (comp.type) {
      case "labor":
        labor += amount;
        hrs += units * comp.qty;
        break;
      case "material":
        mat += amount;
        break;
      case "equipment":
        equip += amount;
        break;
      case "subcontract":
      case "other":
      default:
        sub += amount;
        break;
    }
  }
  const total = labor + mat + equip + sub;
  const prog = (total * (it.poc ?? 0)) / 100;
  return { hrs, labor, mat, equip, sub, total, prog };
}

export function calcItem(it: EstimateItem, rate: number): ItemCalc {
  // Method dispatch (see CalculationMethod). Assembly distributes from components;
  // Norm / Labor-Rate use the flat unit-cost fields.
  if ((it.calculationMethod ?? "norm") === "assembly") return calcAssembly(it);
  const { hrs, labor } = resolveLineLabor(it, rate);
  const mat = it.qty * it.materialUnitCost;
  const equip = it.qty * it.equipmentUnitCost;
  const sub = it.qty * it.subcontractUnitCost;
  const total = labor + mat + equip + sub;
  const prog = (total * (it.poc ?? 0)) / 100;
  return { hrs, labor, mat, equip, sub, total, prog };
}

export function sum(a: ItemCalc, b: ItemCalc): ItemCalc {
  return {
    hrs: a.hrs + b.hrs,
    labor: a.labor + b.labor,
    mat: a.mat + b.mat,
    equip: a.equip + b.equip,
    sub: a.sub + b.sub,
    total: a.total + b.total,
    prog: a.prog + b.prog,
  };
}

export const pocPct = (t: Totals): number => (t.total > 0 ? (t.prog / t.total) * 100 : 0);

export const categoryTotals = (c: EstimateCategory, rate: number): Totals =>
  c.items.reduce((acc, it) => sum(acc, calcItem(it, rate)), ZERO);

export type EstimateSummary = {
  rate: number;
  grand: Totals;
  direct: number;
  gcAmount: number;
  markupBase: number;
  profit: number;
  bbo: number;
  grandTotal: number;
  grandPocPct: number;
};

/**
 * Whole-estimate roll-up. `generalConditions` is only added to the markup base
 * when supplied (matches the view's opt-in "General Conditions" toggle, which
 * defaults off).
 */
export function estimateTotals(
  est: CostEstimate,
  generalConditions?: GeneralConditionItem[],
): EstimateSummary {
  const rate = est.avgLaborRate;
  const grand = est.categories.reduce((acc, c) => sum(acc, categoryTotals(c, rate)), ZERO);
  const direct = grand.total;
  const gcAmount = generalConditions ? sumGeneralConditions(generalConditions) : 0;
  const markupBase = direct + gcAmount;
  const profit = (markupBase * est.profitPct) / 100;
  const bbo = (markupBase * est.bboPct) / 100;
  const grandTotal = markupBase + profit + bbo;
  return { rate, grand, direct, gcAmount, markupBase, profit, bbo, grandTotal, grandPocPct: pocPct(grand) };
}
