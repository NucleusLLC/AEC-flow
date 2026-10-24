/**
 * Scale notes describe a plotted sheet, not screen pixels. Keep full precision
 * and reject unusable scales so an absent scale cannot masquerade as quantity.
 */
import type { Calibration } from "../drawings/markup";

function positive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function nonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function calibrationFromRatio(denominator: number): Calibration | null {
  const mmPerPoint = (25.4 / 72) * denominator;
  return positive(denominator) && positive(mmPerPoint)
    ? { mmPerPoint, reference: `1:${denominator}` } : null;
}

export function calibrationFromImperial(inchesOnPaper: number, feetReal: number): Calibration | null {
  const mmPerPoint = (feetReal / inchesOnPaper) * (304.8 / 72);
  return positive(inchesOnPaper) && positive(feetReal) && positive(mmPerPoint)
    ? { mmPerPoint, reference: `${inchesOnPaper}" = ${feetReal}'` } : null;
}

export function parseScaleNote(text: string): Calibration | null {
  const note = text.trim().replace(/^SCALE\s+/i, "");
  const metric = /^1\s*:\s*(\d+(?:\.\d+)?)$/.exec(note);
  if (metric) return calibrationFromRatio(Number(metric[1]));
  const imperial = /^(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+))?\s*"\s*=\s*(\d+(?:\.\d+)?)\s*'\s*(?:-\s*0\s*")?$/.exec(note);
  if (!imperial) return null;
  const inches = Number(imperial[1]) / (imperial[2] === undefined ? 1 : Number(imperial[2]));
  const calibration = calibrationFromImperial(inches, Number(imperial[3]));
  return calibration ? { ...calibration, reference: text.trim() } : null;
}

export function ptToMm(pt: number, calibration: Calibration): number | null {
  const result = pt * calibration.mmPerPoint;
  return nonNegative(pt) && positive(calibration.mmPerPoint) && nonNegative(result) ? result : null;
}

export function pt2ToM2(pt2: number, calibration: Calibration): number | null {
  const result = pt2 * (calibration.mmPerPoint / 1000) ** 2;
  return nonNegative(pt2) && positive(calibration.mmPerPoint) && nonNegative(result) ? result : null;
}
