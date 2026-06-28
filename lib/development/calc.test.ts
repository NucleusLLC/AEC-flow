/**
 * Unit tests for the Land Development / Parceling calculation engine.
 * Run with:  npx tsx --test lib/development/calc.test.ts
 *
 * The headline assertions reconcile to the Morgenster (2023A-038) reference
 * worksheet (spec §18). All figures verified to tie out:
 *   net sellable land   = 4,404 m²
 *   cost / net sellable = AWG 363.62 /m²
 *   profit / m²         = AWG 86.38
 *   profit on parcels   = AWG 380,426.40
 *   profit per home     = AWG 78,867   (× 13 = 1,025,271)
 *   total project profit= AWG 1,405,697.40
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeLandUse,
  computeAcquisition,
  computeLot,
  rollupLots,
  computeUnit,
  computeCombined,
  computeFeasibility,
  sensitivity,
  evaluateScenario,
  computeCashFlow,
  rollupSales,
  safeDiv,
  pct,
  sum,
} from "./calc";

const close = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol;

/* ── Morgenster reference figures ─────────────────────────────────────────── */

const GROSS = 5844;
const ROAD = 1440;
const NET = 4404;
const ACQUISITION = 642_840;
const INFRA = 441_000;
const EXPERT = 517_533.6;
const TOTAL_PROJECT_COST = ACQUISITION + INFRA + EXPERT; // 1,601,373.60
const SALES_PER_M2 = 450;

test("land use — net sellable land and ratio (Morgenster)", () => {
  const r = computeLandUse({ grossParcelArea: GROSS, roadArea: ROAD, lotCount: 13 });
  assert.equal(r.netSellableLand, NET);
  assert.equal(r.nonSellableLandTotal, ROAD);
  assert.ok(close(r.netSellableRatio, 0.7536, 0.0001), `ratio ${r.netSellableRatio}`);
  assert.ok(close(r.roadPct, 24.64, 0.01), `roadPct ${r.roadPct}`);
});

test("land use — warnings fire for low sellable ratio and green shortfall", () => {
  const r = computeLandUse({ grossParcelArea: 1000, roadArea: 500, greenArea: 10, requiredGreenPct: 15 });
  assert.ok(r.warnings.some((w) => w.includes("Net sellable ratio")));
  assert.ok(r.warnings.some((w) => w.includes("Green area")));
});

test("acquisition — cost per gross m² = AWG 110 (Morgenster)", () => {
  const r = computeAcquisition({ parcelAcquisitionCost: ACQUISITION }, GROSS, NET);
  assert.equal(r.totalAcquisitionCost, ACQUISITION);
  assert.ok(close(r.costPerGrossM2, 110, 0.001), `perGross ${r.costPerGrossM2}`);
  assert.ok(close(r.costPerNetSellableM2, 145.9673, 0.001), `perNet ${r.costPerNetSellableM2}`);
});

test("acquisition — contingency is applied on the subtotal", () => {
  const r = computeAcquisition({ parcelAcquisitionCost: 100_000, notaryCost: 0, contingencyPct: 10 }, 1000, 800);
  assert.equal(r.subtotal, 100_000);
  assert.equal(r.contingency, 10_000);
  assert.equal(r.totalAcquisitionCost, 110_000);
});

test("feasibility — cost/net-m², break-even and parcel profit (Morgenster)", () => {
  const f = computeFeasibility({
    totalProjectCost: TOTAL_PROJECT_COST,
    totalRevenue: NET * SALES_PER_M2, // 1,981,800
    netSellableLand: NET,
  });
  assert.ok(close(f.breakEvenSalesPricePerM2, 363.62, 0.01), `breakEven ${f.breakEvenSalesPricePerM2}`);
  // profit/m² = 450 − 363.62 = 86.38
  assert.ok(close(SALES_PER_M2 - f.breakEvenSalesPricePerM2, 86.38, 0.01));
  // total parcel profit
  assert.ok(close(f.grossProfit, 380_426.4, 0.01), `parcelProfit ${f.grossProfit}`);
});

test("lot — sales, allocated cost, profit and margin (whole-parcel lot)", () => {
  const r = computeLot({
    areaM2: NET,
    baseLandPricePerM2: SALES_PER_M2,
    allocatedCostPerM2: safeDiv(TOTAL_PROJECT_COST, NET),
  });
  assert.equal(r.totalSalesPrice, 1_981_800);
  assert.ok(close(r.totalAllocatedCost, TOTAL_PROJECT_COST, 0.01));
  assert.ok(close(r.grossProfit, 380_426.4, 0.01), `profit ${r.grossProfit}`);
  assert.ok(close(r.grossMarginPct, 19.19, 0.01), `margin ${r.grossMarginPct}`);
});

test("lot — below-cost and negative-margin warnings", () => {
  const r = computeLot({ areaM2: 100, baseLandPricePerM2: 300, allocatedCostPerM2: 363.62 });
  assert.ok(r.belowCost);
  assert.ok(r.warnings.some((w) => w.includes("below allocated cost")));
  assert.ok(r.warnings.some((w) => w.includes("Negative margin")));
});

test("lot rollup — weighted averages across lots", () => {
  const r = rollupLots([
    { areaM2: 200, baseLandPricePerM2: 450, allocatedCostPerM2: 363.62 },
    { areaM2: 300, baseLandPricePerM2: 500, allocatedCostPerM2: 363.62 },
  ]);
  assert.equal(r.count, 2);
  assert.equal(r.totalArea, 500);
  // revenue = 200·450 + 300·500 = 240,000
  assert.equal(r.totalRevenue, 240_000);
  assert.ok(close(r.weightedAvgSalesPricePerM2, 480, 0.001));
});

