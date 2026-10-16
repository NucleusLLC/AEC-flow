import { describe, expect, it } from "vitest";
import { measureShape, measurementQuantity } from "./quantity";
import { calibrationFromRatio } from "./scale";
import type { TakeoffCondition, TakeoffMeasurement } from "./types";

const square = [{ x: 0, y: 0 }, { x: 72, y: 0 }, { x: 72, y: 72 }, { x: 0, y: 72 }];
const condition: TakeoffCondition = { id: "floor", name: "Floor", kind: "AREA", colour: "#000000", wastePct: 10 };
const measurement: TakeoffMeasurement = {
  id: "m1", conditionId: "floor", drawingId: "d1", page: 1,
  shape: { kind: "AREA", outer: square, holes: [] },
  calibration: calibrationFromRatio(50), createdAt: "2026-10-16T00:00:00Z",
};

describe("drawing quantities", () => {
  it("measures a 1:50 square and subtracts holes, wherever they lie", () => {
    const result = measureShape(measurement.shape, measurement.calibration);
    expect(result.areaM2).toBeCloseTo(1.27 ** 2, 12);
    expect(result.perimeterM).toBeCloseTo(4 * 1.27);
    const hole = square.map((p) => ({ x: p.x / 2, y: p.y / 2 }));
    for (const h of [hole, hole.map((p) => ({ x: p.x + 500, y: p.y }))]) {
      const measured = measureShape({ kind: "AREA", outer: square, holes: [h] }, measurement.calibration);
      expect(measured.areaM2).toBeCloseTo(1.27 ** 2 * 0.75);
      expect(measured.perimeterM).toBeCloseTo(6 * 1.27);
    }
    expect(measureShape({ kind: "AREA", outer: [], holes: [square] }, measurement.calibration).areaM2).toBe(0);
  });
  it("keeps gross and waste distinct and supports volume", () => {
    const result = measurementQuantity(measurement, condition);
    expect(result.gross).toBeCloseTo(1.27 ** 2, 12);
    expect(result.qty).toBeCloseTo(1.27 ** 2 * 1.1);
    expect(result.wasteQty).toBeCloseTo(1.27 ** 2 * 0.1);
    const volume = measurementQuantity(measurement, { ...condition, depthMm: 200 });
    expect(volume.unit).toBe("m³");
    expect(volume.gross).toBeCloseTo(1.27 ** 2 * 0.2);
  });
  it("measures open lines and wall area", () => {
    const line: TakeoffMeasurement = { ...measurement, shape: { kind: "LINEAR", path: square.slice(0, 2) }, calibration: calibrationFromRatio(100) };
    const wall: TakeoffCondition = { ...condition, kind: "LINEAR", wastePct: 0 };
    expect(measurementQuantity(line, wall).qty).toBeCloseTo(2.54);
    expect(measurementQuantity(line, { ...wall, heightMm: 3000 })).toMatchObject({ unit: "m²" });
    expect(measurementQuantity(line, { ...wall, heightMm: 3000 }).qty).toBeCloseTo(7.62);
    expect(measurementQuantity({ ...line, calibration: null }, wall)).toMatchObject({ qty: null, reason: "uncalibrated" });
  });
  it("requires calibration for dimensions but never for count", () => {
    expect(measurementQuantity({ ...measurement, calibration: null }, condition)).toMatchObject({ qty: null, reason: "uncalibrated" });
    const counted = { ...measurement, calibration: null, shape: { kind: "COUNT" as const, points: square } };
    expect(measurementQuantity(counted, { ...condition, kind: "COUNT" })).toEqual({ qty: 4.4, gross: 4, wasteQty: 0.4, unit: "no" });
    expect(measureShape({ kind: "LINEAR", path: [] }, measurement.calibration).lengthM).toBe(0);
    expect(measureShape(measurement.shape, { mmPerPoint: Infinity, reference: "bad" }).areaM2).toBeNull();
  });
  it("rejects mismatched conditions and invalid dimensions or waste", () => {
    expect(() => measurementQuantity(measurement, { ...condition, id: "other" })).toThrow(RangeError);
    expect(() => measurementQuantity(measurement, { ...condition, kind: "COUNT" })).toThrow(RangeError);
    expect(() => measurementQuantity(measurement, { ...condition, depthMm: -1 })).toThrow(RangeError);
    expect(() => measurementQuantity(measurement, { ...condition, wastePct: NaN })).toThrow(RangeError);
  });
});
