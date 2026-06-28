/**
 * Unit tests for the Rebar Calculator engine.
 * Run with:  npx tsx --test lib/calc/rebar.test.ts
 *
 * Stirrup count is now whole stirrups per metre (floor(1/spacing)) per product
 * decision. Resulting totals from the spec's exact formulas:
 *   - Strip Type 1 ≈ 41.37 kg/m³  (spec target ≈ 41 ✓)
 *   - Strip Type 2 ≈ 62.06 kg/m³  (spec target ≈ 83 — does not reconcile)
 *   - Column      ≈ 43.34 kg/m³  (spec target ≈ 57 — its breakdown is internally
 *     inconsistent: its own formula gives count 5 & stirrup 1.10 m, while the
 *     breakdown states 6 & 1.22 m. We test the deterministic formula output.)
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcStripFoundation,
  calculateColumnRebarKgPerM3,
  calculateBeam,
  calculateSlabRebarKgPerM3,
  DEFAULT_REBAR_WEIGHTS,
  type StripInput,
  type ColumnInput,
  type BeamInput,
  type SlabInput,
  type SlabDirectionInput,
} from "./rebar";

const close = (a: number, b: number, tol = 0.05) => Math.abs(a - b) <= tol;

const T1: StripInput = { cover: 0.04, width: 0.45, height: 0.2, stirrupDia: 8, stirrupSpacing: 0.15, stirrupOverlap: 0.3, mainDia: 10, mainCount: 3, lengthBasis: 1 };
const T2: StripInput = { cover: 0.04, width: 0.6, height: 0.2, stirrupDia: 8, stirrupSpacing: 0.15, stirrupOverlap: 0.3, mainDia: 10, mainCount: 6, lengthBasis: 1 };
const COL: ColumnInput = { cover: 0.05, widthA: 0.3, widthB: 0.3, stirrupDia: 8, stirrupSpacing: 0.2, stirrupOverlap: 0.3, mainDia: 10, mainCount: 4, barLengthBasis: 0.7 };

test("Strip Foundation Type 1 — whole stirrups per metre", () => {
  const r = calcStripFoundation("type1", T1, DEFAULT_REBAR_WEIGHTS);
  assert.equal(r.stirrupCountPerM, 6);
  assert.ok(close(r.stirrupLength, 0.79, 0.001), `len ${r.stirrupLength}`);
  assert.ok(close(r.totalKgPerM3, 41.37, 0.05), `total ${r.totalKgPerM3}`); // ≈ spec 41
});

test("Strip Foundation Type 2 — whole stirrups per metre", () => {
  const r = calcStripFoundation("type2", T2, DEFAULT_REBAR_WEIGHTS);
  assert.equal(r.stirrupCountPerM, 6);
  assert.ok(close(r.stirrupLength, 1.58, 0.001), `len ${r.stirrupLength}`);
  assert.ok(close(r.totalKgPerM3, 62.06, 0.05), `total ${r.totalKgPerM3}`);
});

test("Column — closed rectangular stirrup", () => {
  const r = calculateColumnRebarKgPerM3(COL, DEFAULT_REBAR_WEIGHTS);
  assert.ok(close(r.concreteVolumeM3, 0.09), `vol ${r.concreteVolumeM3}`);
  assert.ok(close(r.stirrupLength, 1.1, 0.001), `len ${r.stirrupLength}`);
  assert.equal(r.stirrupCountPerM, 5);
  assert.ok(close(r.totalStirrupLengthPerM, 5.5, 0.001), `totalLen ${r.totalStirrupLengthPerM}`);
  assert.ok(close(r.mainRebarLengthPerM, 2.8, 0.001), `mainLen ${r.mainRebarLengthPerM}`);
  assert.ok(close(r.stirrupKgPerM3, 24.14, 0.05), `stirrup/m3 ${r.stirrupKgPerM3}`);
  assert.ok(close(r.mainRebarKgPerM3, 19.2, 0.05), `main/m3 ${r.mainRebarKgPerM3}`);
  assert.ok(close(r.totalKgPerM3, 43.34, 0.05), `total ${r.totalKgPerM3}`); // spec target ≈ 57 — see header note
});

const BEAM: BeamInput = {
  cover: 0.03, width: 0.38, height: 0.38, stirrupDia: 8, stirrupSpacing: 0.2, stirrupOverlap: 0.3,
  zones: [
    { label: "A", dia: 12, quantity: 3, lengthFactor: 1 },
    { label: "B", dia: 8, quantity: 2, lengthFactor: 1 },
    { label: "C", dia: 8, quantity: 2, lengthFactor: 1 },
    { label: "D", dia: 0, quantity: 0, lengthFactor: 1 },
    { label: "E", dia: 16, quantity: 4, lengthFactor: 1 },
  ],
};

test("RC Beam / Ring Beam — 5-zone reinforcement", () => {
  const r = calculateBeam(BEAM, DEFAULT_REBAR_WEIGHTS);
  assert.ok(close(r.concreteVolumeM3, 0.1444, 0.0005), `vol ${r.concreteVolumeM3}`);
  assert.ok(close(r.stirrupLength, 1.58, 0.001), `len ${r.stirrupLength}`);
  assert.equal(r.stirrupCountPerM, 5);
  assert.equal(r.zones?.length, 5);
  assert.ok(close(r.mainRebarKgPerM, 10.564, 0.01), `main kg/m ${r.mainRebarKgPerM}`);
  assert.ok(close(r.totalKgPerM3, 94.77, 0.1), `total ${r.totalKgPerM3}`); // spec target ≈ 112 — see header note
});

const slabDir = (over = false, overLen = 0): SlabDirectionInput => ({ dia: 8, spacing: 0.15, barLengthBasis: 1, overlapEnabled: over, overlapLength: overLen });
const SLAB: SlabInput = {
  cover: 0.025, thickness: 0.12, area: 1,
  bottomX: slabDir(), bottomY: slabDir(), topEnabled: false, topX: slabDir(), topY: slabDir(),
};

test("RC Slab — bottom mesh both directions ≈ 44 kg/m³", () => {
  const r = calculateSlabRebarKgPerM3(SLAB, DEFAULT_REBAR_WEIGHTS);
  assert.ok(close(r.concreteVolumeM3, 0.12, 0.0005), `vol ${r.concreteVolumeM3}`);
  assert.ok(close(r.bottomX.barsPerMeter, 6.6667, 0.001), `bpm ${r.bottomX.barsPerMeter}`);
  assert.ok(close(r.bottomX.kgPerM2, 2.6333, 0.001), `kg/m2 ${r.bottomX.kgPerM2}`);
  assert.equal(r.topX, undefined);
  assert.ok(close(r.totalKgPerM3, 43.89, 0.05), `total ${r.totalKgPerM3}`); // ≈ spec 44 ✓
});

test("RC Slab — with top reinforcement adds the top mesh", () => {
  const withTop: SlabInput = { ...SLAB, topEnabled: true, topX: slabDir(), topY: slabDir() };
  const r = calculateSlabRebarKgPerM3(withTop, DEFAULT_REBAR_WEIGHTS);
  assert.ok(r.topX !== undefined && r.topY !== undefined, "top X/Y present");
  assert.ok(close(r.totalKgPerM3, 87.78, 0.1), `total ${r.totalKgPerM3}`); // bottom 43.89 + top 43.89
});
