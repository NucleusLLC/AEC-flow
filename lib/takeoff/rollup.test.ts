import { describe, expect, it } from "vitest";
import type { TakeoffRow } from "../data/estimates.types";
import { rollupByCondition, toTakeoffRows, type TakeoffCondition, type TakeoffMeasurement } from "./index";

const condition: TakeoffCondition = { id: "wall", name: "Wall", kind: "LINEAR", colour: "red", wastePct: 10, normId: "norm1" };
const measurement: TakeoffMeasurement = {
  id: "m1", conditionId: "wall", drawingId: "drawing1", page: 1,
  calibration: { mmPerPoint: 1000, reference: "test" },
  shape: { kind: "LINEAR", path: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
  createdAt: "2026-10-16T00:00:00Z",
};

describe("condition totals and estimate rows", () => {
  it("aggregates two pages and deduplicates page identities", () => {
    const totals = rollupByCondition([measurement, { ...measurement, id: "m2", page: 2 }, { ...measurement, id: "m3" }], [condition]);
    expect(totals[0]).toEqual({ conditionId: "wall", qty: 33, gross: 30, wasteQty: 3, unit: "m", measurementCount: 3, uncalibratedCount: 0,
      pages: [{ drawingId: "drawing1", page: 1 }, { drawingId: "drawing1", page: 2 }] });
    const rows: TakeoffRow[] = toTakeoffRows(totals, [condition]);
    expect(rows).toEqual([{ id: "to-tk-wall", desc: "Wall", normId: "norm1", method: "linear", unit: "m", length: 30, width: 1, height: 1, count: 1, waste: 10 }]);
    expect(rows[0].length * rows[0].count * (1 + rows[0].waste / 100)).toBe(totals[0].qty);
    expect(toTakeoffRows(totals, [condition])[0].id).toBe(rows[0].id);
    expect(rollupByCondition([measurement, { ...measurement, drawingId: "drawing2" }], [condition])[0].pages).toHaveLength(2);
  });
  it("keeps unresolved totals visible and excludes them from export in either input order", () => {
    const missing = { ...measurement, id: "missing", calibration: null };
    for (const items of [[measurement, missing], [missing, measurement]]) {
      const totals = rollupByCondition(items, [condition]);
      expect(totals[0]).toMatchObject({ qty: null, gross: null, uncalibratedCount: 1, measurementCount: 2 });
      expect(toTakeoffRows(totals, [condition])).toEqual([]);
    }
  });
  it.each([
    ["AREA", undefined, undefined, "area", "m²"],
    ["AREA", undefined, 200, "volume", "m³"],
    ["LINEAR", 3000, undefined, "area", "m²"],
    ["COUNT", undefined, undefined, "count", "no"],
  ] as const)("maps %s with height %s depth %s", (kind, heightMm, depthMm, method, unit) => {
    const c: TakeoffCondition = { ...condition, kind, heightMm, depthMm, normId: undefined };
    const points = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }];
    const m: TakeoffMeasurement = { ...measurement, shape: kind === "AREA" ? { kind, outer: points, holes: [] }
      : kind === "COUNT" ? { kind, points } : { kind, path: points } };
    const totals = rollupByCondition([m], [c]);
    const rows: TakeoffRow[] = toTakeoffRows(totals, [c]);
    expect(rows[0]).toMatchObject({ method, unit, normId: "", width: 1, height: 1 });
    expect(rows[0].length).toBe(kind === "COUNT" ? 0 : totals[0].gross);
    expect(rows[0].count).toBe(kind === "COUNT" ? totals[0].gross : 1);
  });
  it("includes empty conditions and rejects missing or duplicate definitions", () => {
    expect(rollupByCondition([], [condition])[0]).toMatchObject({ qty: 0, measurementCount: 0, pages: [] });
    expect(() => rollupByCondition([measurement], [])).toThrow(RangeError);
    expect(() => rollupByCondition([], [condition, condition])).toThrow(RangeError);
  });
});
