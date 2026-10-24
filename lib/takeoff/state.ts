import type { Calibration, Point } from "../drawings/markup";
import type { TakeoffRow } from "../data/estimates.types";
import type { TakeoffCondition, TakeoffMeasurement, TakeoffShape } from "./types";

export type DrawingTakeoffState = {
  conditions: TakeoffCondition[];
  measurements: TakeoffMeasurement[];
  calibrations: Record<string, Calibration>;
};

const record = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === "object" && !Array.isArray(value)
);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const calibration = (value: unknown): value is Calibration => (
  record(value) && positive(value.mmPerPoint) && typeof value.reference === "string"
);
const points = (value: unknown, min: number): value is Point[] => (
  Array.isArray(value) && value.length >= min && value.every(p => record(p) && finite(p.x) && finite(p.y))
);

function shape(value: unknown): value is TakeoffShape {
  if (!record(value)) return false;
  if (value.kind === "AREA") {
    return points(value.outer, 3) && Array.isArray(value.holes) && value.holes.every(hole => points(hole, 3));
  }
  if (value.kind === "LINEAR") return points(value.path, 2);
  return value.kind === "COUNT" && points(value.points, 1);
}

/** Budget JSON is untrusted. Invalid entries are dropped, never evaluated. */
export function sanitiseDrawingTakeoff(input: unknown): DrawingTakeoffState {
  const state: DrawingTakeoffState = { conditions: [], measurements: [], calibrations: {} };
  if (!record(input)) return state;

  const ids = new Set<string>();
  for (const condition of Array.isArray(input.conditions) ? input.conditions : []) {
    if (
      !record(condition)
      || !text(condition.id)
      || ids.has(condition.id)
      || !text(condition.name)
      || !text(condition.colour)
      || !["AREA", "LINEAR", "COUNT"].includes(String(condition.kind))
      || !finite(condition.wastePct)
      || condition.wastePct < 0
      || (condition.heightMm !== undefined && !positive(condition.heightMm))
      || (condition.depthMm !== undefined && !positive(condition.depthMm))
      || (condition.normId !== undefined && typeof condition.normId !== "string")
    ) {
      continue;
    }
    ids.add(condition.id);
    state.conditions.push({
      id: condition.id,
      name: condition.name,
      colour: condition.colour,
      kind: condition.kind as TakeoffCondition["kind"],
      wastePct: condition.wastePct,
      ...(condition.heightMm !== undefined ? { heightMm: condition.heightMm as number } : {}),
      ...(condition.depthMm !== undefined ? { depthMm: condition.depthMm as number } : {}),
      ...(condition.normId !== undefined ? { normId: condition.normId as string } : {}),
    });
  }

  const measurementIds = new Set<string>();
  for (const measurement of Array.isArray(input.measurements) ? input.measurements : []) {
    if (
      !record(measurement)
      || !text(measurement.id)
      || measurementIds.has(measurement.id)
      || !text(measurement.conditionId)
      || !text(measurement.drawingId)
      || !positive(measurement.page)
      || !Number.isInteger(measurement.page)
      || !shape(measurement.shape)
      || !state.conditions.some(condition => (
        condition.id === measurement.conditionId && condition.kind === (measurement.shape as TakeoffShape).kind
      ))
      || (measurement.calibration !== null && !calibration(measurement.calibration))
      || !text(measurement.createdAt)
      || !Number.isFinite(Date.parse(measurement.createdAt))
      || (measurement.label !== undefined && typeof measurement.label !== "string")
    ) {
      continue;
    }
    measurementIds.add(measurement.id);
    state.measurements.push({
      id: measurement.id,
      conditionId: measurement.conditionId,
      drawingId: measurement.drawingId,
      page: measurement.page,
      shape: measurement.shape,
      calibration: measurement.calibration,
      createdAt: measurement.createdAt,
      ...(measurement.label !== undefined ? { label: measurement.label as string } : {}),
    });
  }

  if (record(input.calibrations)) {
    for (const [key, value] of Object.entries(input.calibrations)) {
      if (calibration(value) && /^.+:[1-9]\d*$/.test(key)) {
        state.calibrations[key] = { mmPerPoint: value.mmPerPoint, reference: value.reference };
      }
    }
  }
  return state;
}

export function calibrationKey(drawingId: string, page: number): string {
  return `${drawingId}:${page}`;
}

export function mergeTakeoffRows(existing: TakeoffRow[], fromDrawing: TakeoffRow[]): TakeoffRow[] {
  return [...existing.filter(row => !row.id.startsWith("to-tk-")), ...fromDrawing];
}
