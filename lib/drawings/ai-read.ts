/**
 * Reading a title block with a model — the PURE half.
 *
 * The network call lives in `lib/server/titleblock-ai.ts`. Everything here —
 * the schema the model must answer in, the prompt, turning the answer into a
 * `DrawingMetadataDraft`, and the policy for merging it with what the regex
 * rules read — has no I/O, so the behaviour that matters (what we do with an
 * answer) is unit tested without a key, a network or a PDF.
 *
 * WHY A MODEL AT ALL. The rules in `titleblock.ts` read a text layer. Half of
 * what a practice receives has none — a scan, a plot with outlined text, a
 * title block set as a raster logo — and for those the filename was all we
 * had. A model LOOKS at the page, so it reads the scan, and it reads the names
 * the rules never tried to (who the architect and engineer are). Autodesk
 * Construction Cloud does the same thing on upload; this is that, with the
 * proposal-then-confirm rule kept intact.
 *
 * THE MODEL PROPOSES, LIKE EVERYTHING ELSE. Its answer becomes a draft whose
 * every field carries a confidence and evidence, exactly as the rules' draft
 * does, and the user still confirms. A model's confidence is capped below a
 * labelled rules hit (`AI_MAX_CONFIDENCE`) because the rules can be audited by
 * reading a regex and a model cannot; where the two AGREE the confidence goes
 * up, where they DISAGREE the sheet gets a warning and both readings are kept.
 */

import { isRealDate, scanSheetNumbers } from "./primitives";
import { SHEET_TYPES, type SheetType } from "./sheet-type";
import {
  EMPTY_DRAFT,
  field,
  type DraftFieldKey,
  type DrawingMetadataDraft,
  type Evidence,
  type Field,
  type SheetDiscipline,
} from "./types";
import { mergeField } from "./merge";

/** Bump when the prompt or the merge policy changes, so stored audits stay comparable. */
export const AI_READ_VERSION = "1.0.0";

/**
 * A model's reading never outranks a labelled title-block hit (0.95) on its
 * own. 0.9 lands it in the "high" band when the model is sure — which is
 * right for a scan, where it is the only reading there is — while leaving the
 * rules to win an outright disagreement when they are label-anchored.
 */
export const AI_MAX_CONFIDENCE = 0.9;

/** Below this the model's value is shown as an alternate, never as the proposal. */
export const AI_MIN_CONFIDENCE = 0.35;

const DISCIPLINES: readonly SheetDiscipline[] = [
  "GENERAL", "CIVIL", "LANDSCAPE", "ARCHITECTURAL", "INTERIORS", "STRUCTURAL",
  "MECHANICAL", "ELECTRICAL", "PLUMBING", "FIRE_PROTECTION", "TELECOM",
];

/**
 * The answer shape. Every value is nullable and every value has a confidence:
 * "I could not read it" is an expected answer and must be sayable without
 * inventing a string. `evidence` is the text the model read it from, so the
 * UI can show "from “REV C”" exactly as it does for a regex hit.
 */
export const AI_READ_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "sheetNumber", "title", "sheetType", "discipline", "revision", "revisionDate",
    "projectName", "projectNumber", "architect", "engineer", "scale", "notes",
  ],
  properties: {
    sheetNumber: readField("The sheet / drawing number exactly as printed, e.g. A-101, S2.01, E-301."),
    title: readField("The sheet title / drawing description, e.g. Ground Floor Plan, Sections A-A & B-B."),
    sheetType: enumField("What kind of drawing the sheet is.", SHEET_TYPES),
    discipline: enumField("The discipline the sheet belongs to.", DISCIPLINES),
    revision: readField("The CURRENT revision token: the latest row of the revision table, or the REV box. A letter (C), a number (3) or P1/C2."),
    revisionDate: readField("The date of that current revision, ISO YYYY-MM-DD. Read the title block's own date format; day-first for Dutch/Spanish/UK sheets."),
    projectName: readField("The project name."),
    projectNumber: readField("The project / job / commission number."),
    architect: readField("The architect or architectural practice named in the title block (firm name as printed)."),
    engineer: readField("The engineer or engineering consultancy named in the title block (structural, MEP, civil — firm name as printed)."),
    scale: readField("The drawing scale as printed, e.g. 1:100 or AS SHOWN."),
    notes: {
      type: "string",
      description: "One short sentence on anything a person should check: an empty title block, two revision dates, a title that names several views.",
    },
  },
} as const;

