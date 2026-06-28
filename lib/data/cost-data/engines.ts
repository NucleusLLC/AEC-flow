/**
 * Cost calculation engines — pure functions (no I/O), so they're trivially testable
 * and reusable by the estimate builder, reports, and UI calculators.
 */

import type { RegionalAdjustment } from "./types";

/* ---------------- Indexation engine ----------------
 * Indexed Cost = Base Cost × (Current Index / Base Index)
 */
export function indexedCost(baseCost: number, baseIndex: number, currentIndex: number): number {
  if (!baseIndex) return baseCost;
  return baseCost * (currentIndex / baseIndex);
}

/* ---------------- Regional adjustment engine ----------------
 * Adjusted Cost = Indexed Cost × Regional Factor × Logistics Factor × Currency Conversion
 */
export type RegionalFactors = {
  regionalFactor: number; // labour/material/island composite
  logisticsFactor: number;
  currencyConversion: number; // multiply source currency → target currency
};

export function adjustedCost(indexed: number, f: RegionalFactors): number {
  return indexed * f.regionalFactor * f.logisticsFactor * f.currencyConversion;
}

/** Compose the saved regional_adjustments rows for a region into a single factor set. */
export function factorsFor(adjustments: RegionalAdjustment[], country: string, region: string): RegionalFactors {
  const rows = adjustments.filter((a) => a.country === country && a.region === region);
  const pick = (...types: RegionalAdjustment["adjustmentType"][]) =>
    rows.filter((r) => types.includes(r.adjustmentType)).reduce((acc, r) => acc * r.adjustmentFactor, 1);
  return {
    regionalFactor: pick("labor", "material", "island_factor", "inflation"),
    logisticsFactor: pick("logistics"),
    currencyConversion: pick("currency") || 1,
  };
}

/** Full pipeline: base → indexed → regionally adjusted. */
export function localizedCost(
  baseCost: number,
  baseIndex: number,
  currentIndex: number,
  f: RegionalFactors,
): number {
  return adjustedCost(indexedCost(baseCost, baseIndex, currentIndex), f);
}

/* ---------------- Estimate line build-up ----------------
 * subtotal → + waste → + overhead → + profit → + contingency → + VAT
 */
export type LineMarkups = {
  wastePercentage?: number;
  overheadPercentage?: number;
  profitPercentage?: number;
  contingencyPercentage?: number;
  vatPercentage?: number;
};

export type LineBreakdown = {
  subtotal: number;
  afterWaste: number;
  afterOverhead: number;
  afterProfit: number;
  afterContingency: number;
  vatAmount: number;
  total: number;
};

export function lineBreakdown(quantity: number, unitCost: number, m: LineMarkups): LineBreakdown {
  const up = (n: number, pct?: number) => n * (1 + (pct ?? 0) / 100);
  const subtotal = quantity * unitCost;
  const afterWaste = up(subtotal, m.wastePercentage);
  const afterOverhead = up(afterWaste, m.overheadPercentage);
  const afterProfit = up(afterOverhead, m.profitPercentage);
  const afterContingency = up(afterProfit, m.contingencyPercentage);
  const total = up(afterContingency, m.vatPercentage);
  return {
    subtotal,
    afterWaste,
    afterOverhead,
    afterProfit,
    afterContingency,
    vatAmount: total - afterContingency,
    total,
  };
}
