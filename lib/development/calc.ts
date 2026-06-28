/**
 * Parceling Plan / Land Development — calculation engine.
 *
 * Pure, dependency-free functions (NO `@/lib/db` import) so they are safe to run
 * in `"use client"` components for instant recalculation as the user edits, and
 * are trivially unit-testable. Every formula mirrors the spec (§19) and the
 * Coriara / Morgenster reference worksheets; see calc.test.ts for the exact
 * reconciled figures.
 *
 * Conventions: areas in m², money in the project currency (AWG in the demo),
 * rates as money-per-m², percentages as whole numbers (e.g. 10 = 10%).
 */

/* ── helpers ──────────────────────────────────────────────────────────────── */

/** Sum that ignores null/undefined/NaN. */
export function sum(values: Array<number | null | undefined>): number {
  return values.reduce<number>((acc, v) => acc + (Number.isFinite(v as number) ? (v as number) : 0), 0);
}

/** Safe divide — returns 0 when the denominator is 0/invalid (avoids Infinity/NaN in the UI). */
export function safeDiv(numerator: number, denominator: number): number {
  return denominator ? numerator / denominator : 0;
}

/** Apply a whole-number percentage to a base (pct(200, 5) === 10). */
export function pct(base: number, percentage: number): number {
  return base * (percentage / 100);
}

