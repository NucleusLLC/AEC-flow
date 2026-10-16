/**
 * Aggregate drawing quantities by work condition for the existing estimate
 * sheet. Keep page identity and unresolved scales visible before export.
 */
import type { TakeoffMethod, TakeoffRow } from "../data/estimates.types";
import { conditionUnit, measurementQuantity, type TakeoffUnit } from "./quantity";
import type { TakeoffCondition, TakeoffMeasurement } from "./types";

export type ConditionRollup = {
  conditionId: string;
  /** Null when any contributing measurement is uncalibrated. */
  qty: number | null;
  gross: number | null;
  wasteQty: number | null;
  unit: TakeoffUnit;
  measurementCount: number;
  uncalibratedCount: number;
  pages: { drawingId: string; page: number }[];
};

/** Conditions retain input order, including conditions with no measurements.
 * Unknown/duplicate condition ids are rejected rather than silently losing work.
 */
export function rollupByCondition(measurements: TakeoffMeasurement[], conditions: TakeoffCondition[]): ConditionRollup[] {
  const totals = new Map<string, ConditionRollup>();
  const definitions = new Map<string, TakeoffCondition>();
  for (const condition of conditions) {
    if (definitions.has(condition.id)) throw new RangeError("Duplicate condition id");
    definitions.set(condition.id, condition);
    totals.set(condition.id, {
      conditionId: condition.id, qty: 0, gross: 0, wasteQty: 0,
      unit: conditionUnit(condition), measurementCount: 0, uncalibratedCount: 0, pages: [],
    });
  }
  for (const measurement of measurements) {
    const condition = definitions.get(measurement.conditionId);
    const total = totals.get(measurement.conditionId);
    if (!condition || !total) throw new RangeError("Unknown measurement condition");
    const quantity = measurementQuantity(measurement, condition);
    total.measurementCount++;
    if (!total.pages.some((p) => p.drawingId === measurement.drawingId && p.page === measurement.page)) {
      total.pages.push({ drawingId: measurement.drawingId, page: measurement.page });
    }
    if (quantity.qty === null) {
      total.uncalibratedCount++;
      total.qty = total.gross = total.wasteQty = null;
    } else if (total.qty !== null && total.gross !== null && total.wasteQty !== null) {
      total.qty += quantity.qty;
      total.gross += quantity.gross!;
      total.wasteQty += quantity.wasteQty!;
    }
  }
  return [...totals.values()];
}

/**
 * Lossy bridge: dimensions, holes, pages and calibration remain in measurements;
 * the sheet receives a synthetic single dimension because it only multiplies
 * dimensions. Carry gross plus waste to prevent applying waste twice. Unresolved
 * totals are omitted rather than exported as misleading partial quantities.
 */
export function toTakeoffRows(rollup: ConditionRollup[], conditions: TakeoffCondition[]): TakeoffRow[] {
  const definitions = new Map(conditions.map((c) => [c.id, c]));
  const methods: Record<TakeoffUnit, TakeoffMethod> = { "m²": "area", "m³": "volume", m: "linear", no: "count" };
  return rollup.flatMap((total): TakeoffRow[] => {
    const condition = definitions.get(total.conditionId);
    if (!condition) throw new RangeError("Unknown rollup condition");
    if (conditionUnit(condition) !== total.unit) throw new RangeError("Rollup unit no longer matches condition");
    if (total.gross === null) return [];
    return [{
      id: `to-tk-${condition.id}`, desc: condition.name, normId: condition.normId ?? "",
      method: methods[total.unit], unit: total.unit,
      length: condition.kind === "COUNT" ? 0 : total.gross,
      width: 1, height: 1, count: condition.kind === "COUNT" ? total.gross : 1,
      waste: condition.wastePct,
    }];
  });
}
