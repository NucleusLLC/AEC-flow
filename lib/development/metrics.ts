/**
 * Land Development — derived project metrics (client-safe).
 *
 * Composes the pure calc engine (`./calc`) over a full project DTO to produce
 * everything the dashboard, list cards and reports display. No DB import, so the
 * dashboard view can recompute client-side too.
 */
import {
  computeLandUse,
  computeFeasibility,
  computeUnit,
  rollupLots,
  computeCostLine,
  rollupSales,
  sum,
} from "@/lib/development/calc";
import type { DevelopmentProjectFull } from "@/lib/data/development.types";
import { COST_CODES } from "@/lib/development/calc";

export type ProjectMetrics = {
  currency: string;
  grossParcelArea: number;
  netSellableLand: number;
  sellableRatioPct: number;
  totalLots: number;
  totalUnits: number;
  totalProjectCost: number;
  costPerNetM2: number;
  totalRevenue: number; // lots + units
  lotRevenue: number;
  unitRevenue: number;
  totalProfit: number;
  grossMarginPct: number;
  roiPct: number;
  breakEvenPerM2: number;
  // budget
  budgetTotal: number;
  budgetPaid: number;
  budgetUsedPct: number;
  budgetByCode: Array<{ code: number; name: string; budget: number; paid: number }>;
  budgetOverruns: number;
  // permits
  permitTotal: number;
  permitDone: number;
  permitProgressPct: number;
  // sales
  lotsAvailable: number;
  lotsReserved: number;
  lotsSold: number;
  lotsClosed: number;
  salesProgressPct: number;
  cashCollected: number;
  outstandingReceivables: number;
  // chart series
  revenueVsCost: { revenue: number; cost: number; profit: number };
  salesStatus: Array<{ name: string; value: number }>;
  profitByLot: Array<{ lot: string; profit: number }>;
  warnings: string[];
};

export function deriveProjectMetrics(full: DevelopmentProjectFull): ProjectMetrics {
  const land = full.landUse;
  const landUse = land
    ? computeLandUse({ ...land, lotCount: full.lots.length })
    : computeLandUse({ grossParcelArea: full.totalParcelArea, lotCount: full.lots.length });

  const budgetLines = full.budget.map((b) => ({ ...b, calc: computeCostLine(b) }));
  const totalProjectCost = sum(budgetLines.map((b) => b.calc.budget));
  const budgetPaid = sum(budgetLines.map((b) => b.calc.actualPaid));
  const costPerNetM2 = landUse.netSellableLand ? totalProjectCost / landUse.netSellableLand : 0;

  // Lots — allocate project cost per net m² when explicit allocations are absent.
  const lotResults = full.lots.map((l) => ({
    lot: l,
    r: rollupLots([{
      areaM2: l.areaM2,
      baseLandPricePerM2: l.baseLandPricePerM2,
      premiumAdjustmentPerM2: l.premiumAdjustmentPerM2,
      allocatedLandCost: l.allocatedLandCost || undefined,
      allocatedInfraCost: l.allocatedInfraCost || undefined,
      allocatedSoftCost: l.allocatedSoftCost || undefined,
      allocatedCostPerM2: costPerNetM2,
    }]),
  }));
  const lotRevenue = sum(lotResults.map((x) => x.r.totalRevenue));

  // Units
  const unitResults = full.unitTypes.map((u) => computeUnit(u));
  const totalUnits = sum(full.unitTypes.map((u) => u.quantity));
  const unitRevenue = sum(unitResults.map((u) => u.totalSalesPrice));
  const unitProfit = sum(unitResults.map((u) => u.totalProfit));

  const feas = computeFeasibility({ totalProjectCost, totalRevenue: lotRevenue, netSellableLand: landUse.netSellableLand });
  const totalRevenue = lotRevenue + unitRevenue;
  const totalProfit = feas.grossProfit + unitProfit;

  // Sales
  const lotsSold = full.lots.filter((l) => l.status === "SOLD").length;
  const lotsClosed = full.lots.filter((l) => l.status === "CLOSED").length;
  const lotsReserved = full.lots.filter((l) => l.status === "RESERVED" || l.status === "OPTIONED").length;
  const placedValue = sum(
    full.lots
      .filter((l) => l.status === "SOLD" || l.status === "CLOSED")
      .map((l) => l.areaM2 * (l.baseLandPricePerM2 + l.premiumAdjustmentPerM2)),
  );
  const cashCollected = sum(
    full.lots.map((l) =>
      l.status === "SOLD" || l.status === "CLOSED"
        ? l.areaM2 * (l.baseLandPricePerM2 + l.premiumAdjustmentPerM2) * (l.depositPct / 100)
        : 0,
    ),
  );
  const sales = rollupSales({
    totalLots: full.lots.length,
    reserved: lotsReserved,
    sold: lotsSold,
    closed: lotsClosed,
    totalSalesValue: placedValue,
    depositsCollected: cashCollected,
  });

  // Budget roll-up by cost code
  const codeName = new Map<number, string>(COST_CODES.map((c) => [c.code, c.name]));
  const byCodeMap = new Map<number, { budget: number; paid: number }>();
  for (const b of budgetLines) {
    const cur = byCodeMap.get(b.costCode) ?? { budget: 0, paid: 0 };
    cur.budget += b.calc.budget;
    cur.paid += b.calc.actualPaid;
    byCodeMap.set(b.costCode, cur);
  }
  const budgetByCode = [...byCodeMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([code, v]) => ({ code, name: codeName.get(code) ?? `Code ${code}`, budget: v.budget, paid: v.paid }));

  const permitDone = full.permits.filter((p) => p.status === "APPROVED" || p.status === "DONE").length;

  return {
    currency: full.currency,
    grossParcelArea: landUse.grossParcelArea,
    netSellableLand: landUse.netSellableLand,
    sellableRatioPct: landUse.netSellableRatio * 100,
    totalLots: full.lots.length,
    totalUnits,
    totalProjectCost,
    costPerNetM2,
    totalRevenue,
    lotRevenue,
    unitRevenue,
    totalProfit,
    grossMarginPct: totalRevenue ? (totalProfit / totalRevenue) * 100 : 0,
    roiPct: totalProjectCost ? (totalProfit / totalProjectCost) * 100 : 0,
    breakEvenPerM2: feas.breakEvenSalesPricePerM2,
    budgetTotal: totalProjectCost,
    budgetPaid,
    budgetUsedPct: totalProjectCost ? (budgetPaid / totalProjectCost) * 100 : 0,
    budgetByCode,
    budgetOverruns: budgetLines.filter((b) => b.calc.overBudget).length,
    permitTotal: full.permits.length,
    permitDone,
    permitProgressPct: full.permits.length ? (permitDone / full.permits.length) * 100 : 0,
    lotsAvailable: sales.available,
    lotsReserved,
    lotsSold,
    lotsClosed,
    salesProgressPct: sales.absorptionRatePct,
    cashCollected,
    outstandingReceivables: sales.balanceReceivable,
    revenueVsCost: { revenue: totalRevenue, cost: totalProjectCost, profit: totalProfit },
    salesStatus: [
      { name: "Available", value: sales.available },
      { name: "Reserved", value: lotsReserved },
      { name: "Sold", value: lotsSold },
      { name: "Closed", value: lotsClosed },
    ],
    profitByLot: lotResults.map((x) => ({ lot: x.lot.lotNumber, profit: x.r.totalProfit })),
    warnings: landUse.warnings,
  };
}