/**
 * Only keywords the structured-output grammar accepts: `anyOf` for nullable,
 * `enum` for a vocabulary, descriptions for the rest. Numeric `minimum` /
 * `maximum` are not in that grammar, so the 0..1 range is stated in words and
 * clamped on the way in (`clamp` below).
 */
function readField(description: string) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["value", "confidence", "evidence"],
    properties: {
      value: { anyOf: [{ type: "string" }, { type: "null" }], description },
      confidence: { type: "number", description: "Between 0 and 1. 0 = not readable, 1 = printed plainly and unambiguous." },
      evidence: { anyOf: [{ type: "string" }, { type: "null" }], description: "The exact printed text the value was read from, or null." },
    },
  } as const;
}

function enumField(description: string, vocabulary: readonly string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["value", "confidence"],
    properties: {
      value: { anyOf: [{ type: "string", enum: [...vocabulary] }, { type: "null" }], description },
      confidence: { type: "number", description: "Between 0 and 1." },
    },
  } as const;
}

export type AiReadInput = {
  filename: string;
  /** Title-block text from the PDF's text layer, when it had one. */
  titleBlockText?: string | null;
  /** What the deterministic rules read, so the model can confirm or correct. */
  rulesSheetNumber?: string | null;
  rulesTitle?: string | null;
};

/**
 * The instruction that goes with the page. The page itself (as one or more
 * PDF document blocks: the whole sheet, then the title-block strips at higher
 * magnification) is attached by the server before this text.
 */