test("unit — Coriara/Morgenster home: cost 153,352.50, sales 232,219.50, profit 78,867", () => {
  const u = computeUnit({
    quantity: 13,
    components: [{ area: 87.63, constructionCostPerM2: 1750, salesPricePerM2: 2650 }],
  });
  assert.ok(close(u.constructionCostPerUnit, 153_352.5, 0.01), `cc ${u.constructionCostPerUnit}`);
  assert.ok(close(u.salesPricePerUnit, 232_219.5, 0.01), `sp ${u.salesPricePerUnit}`);
  assert.ok(close(u.profitPerUnit, 78_867, 0.01), `pp ${u.profitPerUnit}`);
  assert.ok(close(u.totalProfit, 1_025_271, 0.01), `tp ${u.totalProfit}`);
  assert.ok(close(u.totalConstructionCost, 1_993_582.5, 0.01));
});

test("total project profit = parcel profit + home profit = AWG 1,405,697.40", () => {
  const parcel = computeFeasibility({
    totalProjectCost: TOTAL_PROJECT_COST,
    totalRevenue: NET * SALES_PER_M2,
    netSellableLand: NET,
  }).grossProfit;
  const homes = computeUnit({
    quantity: 13,
    components: [{ area: 87.63, constructionCostPerM2: 1750, salesPricePerM2: 2650 }],
  }).totalProfit;
  assert.ok(close(parcel + homes, 1_405_697.4, 0.01), `total ${parcel + homes}`);
});

test("combined — lot + unit feasibility", () => {
  const c = computeCombined({
    lotSalesPrice: 100_000,
    lotAllocatedCost: 60_000,
    unitSalesPrice: 232_219.5,
    unitConstructionCost: 153_352.5,
  });
  assert.equal(c.combinedSalesPrice, 332_219.5);
  assert.equal(c.combinedCost, 213_352.5);
  assert.ok(close(c.combinedProfit, 118_867, 0.01));
});

test("feasibility — minimum price/m² for a target margin", () => {
  const f = computeFeasibility({
    totalProjectCost: TOTAL_PROJECT_COST,
    totalRevenue: NET * SALES_PER_M2,
    netSellableLand: NET,
    targetMarginPct: 20,
  });
  // price = cost / (area·(1−0.20)) = 363.62 / 0.8 = 454.53
  assert.ok(close(f.minPricePerM2ForTargetMargin, 454.53, 0.02), `min ${f.minPricePerM2ForTargetMargin}`);
});

test("sensitivity — ±5/10% on price and cost", () => {
  const s = sensitivity(1_981_800, 1_601_373.6);
  const base = s.price.find((c) => c.deltaPct === 0)!;
  assert.ok(close(base.profit, 380_426.4, 0.01));
  const up10 = s.price.find((c) => c.deltaPct === 10)!;
  assert.ok(up10.profit > base.profit);
  const costUp10 = s.cost.find((c) => c.deltaPct === 10)!;
  assert.ok(costUp10.profit < base.profit);
});

test("scenario — drivers produce revenue/cost/profit/ROI", () => {
  const r = evaluateScenario({
    landPurchasePrice: ACQUISITION,
    salesPricePerM2: SALES_PER_M2,
    constructionCostPerM2: 0,
    infrastructureCost: INFRA,
    softCostPct: 0,
    financingRatePct: 0,
    contingencyPct: 0,
    netSellableLand: NET,
  });
  assert.equal(r.revenue, NET * SALES_PER_M2);
  assert.equal(r.cost, ACQUISITION + INFRA); // 1,083,840 (no soft/expert here)
  assert.ok(r.profit > 0);
});

test("cash flow — running position, peak capital and break-even month", () => {
  const r = computeCashFlow(
    [
      { month: "2026-01", acquisitionCost: 600_000 },
      { month: "2026-02", infrastructureCost: 400_000 },
      { month: "2026-03", salesIncome: 500_000 },
      { month: "2026-04", salesIncome: 700_000 },
      { month: "2026-05", salesIncome: 400_000 },
    ],
    0,
  );
  assert.equal(r.months[0].closingCash, -600_000);
  assert.equal(r.months[1].closingCash, -1_000_000);
  assert.equal(r.peakCapitalRequirement, 1_000_000);
  assert.equal(r.peakNegativeMonth, "2026-02");
  assert.equal(r.breakEvenMonth, "2026-04"); // cumulative crosses ≥0 in April
});

test("sales rollup — availability, absorption and sellout projection", () => {
  const r = rollupSales({
    totalLots: 13,
    reserved: 2,
    sold: 4,
    closed: 1,
    totalSalesValue: 1_000_000,
    depositsCollected: 250_000,
    soldPerMonth: 1.5,
  });
  assert.equal(r.available, 6);
  assert.equal(r.balanceReceivable, 750_000);
  assert.ok(close(r.absorptionRatePct, 38.46, 0.01));
  assert.equal(r.projectedSelloutMonths, 4); // 6 / 1.5
});

test("pure helpers — sum/safeDiv/pct edge cases", () => {
  assert.equal(sum([1, null, 2, undefined, NaN, 3]), 6);
  assert.equal(safeDiv(10, 0), 0);
  assert.equal(pct(200, 5), 10);
});