/** Round to n decimals (banker-free, good enough for currency display math). */
export function round(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/* ── 2 + 3. Land use / acquisition ────────────────────────────────────────── */

export type LandUseInput = {
  grossParcelArea: number;
  roadArea?: number;
  sidewalkArea?: number;
  greenArea?: number;
  utilityArea?: number;
  drainageArea?: number;
  commonArea?: number;
  poolDeckArea?: number;
  retainedOwnerArea?: number;
  otherNonSellableArea?: number;
  /** Regulatory minimums for the warnings (whole-number %). */
  requiredGreenPct?: number;
  /** Optional: when lots exist, the actual sellable count for density/avg-lot. */
  lotCount?: number;
};

export type LandUseResult = {
  grossParcelArea: number;
  nonSellableLandTotal: number;
  netSellableLand: number;
  netSellableRatio: number; // 0..1
  roadPct: number; // 0..100
  greenPct: number; // 0..100
  averageLotSize: number;
  unitsPerHectare: number;
  warnings: string[];
};

/**
 * netSellableLand = grossParcelArea − (road + sidewalk + green + utility +
 *                   drainage + common + pool/deck + retained + other)
 */
export function computeLandUse(input: LandUseInput): LandUseResult {
  const {
    grossParcelArea,
    roadArea = 0,
    sidewalkArea = 0,
    greenArea = 0,
    utilityArea = 0,
    drainageArea = 0,
    commonArea = 0,
    poolDeckArea = 0,
    retainedOwnerArea = 0,
    otherNonSellableArea = 0,
    requiredGreenPct = 0,
    lotCount = 0,
  } = input;

  const nonSellableLandTotal = sum([
    roadArea, sidewalkArea, greenArea, utilityArea, drainageArea,
    commonArea, poolDeckArea, retainedOwnerArea, otherNonSellableArea,
  ]);
  const netSellableLand = grossParcelArea - nonSellableLandTotal;
  const netSellableRatio = safeDiv(netSellableLand, grossParcelArea);
  const roadPct = safeDiv(roadArea, grossParcelArea) * 100;
  const greenPct = safeDiv(greenArea, grossParcelArea) * 100;
  const averageLotSize = safeDiv(netSellableLand, lotCount);
  const unitsPerHectare = safeDiv(lotCount, grossParcelArea / 10_000);

  const warnings: string[] = [];
  if (netSellableLand < 0) warnings.push("Non-sellable areas exceed the gross parcel area.");
  if (netSellableRatio > 0 && netSellableRatio < 0.6) warnings.push("Net sellable ratio is below 60% — layout may be inefficient.");
  if (requiredGreenPct > 0 && greenPct + 1e-9 < requiredGreenPct) {
    warnings.push(`Green area (${round(greenPct, 1)}%) is below the required ${requiredGreenPct}%.`);
  }
  if (roadPct > 35) warnings.push(`Road area (${round(roadPct, 1)}%) is unusually high.`);

  return {
    grossParcelArea,
    nonSellableLandTotal,
    netSellableLand,
    netSellableRatio,
    roadPct,
    greenPct,
    averageLotSize,
    unitsPerHectare,
    warnings,
  };
}

export type AcquisitionInput = {
  parcelAcquisitionCost: number;
  transferTax?: number;
  notaryCost?: number;
  kadasterCost?: number;
  brokerCommission?: number;
  dueDiligence?: number;
  appraisal?: number;
  topographicSurvey?: number;
  parcelingSurvey?: number;
  meetbrieven?: number;
  legalSetup?: number;
  companySetup?: number;
  taxAdvisor?: number;
  financingSetup?: number;
  bankGuarantee?: number;
  /** whole-number % applied to the running subtotal */
  contingencyPct?: number;
};

export type AcquisitionResult = {
  subtotal: number;
  contingency: number;
  totalAcquisitionCost: number;
  costPerGrossM2: number;
  costPerNetSellableM2: number;
};

/** Total acquisition cost = parcel + all transfer/advisor costs + contingency. */
export function computeAcquisition(
  input: AcquisitionInput,
  grossParcelArea: number,
  netSellableLand: number,
): AcquisitionResult {
  const subtotal = sum([
    input.parcelAcquisitionCost, input.transferTax, input.notaryCost, input.kadasterCost,
    input.brokerCommission, input.dueDiligence, input.appraisal, input.topographicSurvey,
    input.parcelingSurvey, input.meetbrieven, input.legalSetup, input.companySetup,
    input.taxAdvisor, input.financingSetup, input.bankGuarantee,
  ]);
  const contingency = pct(subtotal, input.contingencyPct ?? 0);
  const totalAcquisitionCost = subtotal + contingency;
  return {
    subtotal,
    contingency,
    totalAcquisitionCost,
    costPerGrossM2: safeDiv(totalAcquisitionCost, grossParcelArea),
    costPerNetSellableM2: safeDiv(totalAcquisitionCost, netSellableLand),
  };
}

/* ── 7. Cost-code / project totals ────────────────────────────────────────── */

/** The 1000-series development cost codes (spec §7). */
export const COST_CODES = [
  { code: 1000, name: "Land Acquisition" },
  { code: 2000, name: "Transfer / Legal / Kadaster" },
  { code: 3000, name: "Surveys / Due Diligence" },
  { code: 4000, name: "Architecture / Engineering / Consultants" },
  { code: 5000, name: "Infrastructure / Civil Works" },
  { code: 6000, name: "Utilities" },
  { code: 7000, name: "Financing / Bank / Interest" },
  { code: 8000, name: "Marketing / Sales" },
  { code: 9000, name: "Contingency" },
  { code: 10000, name: "Developer Fee / Profit" },
] as const;

export type CostLine = {
  /** quantity × unitRate when both present, else use `total`. */
  quantity?: number;
  unitRate?: number;
  total?: number;
  committed?: number;
  actualPaid?: number;
};

export type CostLineResult = {
  budget: number;
  committed: number;
  actualPaid: number;
  remainingBudget: number;
  variance: number; // budget − actualPaid (positive = under budget)
  overBudget: boolean;
};

/** A single budget/infrastructure line: budget = qty×rate (or explicit total). */
export function computeCostLine(line: CostLine): CostLineResult {
  const budget =
    line.total != null ? line.total : safeDiv(1, 1) * (line.quantity ?? 0) * (line.unitRate ?? 0);
  const committed = line.committed ?? 0;
  const actualPaid = line.actualPaid ?? 0;
  const remainingBudget = budget - actualPaid;
  const variance = budget - actualPaid;
  return { budget, committed, actualPaid, remainingBudget, variance, overBudget: actualPaid > budget };
}

/* ── 4. Lots ──────────────────────────────────────────────────────────────── */

export type LotInput = {
  areaM2: number;
  baseLandPricePerM2: number;
  premiumAdjustmentPerM2?: number;
  /** allocated cost rate (typically the project cost per net sellable m²). */
  allocatedCostPerM2?: number;
  /** OR provide explicit allocated amounts (override the rate). */
  allocatedLandCost?: number;
  allocatedInfraCost?: number;
  allocatedSoftCost?: number;
  nonSellable?: boolean;
};

export type LotResult = {
  finalSalesPricePerM2: number;
  totalSalesPrice: number;
  totalAllocatedCost: number;
  grossProfit: number;
  grossMarginPct: number; // 0..100
  belowCost: boolean;
  warnings: string[];
};

/**
 * lotSalesPrice = area × (basePrice + premium)
 * lotAllocatedCost = explicit allocations, else area × allocatedCostPerM2
 * lotProfit = sales − cost ;  margin = profit / sales
 */
export function computeLot(input: LotInput): LotResult {
  const finalSalesPricePerM2 = input.baseLandPricePerM2 + (input.premiumAdjustmentPerM2 ?? 0);
  const totalSalesPrice = input.areaM2 * finalSalesPricePerM2;

  const explicit =
    input.allocatedLandCost != null || input.allocatedInfraCost != null || input.allocatedSoftCost != null;
  const totalAllocatedCost = explicit
    ? sum([input.allocatedLandCost, input.allocatedInfraCost, input.allocatedSoftCost])
    : input.areaM2 * (input.allocatedCostPerM2 ?? 0);

  const grossProfit = totalSalesPrice - totalAllocatedCost;
  const grossMarginPct = safeDiv(grossProfit, totalSalesPrice) * 100;

  const warnings: string[] = [];
  if (!input.nonSellable && input.areaM2 <= 0) warnings.push("Lot area is zero but the lot is not marked non-sellable.");
  if (finalSalesPricePerM2 + 1e-9 < safeDiv(totalAllocatedCost, input.areaM2)) {
    warnings.push("Sales price/m² is below allocated cost/m².");
  }
  if (grossProfit < 0) warnings.push("Negative margin.");

  return {
    finalSalesPricePerM2,
    totalSalesPrice,
    totalAllocatedCost,
    grossProfit,
    grossMarginPct,
    belowCost: finalSalesPricePerM2 < safeDiv(totalAllocatedCost, input.areaM2 || 1),
    warnings,
  };
}

export type LotRollup = {
  count: number;
  totalArea: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  weightedAvgSalesPricePerM2: number;
  weightedAvgCostPerM2: number;
  avgMarginPct: number;
};

/** Portfolio roll-up across many lots (weighted by area). */
export function rollupLots(lots: Array<LotInput & Partial<LotResult>>): LotRollup {
  const results = lots.map((l) => ({ in: l, out: computeLot(l) }));
  const totalArea = sum(results.map((r) => r.in.areaM2));
  const totalRevenue = sum(results.map((r) => r.out.totalSalesPrice));
  const totalCost = sum(results.map((r) => r.out.totalAllocatedCost));
  const totalProfit = totalRevenue - totalCost;
  return {
    count: lots.length,
    totalArea,
    totalRevenue,
    totalCost,
    totalProfit,
    weightedAvgSalesPricePerM2: safeDiv(totalRevenue, totalArea),
    weightedAvgCostPerM2: safeDiv(totalCost, totalArea),
    avgMarginPct: safeDiv(totalProfit, totalRevenue) * 100,
  };
}

/* ── 5. Units / building products ─────────────────────────────────────────── */

export type UnitComponent = {
  area: number;
  constructionCostPerM2: number;
  salesPricePerM2: number;
};

export type UnitTypeInput = {
  quantity: number;
  components: UnitComponent[];
};

export type UnitResult = {
  totalArea: number;
  constructionCostPerUnit: number;
  salesPricePerUnit: number;
  profitPerUnit: number;
  marginPct: number; // 0..100
  totalConstructionCost: number; // × quantity
  totalSalesPrice: number; // × quantity
  totalProfit: number; // × quantity
};

/**
 * unitTotalArea       = Σ componentArea
 * unitConstructionCost= Σ componentArea × constructionCostPerM2
 * unitSalesPrice      = Σ componentArea × salesPricePerM2
 * unitProfit          = sales − cost
 */
export function computeUnit(input: UnitTypeInput): UnitResult {
  const totalArea = sum(input.components.map((c) => c.area));
  const constructionCostPerUnit = sum(input.components.map((c) => c.area * c.constructionCostPerM2));
  const salesPricePerUnit = sum(input.components.map((c) => c.area * c.salesPricePerM2));
  const profitPerUnit = salesPricePerUnit - constructionCostPerUnit;
  const qty = input.quantity;
  return {
    totalArea,
    constructionCostPerUnit,
    salesPricePerUnit,
    profitPerUnit,
    marginPct: safeDiv(profitPerUnit, salesPricePerUnit) * 100,
    totalConstructionCost: constructionCostPerUnit * qty,
    totalSalesPrice: salesPricePerUnit * qty,
    totalProfit: profitPerUnit * qty,
  };
}

/* ── 6. Combined lot + unit feasibility ───────────────────────────────────── */

export type CombinedInput = {
  lotSalesPrice: number;
  lotAllocatedCost: number;
  unitSalesPrice: number;
  unitConstructionCost: number;
};

export type CombinedResult = {
  combinedSalesPrice: number;
  combinedCost: number;
  combinedProfit: number;
  marginPct: number;
  roiPct: number;
};

export function computeCombined(input: CombinedInput): CombinedResult {
  const combinedSalesPrice = input.lotSalesPrice + input.unitSalesPrice;
  const combinedCost = input.lotAllocatedCost + input.unitConstructionCost;
  const combinedProfit = combinedSalesPrice - combinedCost;
  return {
    combinedSalesPrice,
    combinedCost,
    combinedProfit,
    marginPct: safeDiv(combinedProfit, combinedSalesPrice) * 100,
    roiPct: safeDiv(combinedProfit, combinedCost) * 100,
  };
}

/* ── 11 + 6. Project-level feasibility metrics ────────────────────────────── */

export type FeasibilityInput = {
  totalProjectCost: number;
  totalRevenue: number;
  netSellableLand: number;
  /** target developer margin (whole %) for the minimum-price metric. */
  targetMarginPct?: number;
};

export type FeasibilityResult = {
  grossProfit: number;
  netProfit: number;
  roiPct: number; // netProfit / totalProjectCost
  grossMarginPct: number; // netProfit / totalRevenue
  breakEvenSalesPricePerM2: number; // totalProjectCost / netSellableLand
  minPricePerM2ForTargetMargin: number;
};

export function computeFeasibility(input: FeasibilityInput): FeasibilityResult {
  const grossProfit = input.totalRevenue - input.totalProjectCost;
  const target = input.targetMarginPct ?? 0;
  // price such that (price·area − cost)/(price·area) = target  ⇒ price = cost / (area·(1−target))
  const minPricePerM2ForTargetMargin = safeDiv(
    input.totalProjectCost,
    input.netSellableLand * (1 - target / 100),
  );
  return {
    grossProfit,
    netProfit: grossProfit,
    roiPct: safeDiv(grossProfit, input.totalProjectCost) * 100,
    grossMarginPct: safeDiv(grossProfit, input.totalRevenue) * 100,
    breakEvenSalesPricePerM2: safeDiv(input.totalProjectCost, input.netSellableLand),
    minPricePerM2ForTargetMargin,
  };
}

/* ── 6. Sensitivity grid ──────────────────────────────────────────────────── */

export type SensitivityCell = { label: string; deltaPct: number; revenue: number; cost: number; profit: number; roiPct: number };

/**
 * Sensitivity of profit/ROI to ±% swings in sales price and construction cost.
 * Returns one row per requested delta for each axis (default ±5%, ±10%).
 */
export function sensitivity(
  baseRevenue: number,
  baseCost: number,
  deltas: number[] = [-10, -5, 0, 5, 10],
): { price: SensitivityCell[]; cost: SensitivityCell[] } {
  const price = deltas.map((d) => {
    const revenue = baseRevenue * (1 + d / 100);
    const profit = revenue - baseCost;
    return { label: `Price ${d > 0 ? "+" : ""}${d}%`, deltaPct: d, revenue, cost: baseCost, profit, roiPct: safeDiv(profit, baseCost) * 100 };
  });
  const cost = deltas.map((d) => {
    const c = baseCost * (1 + d / 100);
    const profit = baseRevenue - c;
    return { label: `Cost ${d > 0 ? "+" : ""}${d}%`, deltaPct: d, revenue: baseRevenue, cost: c, profit, roiPct: safeDiv(profit, c) * 100 };
  });
  return { price, cost };
}

/* ── 12. Scenario engine ──────────────────────────────────────────────────── */

export type ScenarioVars = {
  landPurchasePrice: number;
  salesPricePerM2: number;
  constructionCostPerM2: number;
  infrastructureCost: number;
  softCostPct: number;
  financingRatePct: number;
  contingencyPct: number;
  netSellableLand: number;
  unitConstructionArea?: number; // Σ unit floor area across all units
  unitCount?: number;
};

export type ScenarioResult = {
  revenue: number;
  cost: number;
  profit: number;
  roiPct: number;
  marginPct: number;
  breakEvenSalesPricePerM2: number;
};

/**
 * Evaluate a development scenario end-to-end from its driver variables.
 * cost = land + infra + (units×area×constructionRate) + soft% + contingency% + financing%.
 */
export function evaluateScenario(v: ScenarioVars): ScenarioResult {
  const parcelRevenue = v.netSellableLand * v.salesPricePerM2;
  const unitArea = (v.unitConstructionArea ?? 0) * (v.unitCount ?? 0);
  const constructionCost = unitArea * v.constructionCostPerM2;
  const hardCost = v.landPurchasePrice + v.infrastructureCost + constructionCost;
  const softCost = pct(hardCost, v.softCostPct);
  const subtotal = hardCost + softCost;
  const contingency = pct(subtotal, v.contingencyPct);
  const financing = pct(subtotal + contingency, v.financingRatePct);
  const cost = subtotal + contingency + financing;
  const revenue = parcelRevenue; // unit revenue handled by combined model when units priced separately
  const profit = revenue - cost;
  return {
    revenue,
    cost,
    profit,
    roiPct: safeDiv(profit, cost) * 100,
    marginPct: safeDiv(profit, revenue) * 100,
    breakEvenSalesPricePerM2: safeDiv(cost, v.netSellableLand),
  };
}

/* ── 10. Cash flow ────────────────────────────────────────────────────────── */

export type CashFlowMonthInput = {
  month: string; // "2026-01"
  acquisitionCost?: number;
  consultantCost?: number;
  permitCost?: number;
  infrastructureCost?: number;
  constructionCost?: number;
  marketingCost?: number;
  financingCost?: number;
  salesIncome?: number;
  depositIncome?: number;
  loanDraw?: number;
  loanRepayment?: number;
};

export type CashFlowMonthResult = CashFlowMonthInput & {
  openingCash: number;
  outflows: number;
  inflows: number;
  netCashFlow: number;
  closingCash: number;
  cumulativeCashNeed: number; // most-negative closing seen so far (≥0 magnitude)
};

export type CashFlowResult = {
  months: CashFlowMonthResult[];
  peakCapitalRequirement: number; // most negative closing cash (as positive magnitude)
  peakNegativeMonth: string | null;
  breakEvenMonth: string | null; // first month cumulative net ≥ 0 after going negative
  paybackMonth: string | null;
};

/** Roll a sequence of monthly in/out flows into a running cash position. */
export function computeCashFlow(months: CashFlowMonthInput[], openingCash = 0): CashFlowResult {
  let running = openingCash;
  let peak = 0;
  let peakMonth: string | null = null;
  let wentNegative = false;
  let breakEvenMonth: string | null = null;
  let paybackMonth: string | null = null;

  const rows: CashFlowMonthResult[] = months.map((m) => {
    const opening = running;
    const outflows = sum([
      m.acquisitionCost, m.consultantCost, m.permitCost, m.infrastructureCost,
      m.constructionCost, m.marketingCost, m.financingCost, m.loanRepayment,
    ]);
    const inflows = sum([m.salesIncome, m.depositIncome, m.loanDraw]);
    const netCashFlow = inflows - outflows;
    running = opening + netCashFlow;
    if (running < peak) { peak = running; peakMonth = m.month; }
    if (running < 0) wentNegative = true;
    if (wentNegative && running >= 0 && breakEvenMonth == null) breakEvenMonth = m.month;
    if (running >= 0 && paybackMonth == null && wentNegative) paybackMonth = m.month;
    return {
      ...m,
      openingCash: opening,
      outflows,
      inflows,
      netCashFlow,
      closingCash: running,
      cumulativeCashNeed: Math.abs(Math.min(0, peak)),
    };
  });

  return {
    months: rows,
    peakCapitalRequirement: Math.abs(Math.min(0, peak)),
    peakNegativeMonth: peakMonth,
    breakEvenMonth,
    paybackMonth,
  };
}

/* ── 9. Sales / absorption ────────────────────────────────────────────────── */

export type SalesRollupInput = {
  totalLots: number;
  reserved: number;
  sold: number;
  closed: number;
  totalSalesValue: number;
  depositsCollected: number;
  /** lots sold per month, for velocity/absorption. */
  soldPerMonth?: number;
};

export type SalesRollupResult = {
  available: number;
  reserved: number;
  sold: number;
  closed: number;
  totalSalesValue: number;
  depositsCollected: number;
  balanceReceivable: number;
  absorptionRatePct: number; // (sold+closed)/total
  salesVelocity: number; // lots/month
  projectedSelloutMonths: number | null;
};

export function rollupSales(input: SalesRollupInput): SalesRollupResult {
  const placed = input.reserved + input.sold + input.closed;
  const available = Math.max(0, input.totalLots - placed);
  const velocity = input.soldPerMonth ?? 0;
  return {
    available,
    reserved: input.reserved,
    sold: input.sold,
    closed: input.closed,
    totalSalesValue: input.totalSalesValue,
    depositsCollected: input.depositsCollected,
    balanceReceivable: input.totalSalesValue - input.depositsCollected,
    absorptionRatePct: safeDiv(input.sold + input.closed, input.totalLots) * 100,
    salesVelocity: velocity,
    projectedSelloutMonths: velocity > 0 ? round(available / velocity, 1) : null,
  };
}
