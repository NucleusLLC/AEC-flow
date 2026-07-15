/**
 * Self-checking verification for the estimate Calculation Engine / Method Resolver.
 * Guards two invariants:
 *   1. Norm-Based behaviour is byte-identical to the pre-engine formula (no regression).
 *   2. Labor/Rate decouples labour COST from labour HOURS, so the Schedule Coupler
 *      (which reads hours) stays consistent across methods.
 *
 * Run:  npm run verify:calc
 *
 * (The lib now imports through the `@/` alias, so ts-node needs tsconfig-paths —
 * without it the run dies on "Cannot find module '@/lib/data/general-conditions'".)
 */
import { calcItem, resolveLineLabor, estimateTotals } from "../lib/estimates/calc";
import { computeSections, computeDraws, computeDevelopmentCost, computeGrandCost, computeSchedule } from "../lib/estimates/budget-timeline";
import type { PaymentConfig, ScheduleConfig } from "../lib/estimates/budget-timeline";
import type { CostEstimate, EstimateItem } from "../lib/data/estimates";

let failures = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) failures++;
}

const RATE = 50;
const baseItem = (over: Partial<EstimateItem> = {}): EstimateItem => ({
  id: "i",
  task: "Test",
  qty: 10,
  unit: "m²",
  laborNorm: 2, // 2 hrs/unit → 20 hrs
  materialUnitCost: 5,
  equipmentUnitCost: 3,
  subcontractUnitCost: 1,
  poc: 0,
  ...over,
});

// 1. Norm-Based (method unset) — exactly the original formula.
{
  const it = baseItem();
  const c = calcItem(it, RATE);
  check("norm: hrs = qty × laborNorm", c.hrs === 20);
  check("norm: labor = hrs × rate", c.labor === 1000);
  check("norm: mat/equip/sub = qty × unit", c.mat === 50 && c.equip === 30 && c.sub === 10);
  check("norm: total = labor+mat+equip+sub", c.total === 1090);
}

// 2. Explicit "norm" === unset norm (default behaviour unchanged).
{
  const a = calcItem(baseItem(), RATE);
  const b = calcItem(baseItem({ calculationMethod: "norm" }), RATE);
  check("explicit norm identical to default", JSON.stringify(a) === JSON.stringify(b));
}

// 3. Labor/Rate — labour cost from rate/unit; hours unchanged.
{
  const it = baseItem({ calculationMethod: "labor_rate", laborRatePerUnit: 80 });
  const c = calcItem(it, RATE);
  check("labor_rate: labor = qty × laborRatePerUnit", c.labor === 800);
  check("labor_rate: hrs still = qty × laborNorm (schedule-consistent)", c.hrs === 20);
  check("labor_rate: material columns untouched", c.mat === 50 && c.equip === 30 && c.sub === 10);
  check("labor_rate: total uses the new labor", c.total === 800 + 50 + 30 + 10);
}

// 4. Labor/Rate hours match Norm-Based hours for the same qty/laborNorm (the invariant the
//    Schedule Coupler depends on).
{
  const normHrs = resolveLineLabor(baseItem(), RATE).hrs;
  const lrHrs = resolveLineLabor(baseItem({ calculationMethod: "labor_rate", laborRatePerUnit: 80 }), RATE).hrs;
  check("labor_rate hours == norm hours (same inputs)", normHrs === lrHrs && lrHrs === 20);
}

// 5. Missing laborRatePerUnit → labour 0 (no NaN), hours still derived.
{
  const c = calcItem(baseItem({ calculationMethod: "labor_rate" }), RATE);
  check("labor_rate without rate → labor 0 (no NaN)", c.labor === 0 && !Number.isNaN(c.labor));
  check("labor_rate without rate → hrs still 20", c.hrs === 20);
}

// 6. Roll-up unchanged for an all-Norm estimate (Direct → markup → profit → BBO → grand).
{
  const est: CostEstimate = {
    id: "e1",
    projectId: null,
    projectName: "Verify",
    version: "V1",
    date: "2026-01-01",
    location: "—",
    currency: "AED",
    avgLaborRate: RATE,
    profitPct: 10,
    bboPct: 5,
    categories: [{ id: "c1", name: "S", items: [baseItem(), baseItem({ id: "i2", qty: 4 })] }],
  };
  const t = estimateTotals(est);
  // item1 total 1090; item2: hrs 8 → labor 400, mat 20, equip 12, sub 4 → 436. direct 1526.
  check("rollup: direct = Σ item totals", t.direct === 1090 + 436);
  check("rollup: markupBase = direct (no GC)", t.markupBase === t.direct);
  check("rollup: profit = base × 10%", Math.abs(t.profit - t.markupBase * 0.1) < 1e-9);
  check("rollup: bbo = base × 5%", Math.abs(t.bbo - t.markupBase * 0.05) < 1e-9);
  check("rollup: grand = base + profit + bbo", Math.abs(t.grandTotal - (t.markupBase + t.profit + t.bbo)) < 1e-9);
}

