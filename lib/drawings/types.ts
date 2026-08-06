/**
 * Drawing metadata extraction — shared types.
 *
 * PURITY CONTRACT. Everything in `lib/drawings/` except `pdf-text.ts` is pure:
 * no React, no `window`, no Prisma, no network, no filesystem. Given the same
 * input it returns the same output, and it never throws — garbage input yields
 * an empty or low-confidence result, not an exception. That is what makes the
 * accuracy numbers in docs/drawings-intake/01-FEASIBILITY.md reproducible.
 *
 * CONFIDENCE IS PART OF THE VALUE. There is no API here that hands back a bare
 * string. Every field carries the confidence and the evidence that produced it,
 * because the consumer (a drawing register) must be able to show the user WHY a
 * value was proposed before they accept it. See §4 of the feasibility doc.
 */

/** Disciplines recognised from a sheet-number prefix. Mirrors the vocabulary of
 *  `lib/data/drawings.ts` but is deliberately finer-grained: the sheet prefix
 *  distinguishes M/E/P where the existing `Discipline` union lumps them as MEP.
 *  `toDataDiscipline()` in `./mapping.ts` collapses this down for storage. */
export type SheetDiscipline =
  | "GENERAL"
  | "CIVIL"
  | "LANDSCAPE"
  | "ARCHITECTURAL"
  | "INTERIORS"
  | "STRUCTURAL"
  | "MECHANICAL"
  | "ELECTRICAL"
  | "PLUMBING"
  | "FIRE_PROTECTION"
  | "TELECOM";

/** Where a value came from. Coarse enough to be stable, fine enough to explain. */
export type EvidenceSource =
  /** Parsed out of the uploaded file's name. */
  | "filename"
  /** Parsed from a `LABEL: value` pair found in PDF title-block text. */
  | "titleblock-label"
  /** Pattern-scanned out of PDF title-block text with no label to anchor it. */
  | "titleblock-scan";

/**
 * Why we believe a value. `pattern` is a stable identifier so the UI (and the
 * accuracy harness) can group results by which rule fired; `fragment` is the
 * exact substring that matched, so a human can check the machine's work.
 */
export type Evidence = {
  source: EvidenceSource;
  /** Stable rule id, e.g. `sheet.prefix-dash-number`. Never shown raw to users. */
  pattern: string;
  /** The exact input substring the rule matched. */
  fragment: string;
  /** Offset of `fragment` in the text that was scanned, when known. */
  index?: number;
  /** Human-readable caveat attached to this particular match. */
  note?: string;
};

export type ConfidenceBand = "high" | "medium" | "low";

/** A value we did not pick, kept so the confirmation UI can offer it. */
export type Alternate<T> = {
  value: T;
  confidence: number;
  evidence: Evidence[];
};

/** A single extracted field. `confidence` is 0..1; `band` is derived from it. */
export type Field<T> = {
  value: T;
  /** 0..1. Calibrated by rule, then adjusted by cross-source agreement. */
  confidence: number;
  band: ConfidenceBand;
  evidence: Evidence[];
  /** Other plausible readings, best first. Empty when the read was unambiguous. */
  alternates: Alternate<T>[];
};

/**
 * The proposal handed to the user for confirmation. Every member is nullable:
 * "we did not find this" is a first-class, expected outcome and must not be
 * papered over with an empty string.
 */
export type DrawingMetadataDraft = {
  /** e.g. `A-101`. Normalised to `PREFIX-NUMBER` with an uppercase prefix. */
  sheetNumber: Field<string> | null;
  /** Derived from the sheet-number prefix, never guessed from the title. */
  discipline: Field<SheetDiscipline> | null;
  /** Sheet title, e.g. `Ground Floor Plan`. Best-effort from a filename. */
  title: Field<string> | null;
  /** e.g. `ZA-2026-121`. */
  projectNumber: Field<string> | null;
  projectName: Field<string> | null;
  /** Single revision token: `A`..`Z` or `0`..`99` as written. */
  revision: Field<string> | null;
  /** ISO `YYYY-MM-DD`. Always a real calendar date or absent. */
  issueDate: Field<string> | null;
  /** Non-fatal problems worth surfacing, e.g. sources that disagreed. */
  warnings: string[];
};

export const EMPTY_DRAFT: DrawingMetadataDraft = {
  sheetNumber: null,
  discipline: null,
  title: null,
  projectNumber: null,
  projectName: null,
  revision: null,
  issueDate: null,
  warnings: [],
};

/** Field keys that carry a `Field<...>`, i.e. everything but `warnings`. */
export type DraftFieldKey = Exclude<keyof DrawingMetadataDraft, "warnings">;

export const DRAFT_FIELD_KEYS: readonly DraftFieldKey[] = [
  "sheetNumber",
  "discipline",
  "title",
  "projectNumber",
  "projectName",
  "revision",
  "issueDate",
] as const;

/**
 * Band thresholds. These are the numbers the UI keys its colour off, so they
 * live in one place.
 *
 *   high   >= 0.80  a labelled title-block hit or a textbook filename pattern.
 *                   Still shown for confirmation — see the feasibility doc §4.
 *   medium >= 0.55  a real pattern match with a known ambiguity (e.g. a
 *                   DD/MM vs MM/DD date where the day is <= 12).
 *   low     < 0.55  a leftover-text heuristic. Treat as a hint, not a value.
 */
export const CONFIDENCE_HIGH = 0.8;
export const CONFIDENCE_MEDIUM = 0.55;

export function bandOf(confidence: number): ConfidenceBand {
  if (confidence >= CONFIDENCE_HIGH) return "high";
  if (confidence >= CONFIDENCE_MEDIUM) return "medium";
  return "low";
}

/** Build a `Field` and derive its band. Clamps confidence into 0..1. */
export function field<T>(
  value: T,
  confidence: number,
  evidence: Evidence[],
  alternates: Alternate<T>[] = [],
): Field<T> {
  const c = clamp01(confidence);
  return { value, confidence: c, band: bandOf(c), evidence, alternates };
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
