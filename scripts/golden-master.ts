/**
 * GOLDEN-MASTER regression (spec §20) for the protected systems.
 *
 * Locks the EXACT numeric outputs of the Estimates roll-up and the Schedule
 * CPM/health engines against fixed fixtures. The module reorganization must not
 * change these results — a difference here is a regression and must be treated as
 * one unless explicitly approved (see docs/protected-systems.md).
 *
 * These fixtures are self-contained (they don't touch the database), so this is
 * safe to run before AND after integration as a diff gate.
 *
 * Run:  npm run golden
 */
import { estimateTotals } from "../lib/estimates/calc";
import { computeCpm, computeScheduleHealth } from "../lib/data/schedule";
import type { CostEstimate, EstimateItem } from "../lib/data/estimates.types";

let failures = 0;
function check(name: string, cond: boolean, got?: unknown, want?: unknown) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : `  (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`}`);
  if (!cond) failures++;
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/* ── Estimates golden fixture ─────────────────────────────────────────────── */
const item = (o: Partial<EstimateItem>): EstimateItem => ({
  id: "i", task: "t", qty: 0, unit: "no", laborNorm: 0,
  materialUnitCost: 0, equipmentUnitCost: 0, subcontractUnitCost: 0, poc: 0, ...o,
});

const ESTIMATE: CostEstimate = {
  id: "gm-est", projectId: null, projectName: "Golden Master", version: "V1.0",
  date: "2026-01-01", location: "—", currency: "USD",
  avgLaborRate: 50, profitPct: 10, bboPct: 5,
  status: "draft",
  categories: [
    {
      id: "c1", name: "Structure",
      items: [
        // labor (10×2)×50=1000, mat 1000, equip 200, sub 0 → 2200
        item({ id: "a", qty: 10, laborNorm: 2, materialUnitCost: 100, equipmentUnitCost: 20 }),
        // labor (5×1)×50=250, mat 250, equip 0, sub 150 → 650
        item({ id: "b", qty: 5, laborNorm: 1, materialUnitCost: 50, subcontractUnitCost: 30 }),
      ],
    },
  ],
};

{
  const t = estimateTotals(ESTIMATE);
  check("EST direct = 2850", near(t.direct, 2850), t.direct, 2850);
  check("EST markupBase = 2850 (no GC)", near(t.markupBase, 2850), t.markupBase, 2850);
  check("EST profit = 285 (10%)", near(t.profit, 285), t.profit, 285);
  check("EST bbo = 142.5 (5%)", near(t.bbo, 142.5), t.bbo, 142.5);
  check("EST grandTotal = 3277.5", near(t.grandTotal, 3277.5), t.grandTotal, 3277.5);
}

/* ── Schedule golden fixture ──────────────────────────────────────────────── */
const T = (id: string, start: string, end: string, dependsOn: string[], progressPct: number) => ({
  id, name: id, start, end, dependsOn, progressPct,
});
// Pure finish-to-start chain: durations 5 + 3 + 2 = 10 project days, all critical.
const TASKS = [
  T("t1", "2026-01-01", "2026-01-05", [], 100),
  T("t2", "2026-01-06", "2026-01-08", ["t1"], 0),
  T("t3", "2026-01-09", "2026-01-10", ["t2"], 0),
];

{
  const cpm = computeCpm(TASKS);
  check("SCH projectDays = 10", cpm.projectDays === 10, cpm.projectDays, 10);
  check("SCH critical count = 3 (pure chain)", cpm.critical.size === 3, cpm.critical.size, 3);

  // All complete, status date at finish → 100% actual & planned, SPI 1, no variance.
  const done = TASKS.map((t) => ({ ...t, progressPct: 100 }));
  const hDone = computeScheduleHealth(done, "2026-01-10", cpm.critical);
  check("SCH(done) pctActual = 100", near(hDone.pctActual, 100), hDone.pctActual, 100);
  check("SCH(done) pctPlanned = 100", near(hDone.pctPlanned, 100), hDone.pctPlanned, 100);
  check("SCH(done) spi = 1", near(hDone.spi, 1), hDone.spi, 1);
  check("SCH(done) varianceDays = 0", hDone.varianceDays === 0, hDone.varianceDays, 0);
  check("SCH(done) baselineFinish = 2026-01-10", hDone.baselineFinish === "2026-01-10", hDone.baselineFinish, "2026-01-10");
  check("SCH(done) overall = on-track", hDone.overall === "on-track", hDone.overall, "on-track");

  // Mid-project: only t1 done at status date 2026-01-06.
  const h = computeScheduleHealth(TASKS, "2026-01-06", cpm.critical);
  check("SCH(mid) pctActual = 50", near(h.pctActual, 50), h.pctActual, 50);
  check("SCH(mid) pctPlanned = 60", near(h.pctPlanned, 60), h.pctPlanned, 60);
  check("SCH(mid) spi = 5/6", Math.abs(h.spi - 5 / 6) < 1e-6, h.spi, 5 / 6);
  check("SCH(mid) varianceDays = -1", h.varianceDays === -1, h.varianceDays, -1);
  check("SCH(mid) baselineFinish = 2026-01-10", h.baselineFinish === "2026-01-10", h.baselineFinish, "2026-01-10");
}

if (failures > 0) {
  console.error(`\n${failures} golden-master check(s) FAILED — this is a regression in a protected system.`);
  process.exit(1);
} else {
  console.log("\nAll golden-master checks passed ✓ (protected outputs unchanged)");
}