// 6b. Assembly-Based — components distribute into the four columns; "other" → subcontract;
//     labour components carry hours; total = labor+mat+equip+sub (columns sum to total).
{
  const it = baseItem({
    calculationMethod: "assembly",
    qty: 2, // 2 assembly units
    assembly: [
      { id: "a1", name: "Mason", type: "labor", qty: 3, unitCost: 40 },      // 2×3×40 = 240 labor, 6 hrs
      { id: "a2", name: "Block", type: "material", qty: 10, unitCost: 5 },    // 2×10×5 = 100 mat
      { id: "a3", name: "Mixer", type: "equipment", qty: 1, unitCost: 25 },   // 2×1×25 = 50 equip
      { id: "a4", name: "Crane sub", type: "subcontract", qty: 1, unitCost: 30 }, // 60 sub
      { id: "a5", name: "Permit", type: "other", qty: 1, unitCost: 20 },      // 40 → folds into sub
    ],
  });
  const c = calcItem(it, RATE);
  check("assembly: labor = Σ labor comps", c.labor === 240);
  check("assembly: hrs = Σ (units × labor qty)", c.hrs === 6);
  check("assembly: material bucket", c.mat === 100);
  check("assembly: equipment bucket", c.equip === 50);
  check("assembly: subcontract incl. other", c.sub === 60 + 40);
  check("assembly: total = labor+mat+equip+sub", c.total === 240 + 100 + 50 + 100);
  check("assembly: columns sum to total (no hidden bucket)", c.labor + c.mat + c.equip + c.sub === c.total);
  check("assembly: empty components → all zero, no NaN", (() => { const z = calcItem(baseItem({ calculationMethod: "assembly", assembly: [] }), RATE); return z.total === 0 && !Number.isNaN(z.total); })());
}

// 6c. Hybrid — an estimate mixing methods rolls up with the SAME formula (no special total).
{
  const est: CostEstimate = {
    id: "eh", projectId: null, projectName: "Hybrid", version: "V1", date: "2026-01-01",
    location: "—", currency: "AED", avgLaborRate: RATE, profitPct: 10, bboPct: 5,
    categories: [{ id: "c1", name: "Mixed", items: [
      baseItem({ id: "h1" }),                                                        // norm
      baseItem({ id: "h2", calculationMethod: "labor_rate", laborRatePerUnit: 80 }), // labor_rate
      baseItem({ id: "h3", calculationMethod: "assembly", qty: 1, assembly: [
        { id: "x", name: "L", type: "labor", qty: 2, unitCost: 50 },
      ] }),                                                                          // assembly
    ] }],
  };
  const t = estimateTotals(est);
  const manual = est.categories[0].items.reduce((a, it) => a + calcItem(it, RATE).total, 0);
  check("hybrid: direct = Σ per-line calcItem totals (mixed methods)", t.direct === manual);
  check("hybrid: grand = base + profit + bbo (unchanged formula)", Math.abs(t.grandTotal - (t.markupBase * 1.15)) < 1e-9);
}

// 7. Schedule Coupler (computeSections) now flows through calcItem — its per-section
//    hours/cost must equal the calcItem roll-up for BOTH methods (the 1d unification).
{
  const norm = baseItem({ id: "n" });
  const lr = baseItem({ id: "r", calculationMethod: "labor_rate", laborRatePerUnit: 80 });
  const est: CostEstimate = {
    id: "e2", projectId: null, projectName: "Sched", version: "V1", date: "2026-01-01",
    location: "—", currency: "AED", avgLaborRate: RATE, profitPct: 0, bboPct: 0,
    categories: [{ id: "c1", name: "S", items: [norm, lr] }],
  };
  const sec = computeSections(est)[0];
  const expHours = calcItem(norm, RATE).hrs + calcItem(lr, RATE).hrs;
  const expCost = calcItem(norm, RATE).total + calcItem(lr, RATE).total;
  check("schedule: section hours == Σ calcItem hrs", sec.hours === expHours);
  check("schedule: section cost == Σ calcItem total (reflects Labor/Rate)", sec.cost === expCost);
  // Labor/Rate must not change hours vs the same row as Norm (Coupler stays stable).
  check("schedule: labor_rate hrs == norm hrs for same inputs", calcItem(lr, RATE).hrs === calcItem(norm, RATE).hrs);
}

