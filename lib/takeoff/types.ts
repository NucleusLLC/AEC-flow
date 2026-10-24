/**
 * Drawing quantities stay in PDF points until evaluated against the calibration
 * saved with each measurement. Conditions describe work, independently of scale.
 * Pure declarations so the future measuring screen can share the engine API.
 */
import type { Calibration, Point } from "../drawings/markup";

export type TakeoffKind = "AREA" | "LINEAR" | "COUNT";

export type TakeoffCondition = {
  id: string;
  name: string;
  kind: TakeoffKind;
  colour: string;
  heightMm?: number;
  depthMm?: number;
  wastePct: number;
  normId?: string;
};

export type TakeoffShape =
  | { kind: "AREA"; outer: Point[]; holes: Point[][] }
  | { kind: "LINEAR"; path: Point[] }
  | { kind: "COUNT"; points: Point[] };

export type TakeoffMeasurement = {
  id: string;
  conditionId: string;
  drawingId: string;
  /** One-based PDF page number. */
  page: number;
  shape: TakeoffShape;
  calibration: Calibration | null;
  label?: string;
  /** ISO timestamp supplied by the caller; the engine has no clock or I/O. */
  createdAt: string;
};
