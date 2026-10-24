/**
 * Convert stored shapes into quantities without rounding away measurement
 * precision. Waste is separate from gross so the estimate applies it once.
 */
import type { Calibration } from "../drawings/markup";
import { polygonAreaPt2, polygonPerimeterPt, polylineLengthPt } from "./geometry";
import type { TakeoffCondition, TakeoffMeasurement, TakeoffShape } from "./types";

export type ShapeMeasure = {
  areaM2: number | null;
  perimeterM: number | null;
  lengthM: number | null;
  count: number;
};
export type TakeoffUnit = "m²" | "m³" | "m" | "no";
export type MeasurementQuantity = {
  qty: number | null;
  unit: TakeoffUnit;
  gross: number | null;
  wasteQty: number | null;
  reason?: "uncalibrated";
};

/** Holes are subtracted even outside the outer ring; no polygon clipping occurs.
 * Perimeter includes the outer ring and every hole. Uncalibrated dimensions
 * are null; dimensions irrelevant to a shape are zero.
 */
export function measureShape(shape: TakeoffShape, calibration: Calibration | null): ShapeMeasure {
  const result: ShapeMeasure = { areaM2: 0, perimeterM: 0, lengthM: 0, count: 0 };
  if (shape.kind === "COUNT") return { ...result, count: shape.points.length };
  const scale = calibration?.mmPerPoint;
  if (scale === undefined || !Number.isFinite(scale) || scale <= 0) {
    return shape.kind === "AREA" ? { ...result, areaM2: null, perimeterM: null }
      : { ...result, lengthM: null };
  }
  const metresPerPoint = scale / 1000;
  if (shape.kind === "LINEAR") return { ...result, lengthM: polylineLengthPt(shape.path) * metresPerPoint };
  const holes = shape.holes.reduce((sum, hole) => sum + polygonAreaPt2(hole), 0);
  return {
    ...result,
    areaM2: Math.max(0, polygonAreaPt2(shape.outer) - holes) * metresPerPoint ** 2,
    perimeterM: (polygonPerimeterPt(shape.outer)
      + shape.holes.reduce((sum, hole) => sum + polygonPerimeterPt(hole), 0)) * metresPerPoint,
  };
}

/** Invalid condition dimensions/waste are programmer errors, not zero quantities. */
export function conditionUnit(condition: TakeoffCondition): TakeoffUnit {
  for (const value of [condition.heightMm, condition.depthMm]) {
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
      throw new RangeError("Condition dimensions must be positive and finite");
    }
  }
  if (!Number.isFinite(condition.wastePct) || condition.wastePct < 0) {
    throw new RangeError("Condition waste must be nonnegative and finite");
  }
  if (condition.kind === "COUNT") return "no";
  if (condition.kind === "AREA") return condition.depthMm === undefined ? "m²" : "m³";
  return condition.heightMm === undefined ? "m" : "m²";
}

export function measurementQuantity(measurement: TakeoffMeasurement, condition: TakeoffCondition): MeasurementQuantity {
  if (measurement.conditionId !== condition.id || measurement.shape.kind !== condition.kind) {
    throw new RangeError("Measurement must match its condition id and kind");
  }
  const unit = conditionUnit(condition);
  const measured = measureShape(measurement.shape, measurement.calibration);
  let gross = condition.kind === "COUNT" ? measured.count
    : condition.kind === "AREA" ? measured.areaM2 : measured.lengthM;
  if (gross === null) return { qty: null, unit, gross: null, wasteQty: null, reason: "uncalibrated" };
  if (condition.kind === "AREA" && condition.depthMm !== undefined) gross *= condition.depthMm / 1000;
  if (condition.kind === "LINEAR" && condition.heightMm !== undefined) gross *= condition.heightMm / 1000;
  const wasteQty = gross * condition.wastePct / 100;
  return { qty: gross * (1 + condition.wastePct / 100), unit, gross, wasteQty };
}