export function buildAiReadPrompt(input: AiReadInput): string {
  const text = (input.titleBlockText ?? "").trim();
  return [
    "You are reading ONE sheet of an architectural or engineering drawing set.",
    "Attached: the full page, then the right-hand strip and the bottom strip of the same page",
    "at higher magnification — title blocks live in one of those strips. Read the TITLE BLOCK",
    "(and the revision table, when there is one). Do not read values off the drawing itself.",
    "",
    "Return every field as {value, confidence, evidence}. A field you cannot read is",
    "{value: null, confidence: 0, evidence: null} — never guess a value to fill a box.",
    "Confidence is about the printed text: 0.9+ only when it is plainly legible and labelled.",
    "",
    "Rules:",
    "- sheetNumber is the sheet's own number (A-101), not the project number and not a detail callout.",
    "- revision is the CURRENT one: the last filled row of a revision table, or the REV box.",
    "- revisionDate is that revision's date as ISO YYYY-MM-DD. Title blocks in Dutch, Spanish or",
    "  British English write day first (03/11/2026 = 3 November). American sheets write month first.",
    "  When the order is ambiguous, lower the confidence below 0.6.",
    "- architect / engineer are the FIRMS named as such in the title block. An in-house sheet",
    "  names only one firm: put it under the discipline it is (an architecture firm is the architect).",
    "- sheetType: FLOOR_PLAN, SECTION, ELEVATION, DETAIL, ROOF_PLAN, REFLECTED_CEILING_PLAN, FOUNDATION_PLAN,",
    "  SITE_PLAN, DEMOLITION, SCHEDULE, DIAGRAM, THREE_D, SURVEY, LANDSCAPE, GENERAL_NOTES, COVER, or OTHER.",
    "  Decide from the title first, then from what the drawing shows.",
    "- Text may be in English, Dutch, Spanish or Papiamento. Keep names as printed; do not translate them.",
    "",
    `Filename: ${input.filename || "(none)"}`,
    input.rulesSheetNumber ? `A pattern reader proposed sheet number ${input.rulesSheetNumber}; confirm or correct it.` : "",
    input.rulesTitle ? `A pattern reader proposed the title "${input.rulesTitle}"; confirm or correct it.` : "",
    text
      ? ["", "Text layer of the title-block region (draw order, columns may be shuffled):", text.slice(0, 2500)].join("\n")
      : "This PDF has no text layer — read the image.",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/* ------------------------------------------------------------------ *
 * The answer
 * ------------------------------------------------------------------ */

export type AiReadValue = { value: string | null; confidence: number; evidence: string | null };

export type AiTitleBlockRead = {
  sheetNumber: AiReadValue;
  title: AiReadValue;
  sheetType: { value: SheetType | null; confidence: number };
  discipline: { value: SheetDiscipline | null; confidence: number };
  revision: AiReadValue;
  revisionDate: AiReadValue;
  projectName: AiReadValue;
  projectNumber: AiReadValue;
  architect: AiReadValue;
  engineer: AiReadValue;
  scale: AiReadValue;
  notes: string;
};

function clamp(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function readValue(raw: unknown): AiReadValue {
  if (!raw || typeof raw !== "object") return { value: null, confidence: 0, evidence: null };
  const r = raw as Record<string, unknown>;
  const value = typeof r.value === "string" ? r.value.replace(/\s+/g, " ").trim() : null;
  const evidence = typeof r.evidence === "string" ? r.evidence.replace(/\s+/g, " ").trim() : null;
  return {
    value: value || null,
    confidence: value ? clamp(r.confidence) : 0,
    evidence: evidence || null,
  };
}

function readEnum<T extends string>(raw: unknown, vocabulary: readonly T[]): { value: T | null; confidence: number } {
  if (!raw || typeof raw !== "object") return { value: null, confidence: 0 };
  const r = raw as Record<string, unknown>;
  const token = typeof r.value === "string" ? r.value.trim().toUpperCase().replace(/[\s-]+/g, "_") : "";
  const value = (vocabulary as readonly string[]).includes(token) ? (token as T) : null;
  return { value, confidence: value ? clamp(r.confidence) : 0 };
}

/**
 * Parse the model's text into a reading. Null when it is not the JSON object
 * asked for — the caller then carries on with the rules' draft, which is the
 * same thing that happens when there is no key.
 */
export function parseAiRead(text: string): AiTitleBlockRead | null {
  let parsed: unknown;
  try {
    const trimmed = String(text ?? "").trim();
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    parsed = JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const r = parsed as Record<string, unknown>;
  return {
    sheetNumber: readValue(r.sheetNumber),
    title: readValue(r.title),
    sheetType: readEnum<SheetType>(r.sheetType, SHEET_TYPES),
    discipline: readEnum<SheetDiscipline>(r.discipline, DISCIPLINES),
    revision: readValue(r.revision),
    revisionDate: readValue(r.revisionDate),
    projectName: readValue(r.projectName),
    projectNumber: readValue(r.projectNumber),
    architect: readValue(r.architect),
    engineer: readValue(r.engineer),
    scale: readValue(r.scale),
    notes: typeof r.notes === "string" ? r.notes.trim() : "",
  };
}

/* ------------------------------------------------------------------ *
 * Reading -> draft
 * ------------------------------------------------------------------ */

const REV_TOKEN_RE = /^(?:[A-Z]|\d{1,3}|[A-Z]\d{1,2}|P\d{1,2}|C\d{1,2}|-)$/;

/** `YYYY-MM-DD` that is a real calendar date, or null. */
export function normaliseIsoDate(raw: string | null): string | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!isRealDate(y, mo, d)) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Sheet numbers are stored upper-case; a recognised pattern is normalised the
 *  same way the rules normalise it, anything else is kept as printed. */
export function normaliseSheetNumber(raw: string | null): string | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase();
  if (!upper || upper.length > 24) return null;
  const hits = scanSheetNumbers(upper, "ai-read");
  return hits.length > 0 ? hits[0].value : upper;
}

function normaliseRevision(raw: string | null): string | null {
  if (!raw) return null;
  const token = raw.trim().toUpperCase().replace(/^REV(?:ISION)?\.?\s*/, "");
  return REV_TOKEN_RE.test(token) ? token : null;
}

function evidenceFor(pattern: string, read: AiReadValue, model: string): Evidence[] {
  return [
    {
      source: "ai-read",
      pattern,
      fragment: read.evidence ?? read.value ?? "",
      note: `Read off the sheet by ${model}. Confirm it.`,
    },
  ];
}

function toField(
  pattern: string,
  read: AiReadValue,
  model: string,
  normalise: (v: string | null) => string | null = (v) => v,
): Field<string> | null {
  const value = normalise(read.value);
  if (!value || read.confidence < AI_MIN_CONFIDENCE) return null;
  return field(value, Math.min(AI_MAX_CONFIDENCE, read.confidence), evidenceFor(pattern, read, model));
}

const MAX_NAME_LEN = 120;
const cleanName = (v: string | null) => (v && v.length >= 2 && v.length <= MAX_NAME_LEN ? v : null);

/**
 * Turn a reading into a draft — the same shape the rules produce, so the
 * merge, the form and the audit treat it as one more source.
 */
export function aiReadToDraft(read: AiTitleBlockRead, model: string): DrawingMetadataDraft {
  const draft: DrawingMetadataDraft = { ...EMPTY_DRAFT, warnings: [] };
  draft.sheetNumber = toField("ai.sheet-number", read.sheetNumber, model, normaliseSheetNumber);
  draft.title = toField("ai.title", read.title, model, cleanName);
  draft.projectName = toField("ai.project-name", read.projectName, model, cleanName);
  draft.projectNumber = toField("ai.project-number", read.projectNumber, model, (v) =>
    v && v.length <= 32 ? v.toUpperCase() : null,
  );
  draft.revision = toField("ai.revision", read.revision, model, normaliseRevision);
  draft.issueDate = toField("ai.revision-date", read.revisionDate, model, normaliseIsoDate);
  draft.architect = toField("ai.architect", read.architect, model, cleanName);
  draft.engineer = toField("ai.engineer", read.engineer, model, cleanName);

  if (read.discipline.value && read.discipline.confidence >= AI_MIN_CONFIDENCE) {
    draft.discipline = field(read.discipline.value, Math.min(AI_MAX_CONFIDENCE, read.discipline.confidence), [
      { source: "ai-read", pattern: "ai.discipline", fragment: read.discipline.value, note: `Read off the sheet by ${model}.` },
    ]);
  } else if (draft.sheetNumber) {
    // No discipline from the model: the sheet prefix still says something.
    const hits = scanSheetNumbers(draft.sheetNumber.value, "ai-read");
    if (hits.length > 0) {
      draft.discipline = field(hits[0].hit.discipline, draft.sheetNumber.confidence, [
        { source: "ai-read", pattern: "discipline.from-sheet-prefix", fragment: draft.sheetNumber.value },
      ]);
    }
  }

  if (read.notes) draft.warnings.push(`AI: ${read.notes}`);
  return draft;
}

/** The model's sheet-type opinion as a field, or null when it had none. */
export function aiSheetType(read: AiTitleBlockRead, model: string): Field<SheetType> | null {
  if (!read.sheetType.value || read.sheetType.confidence < AI_MIN_CONFIDENCE) return null;
  return field(read.sheetType.value, Math.min(AI_MAX_CONFIDENCE, read.sheetType.confidence), [
    {
      source: "ai-read",
      pattern: "sheet-type.ai-read",
      fragment: read.title.value ?? read.sheetType.value,
      note: `Read off the sheet by ${model}. Confirm it.`,
    },
  ]);
}

/* ------------------------------------------------------------------ *
 * Merge policy
 * ------------------------------------------------------------------ */

/** Two readings of the same field, compared loosely: case and punctuation do
 *  not make "GROUND FLOOR PLAN" and "Ground floor plan" a disagreement. */
export function sameReading(a: string, b: string): boolean {
  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "");
  return norm(a) === norm(b);
}

const AGREEMENT_BONUS = 0.06;

/**
 * Merge the rules' draft (filename + text layer) with the model's.
 *
 *   agree     one field, rules' value kept, confidence raised a little, the
 *             model's evidence appended — two independent readers said so.
 *   one side  that side's field, as it is.
 *   disagree  the more confident wins, the other is the first alternate and
 *             the sheet gets a warning naming both. A label-anchored rules hit
 *             (>= 0.9) beats a model at its cap, which is the intent.
 */
export function mergeAiRead(rules: DrawingMetadataDraft, ai: DrawingMetadataDraft | null): DrawingMetadataDraft {
  if (!ai) return rules;
  const out: DrawingMetadataDraft = { ...EMPTY_DRAFT, warnings: [...rules.warnings, ...ai.warnings] };

  const keys: Array<Exclude<DraftFieldKey, "discipline">> = [
    "sheetNumber", "title", "projectNumber", "projectName", "revision", "issueDate", "architect", "engineer",
  ];
  for (const key of keys) {
    const a = rules[key];
    const b = ai[key];
    if (a && b) {
      if (sameReading(a.value, b.value)) {
        out[key] = field(a.value, Math.min(0.98, Math.max(a.confidence, b.confidence) + AGREEMENT_BONUS), [...a.evidence, ...b.evidence], a.alternates);
      } else {
        const merged = mergeField(a, b);
        out[key] = merged;
        out.warnings.push(`${key}: the pattern reader and the AI disagree (${a.value} vs ${b.value}) — confirm before saving.`);
      }
    } else {
      out[key] = a ?? b ?? null;
    }
  }

  const da = rules.discipline;
  const db = ai.discipline;
  if (da && db) {
    out.discipline = da.value === db.value
      ? field(da.value, Math.min(0.98, Math.max(da.confidence, db.confidence) + AGREEMENT_BONUS), [...da.evidence, ...db.evidence])
      : mergeField<SheetDiscipline>(da, db);
    if (da.value !== db.value) {
      out.warnings.push(`discipline: the pattern reader and the AI disagree (${da.value} vs ${db.value}) — confirm before saving.`);
    }
  } else {
    out.discipline = da ?? db ?? null;
  }

  out.warnings = [...new Set(out.warnings)];
  return out;
}
