/**
 * Bridge between the fine-grained `SheetDiscipline` this module infers from a
 * sheet prefix and the coarser `Discipline` union the existing drawings
 * register stores (`lib/data/drawings.ts`).
 *
 * The two are deliberately different. A sheet prefix distinguishes M, E and P;
 * the register lumps them into `MEP`. Extraction should not throw away what it
 * can see, and the register should not be widened by a module that is not yet
 * allowed to touch the schema — so the narrowing happens here, at the seam,
 * where it is one obvious function to revisit if `Discipline` ever grows.
 */

import type { Discipline } from "@/lib/data/drawings";
import type { SheetDiscipline } from "./types";

const TO_DATA_DISCIPLINE: Readonly<Record<SheetDiscipline, Discipline>> = {
  GENERAL: "PROJECT_MANAGEMENT",
  CIVIL: "CONSTRUCTION",
  LANDSCAPE: "ARCHITECTURE",
  ARCHITECTURAL: "ARCHITECTURE",
  INTERIORS: "INTERIOR",
  STRUCTURAL: "STRUCTURAL",
  MECHANICAL: "MEP",
  ELECTRICAL: "MEP",
  PLUMBING: "MEP",
  FIRE_PROTECTION: "MEP",
  TELECOM: "MEP",
};

/**
 * Narrow to the stored vocabulary. Lossy by construction — `LANDSCAPE` and
 * `CIVIL` have no home in the current union and are mapped to the nearest
 * truthful bucket rather than silently dropped. Both mappings are wrong enough
 * to be worth fixing when the schema is free; they are recorded here so the
 * next run can find them.
 */
export function toDataDiscipline(d: SheetDiscipline): Discipline {
  return TO_DATA_DISCIPLINE[d] ?? "ARCHITECTURE";
}

/** Disciplines with no faithful destination in the stored union. */
export const LOSSY_DISCIPLINES: readonly SheetDiscipline[] = ["CIVIL", "LANDSCAPE", "GENERAL"];