// 8. Retainage (computeDraws): OFF by default; auto = global %; manual = per-phase %.
{
  const est: CostEstimate = {
    id: "er", projectId: null, projectName: "Retainage", version: "V1", date: "2026-01-01",
    location: "—", currency: "AED", avgLaborRate: RATE, profitPct: 0, bboPct: 0,
    categories: [{ id: "c1", name: "S", items: [baseItem()] }], // one item → direct 1090
  };
  const basePay = (over: Partial<PaymentConfig>): PaymentConfig => ({
    retention: 10, retentionEnabled: false, retentionMode: "auto",
    phases: [{ id: "p1", name: "All", pct: 100, milestone: "" }],
    ...over,
  });
  const off = computeDraws(est, basePay({}));
  check("retainage OFF → nothing held", off.totalHeld === 0 && off.rows.every((r) => r.held === 0));
  check("retainage OFF → net == full draw", off.rows[0].net === off.rows[0].amount);

  const auto = computeDraws(est, basePay({ retentionEnabled: true }));
  check("retainage AUTO 10% → held = 10% of draw", Math.abs(auto.rows[0].held - auto.rows[0].amount * 0.1) < 1e-9);

  const manual = computeDraws(est, basePay({
    retentionEnabled: true, retentionMode: "manual",
    phases: [{ id: "p1", name: "All", pct: 100, milestone: "", retentionPct: 5 }],
  }));
  check("retainage MANUAL → uses per-phase %", Math.abs(manual.rows[0].held - manual.rows[0].amount * 0.05) < 1e-9);

  const manualFallback = computeDraws(est, basePay({
    retentionEnabled: true, retentionMode: "manual", // phase has no retentionPct → falls back to global 10%
  }));
  check("retainage MANUAL fallback → global rate when phase % unset", Math.abs(manualFallback.rows[0].held - manualFallback.rows[0].amount * 0.1) < 1e-9);
}

// 9. Disbursement base = Total Development Cost (direct + GC, marked up by Risk&Profit + BBO).
{
  const est: CostEstimate = {
    id: "ed", projectId: null, projectName: "DevCost", version: "V1", date: "2026-01-01",
    location: "—", currency: "AED", avgLaborRate: RATE, profitPct: 10, bboPct: 6,
    categories: [{ id: "c1", name: "S", items: [baseItem()] }], // one item → direct 1090
  };
  const direct = computeGrandCost(est);
  const gc = 500;
  // (direct + gc) × (1 + 0.10 + 0.06)
  const expected = (direct + gc) * 1.16;
  check("development cost = (direct + GC) × (1 + Risk&Profit% + BBO%)",
    Math.abs(computeDevelopmentCost(est, gc) - expected) < 1e-6);
  check("development cost with no GC still applies markups",
    Math.abs(computeDevelopmentCost(est) - direct * 1.16) < 1e-6);

  const pay: PaymentConfig = {
    retention: 0, retentionEnabled: false, retentionMode: "auto",
    phases: [{ id: "p1", name: "All", pct: 100, milestone: "" }],
  };
  const d = computeDraws(est, pay, 0, gc);
  check("draws sum to Total Development Cost, not bare direct cost",
    Math.abs(d.totalAmount - expected) < 1e-6 && d.totalAmount > direct);
}

// 10. Time-Schedule Coupler spreads the FULL development cost (direct + GC + Risk&Profit +
//     BBO) across sections proportionally — total == Grand Total, not bare direct cost.
{
  const est: CostEstimate = {
    id: "esc", projectId: null, projectName: "SchedSpread", version: "V1", date: "2026-01-01",
    location: "—", currency: "AWG", avgLaborRate: RATE, profitPct: 24, bboPct: 7,
    categories: [
      { id: "c1", name: "Sub", items: [baseItem({ id: "s1" })] },              // direct 1090
      { id: "c2", name: "Fin", items: [baseItem({ id: "s2", qty: 4 })] },      // direct 436
    ],
  };
  const cfg: ScheduleConfig = {
    hoursPerDay: 8, workingDaysPerWeek: 5, overlapPct: 0, contingencyDays: 0, startDate: "", crew: {},
  };
  const gc = 300;
  const dev = computeDevelopmentCost(est, gc);
  const direct = computeGrandCost(est);
  const r = computeSchedule(est, cfg, gc);
  check("schedule total == Total Development Cost (not direct)",
    Math.abs(r.grandCost - dev) < 1e-6 && r.grandCost > direct);
  const sumSched = r.sched.reduce((a, s) => a + s.cost, 0);
  check("schedule section costs sum to the development total",
    Math.abs(sumSched - dev) < 1e-6);
  // Each section keeps its proportional share (cost ratio preserved after scaling).
  const directShares = computeSections(est).map((s) => s.cost / direct);
  const schedShares = r.sched.map((s) => s.cost / r.grandCost);
  check("schedule section shares unchanged by the markup spread",
    directShares.every((d, i) => Math.abs(d - schedShares[i]) < 1e-9));
  check("schedule hours unaffected by cost scaling",
    r.totalHours === computeSections(est).reduce((a, s) => a + s.hours, 0));
}

if (failures > 0) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
} else {
  console.log("\nAll calc checks passed ✓");
}
