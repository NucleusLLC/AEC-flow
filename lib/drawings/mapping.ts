/**
 * Bridge between the fine-grained `SheetDiscipline` this module infers from a
 * sheet prefix and the `Discipline` vocabulary the drawing register stores
 * (`lib/data/drawings.types.ts`).
 *
 * The two are still deliberately different, but they no longer disagree. When
 * the register was placeholder data its union had six values, so `CIVIL`,
 * `LANDSCAPE` and `GENERAL` were being filed under the nearest wrong heading —
 * a landscape sheet stored as architecture is a small lie that a register then
 * repeats forever. The stored union now carries all three, so the only
 * narrowing left is the honest one: M, E, P, fire protection and telecom all
 * become `MEP`, which is how a drawing set is actually filtered.
 *
 * Nothing is thrown away even there — `sheetDiscipline` on the row keeps the
 * exact reading, so "which of these MEP sheets are plumbing" stays answerable.
 */

import type { Discipline } from "@/lib/data/drawings.types";
import type { SheetDiscipline } from "./types";

const TO_DATA_DISCIPLINE: Readonly<Record<SheetDiscipline, Discipline>> = {
  GENERAL: "GENERAL",
  CIVIL: "CIVIL",
  LANDSCAPE: "LANDSCAPE",
  ARCHITECTURAL: "ARCHITECTURE",
  INTERIORS: "INTERIOR",
  STRUCTURAL: "STRUCTURAL",
  MECHANICAL: "MEP",
  ELECTRICAL: "MEP",
  PLUMBING: "MEP",
  FIRE_PROTECTION: "MEP",
  TELECOM: "MEP",
};

/** Narrow to the stored vocabulary. */
export function toDataDiscipline(d: SheetDiscipline): Discipline {
  return TO_DATA_DISCIPLINE[d] ?? "ARCHITECTURE";
}

/**
 * Disciplines the stored union cannot express exactly. All five collapse into
 * `MEP` by design; the original reading survives on the row's `sheetDiscipline`
 * column, so this is a display narrowing rather than data loss.
 */
export const LOSSY_DISCIPLINES: readonly SheetDiscipline[] = [
  "MECHANICAL",
  "ELECTRICAL",
  "PLUMBING",
  "FIRE_PROTECTION",
  "TELECOM",
];
