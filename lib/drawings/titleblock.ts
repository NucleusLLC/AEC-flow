/**
 * Title-block text -> candidate metadata.
 *
 * INPUT IS ALREADY-EXTRACTED TEXT. Reading a PDF is I/O; interpreting what was
 * read is arithmetic. They are split so the interpretation is pure, unit
 * testable and reproducible, and so the reader can be swapped (or run in a
 * different process, or never run at all for DWG) without touching this file.
 * The reader lives behind `./pdf-text.ts`.
 *
 * Two passes, in order of trustworthiness:
 *
 *   1. LABEL-ANCHORED. A title block is a form: `PROJECT No.` sits next to its
 *      value. When we find the label we know what the neighbouring token means,
 *      so we can accept formats the blind scanners would refuse (a house sheet
 *      code like `X-99`, a project number with no year in it).
 *
 *   2. BLIND SCAN. For fields pass 1 missed, run the same primitive scanners
 *      used on filenames across the whole text, at a discount. A title block
 *      that ships its sheet number as a lone `A-101` with no label is common;
 *      a lone `A-101` somewhere in a page of notes is a coin flip.
 *
 * Extracted PDF text arrives in draw order, not reading order, so a label and
 * its value routinely land on ADJACENT lines rather than the same one. Pass 1
 * handles both and marks the next-line form as slightly less certain.
 */

import {
  scanDates,
  scanProjectNumbers,
  scanRevisions,
  scanSheetNumbers,
} from "./primitives";
import {
  EMPTY_DRAFT,
  field,
  type Alternate,
  type DrawingMetadataDraft,
  type Evidence,
  type Field,
} from "./types";

type LabelTarget = "sheetNumber" | "title" | "projectName" | "projectNumber" | "revision" | "issueDate";

type LabelRule = { target: LabelTarget; label: RegExp; id: string };

/**
 * Longest / most specific labels first — `PROJECT NO` must win over `PROJECT`,
 * and `SHEET TITLE` over `SHEET`. The list is order-sensitive and matching
 * stops at the first hit on a line.
 */
const LABEL_RULES: readonly LabelRule[] = [
  { target: "projectNumber", id: "label.project-number", label: /PROJECT\s*(?:NO|NUM(?:BER)?|#)\b\.?/ },
  { target: "projectNumber", id: "label.job-number", label: /(?:JOB|COMM(?:ISSION)?|CONTRACT)\s*(?:NO|NUM(?:BER)?|#)\b\.?/ },
  { target: "projectName", id: "label.project-name", label: /PROJECT\s*(?:NAME|TITLE)\b\.?/ },
  { target: "projectName", id: "label.project", label: /PROJECT\b\.?/ },
  { target: "projectName", id: "label.job-name", label: /JOB\s*NAME\b\.?/ },
  { target: "title", id: "label.sheet-title", label: /(?:SHEET|DRAWING|DRG|DWG)\s*(?:TITLE|NAME)\b\.?/ },
  { target: "title", id: "label.title", label: /TITLE\b\.?/ },
  { target: "sheetNumber", id: "label.sheet-number", label: /(?:SHEET|DRAWING|DRG|DWG)\s*(?:NO|NUM(?:BER)?|#)\b\.?/ },
  { target: "sheetNumber", id: "label.sheet", label: /SHEET\b\.?/ },
  { target: "revision", id: "label.revision", label: /REV(?:ISION)?\s*(?:NO|NUM(?:BER)?|#)?\b\.?/ },
  { target: "issueDate", id: "label.issue-date", label: /(?:ISSUE|PLOT|PRINT|DRAWN)\s*DATE\b\.?/ },
  { target: "issueDate", id: "label.date", label: /DATED?\b\.?/ },
];

/** Values that mean "this box is empty". */
const NULL_VALUES = new Set(["", "-", "--", "—", "–", "N/A", "NA", "TBC", "TBD", "XXX", "X", "."]);

const MAX_NAME_LEN = 120;

function cleanValue(raw: string): string {
  return raw
    .replace(/^[\s:.\-–—#=|]+/, "")
    .replace(/[\s:.\-–—#=|]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Does this line look like another label rather than a value? */
function looksLikeLabel(v: string): boolean {
  const u = v.toUpperCase();
  return LABEL_RULES.some((r) => {
    const m = new RegExp(`^${r.label.source}`).exec(u);
    return m !== null && cleanValue(u.slice(m[0].length)) === "";
  });
}

const CODE_RE = /^[A-Z0-9][A-Z0-9./\- ]{0,19}$/;
const REV_TOKEN_RE = /^(?:[A-Z]|\d{1,2}|[A-Z]\d|P\d{1,2}|C\d{1,2})$/;

/**
 * Interpret title-block text. Never throws; unrecognisable text yields a draft
 * with every field null.
 */
export function extractFromTitleBlockText(text: string): DrawingMetadataDraft {
  const source = String(text ?? "");
  const draft: DrawingMetadataDraft = { ...EMPTY_DRAFT, warnings: [] };
  if (!source.trim()) return { ...draft, warnings: ["No text layer content to interpret"] };

  const lines = source
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0);

  /* -------------------------------------------------- pass 1: labels */

  type Found = { value: string; confidence: number; evidence: Evidence[] };
  const found: Partial<Record<LabelTarget, Found[]>> = {};
  const record = (t: LabelTarget, f: Found) => {
    (found[t] ??= []).push(f);
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();
    for (const rule of LABEL_RULES) {
      const m = new RegExp(`^${rule.label.source}`).exec(upper);
      if (!m) continue;

      let value = cleanValue(line.slice(m[0].length));
      let sameLine = true;
      if (NULL_VALUES.has(value.toUpperCase())) {
        // Label alone on its line — the value is very likely the next line.
        const next = lines[i + 1];
        if (next && !looksLikeLabel(next)) {
          value = cleanValue(next);
          sameLine = false;
        } else {
          value = "";
        }
      }
      if (!value || NULL_VALUES.has(value.toUpperCase())) break;

      const penalty = sameLine ? 0 : 0.08;
      const ev = (pattern: string, note?: string): Evidence[] => [
        {
          source: "titleblock-label",
          pattern,
          fragment: sameLine ? line : `${line} / ${value}`,
          index: i,
          note: sameLine ? note : [note, "Value taken from the following line"].filter(Boolean).join("; "),
        },
      ];

      switch (rule.target) {
        case "sheetNumber": {
          const hits = scanSheetNumbers(value, "titleblock-label");
          if (hits.length > 0) {
            record("sheetNumber", {
              value: hits[0].value,
              confidence: 0.95 - penalty,
              evidence: ev(`${rule.id}+sheet-pattern`),
            });
          } else if (CODE_RE.test(value.toUpperCase()) && /\d/.test(value)) {
            // The label vouches for it even though the format is unfamiliar.
            record("sheetNumber", {
              value: value.toUpperCase(),
              confidence: 0.78 - penalty,
              evidence: ev(`${rule.id}+raw-code`, "Label-vouched, but not a recognised sheet-number format"),
            });
          }
          break;
        }
        case "projectNumber": {
          const hits = scanProjectNumbers(value, "titleblock-label");
          if (hits.length > 0) {
            record("projectNumber", {
              value: hits[0].value,
              confidence: 0.95 - penalty,
              evidence: ev(`${rule.id}+project-pattern`),
            });
          } else if (CODE_RE.test(value.toUpperCase()) && /\d/.test(value)) {
            record("projectNumber", {
              value: value.toUpperCase(),
              confidence: 0.8 - penalty,
              evidence: ev(`${rule.id}+raw-code`),
            });
          }
          break;
        }
        case "revision": {
          const hits = scanRevisions(`REV ${value}`, "titleblock-label");
          const token = value.toUpperCase();
          if (REV_TOKEN_RE.test(token)) {
            record("revision", {
              value: token,
              confidence: 0.93 - penalty,
              evidence: ev(`${rule.id}+token`),
            });
          } else if (hits.length > 0) {
            record("revision", {
              value: hits[0].value,
              confidence: 0.85 - penalty,
              evidence: ev(`${rule.id}+keyword`),
            });
          }
          break;
        }
        case "issueDate": {
          const hits = scanDates(value, "titleblock-label");
          if (hits.length > 0) {
            record("issueDate", {
              value: hits[0].value,
              // The label removes the "is this even a date" doubt but not the
              // day-first / month-first doubt, so the scanner's own ambiguity
              // discount is preserved.
              confidence: Math.min(0.95, hits[0].confidence + 0.05) - penalty,
              evidence: ev(`${rule.id}+${hits[0].evidence[0]?.pattern ?? "date"}`, hits[0].evidence[0]?.note),
            });
          }
          break;
        }
        case "projectName":
        case "title": {
          const looksCodeOnly = /^[A-Z0-9\-./ ]+$/.test(value.toUpperCase()) && !/[A-Z]{3}/i.test(value);
          if (value.length >= 3 && value.length <= MAX_NAME_LEN && !looksCodeOnly) {
            record(rule.target, {
              value: titleCaseIfShouty(value),
              confidence: 0.88 - penalty,
              evidence: ev(rule.id),
            });
          }
          break;
        }
      }
      break; // one label per line
    }
  }

  const resolve = (t: LabelTarget): Field<string> | null => {
    const list = (found[t] ?? []).slice().sort((a, b) => b.confidence - a.confidence);
    if (list.length === 0) return null;
    const [best, ...rest] = list;
    const alternates: Alternate<string>[] = [];
    for (const r of rest) {
      if (r.value !== best.value && !alternates.some((a) => a.value === r.value)) {
        alternates.push({ value: r.value, confidence: r.confidence, evidence: r.evidence });
      }
    }
    if (alternates.length > 0) {
      draft.warnings.push(
        `Title block gave more than one ${t}: ${[best.value, ...alternates.map((a) => a.value)].join(", ")}.`,
      );
    }
    return field(best.value, best.confidence, best.evidence, alternates);
  };

  draft.sheetNumber = resolve("sheetNumber");
  draft.title = resolve("title");
  draft.projectName = resolve("projectName");
  draft.projectNumber = resolve("projectNumber");
  draft.revision = resolve("revision");
  draft.issueDate = resolve("issueDate");

  /* -------------------------------------------------- pass 2: blind scan */

  const discount = (a: Alternate<string>): Alternate<string> => ({
    ...a,
    confidence: a.confidence * 0.8,
    evidence: a.evidence.map((e) => ({
      ...e,
      source: "titleblock-scan",
      note: [e.note, "No label anchored this value"].filter(Boolean).join("; "),
    })),
  });

  if (!draft.sheetNumber) {
    const hits = scanSheetNumbers(source, "titleblock-scan").map(discount);
    if (hits.length > 0) {
      const [best, ...rest] = hits;
      draft.sheetNumber = field(best.value, best.confidence, best.evidence, rest);
    }
  }
  if (!draft.projectNumber) {
    const hits = scanProjectNumbers(source, "titleblock-scan").map(discount);
    if (hits.length > 0) {
      const [best, ...rest] = hits;
      draft.projectNumber = field(best.value, best.confidence, best.evidence, rest);
    }
  }
  if (!draft.revision) {
    const hits = scanRevisions(source, "titleblock-scan").map(discount);
    if (hits.length > 0) {
      const [best, ...rest] = hits;
      draft.revision = field(best.value, best.confidence, best.evidence, rest);
    }
  }
  if (!draft.issueDate) {
    const hits = scanDates(source, "titleblock-scan").map(discount);
    if (hits.length > 0) {
      const [best, ...rest] = hits;
      draft.issueDate = field(best.value, best.confidence, best.evidence, rest);
      if (rest.length > 0) {
        draft.warnings.push(
          `Title block contains ${hits.length} dates and none was labelled — the issue date is a guess.`,
        );
      }
    }
  }

  // Discipline follows the sheet prefix, and only the sheet prefix.
  if (draft.sheetNumber) {
    const hits = scanSheetNumbers(draft.sheetNumber.value, "titleblock-scan");
    if (hits.length > 0) {
      draft.discipline = field(
        hits[0].hit.discipline,
        draft.sheetNumber.confidence,
        draft.sheetNumber.evidence.map((e) => ({ ...e, pattern: "discipline.from-sheet-prefix" })),
      );
    }
  }

  return draft;
}

/** Title blocks are usually SET IN CAPS. Leave mixed case alone. */
function titleCaseIfShouty(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .replace(/(^|[\s\-–—(/])([a-z])/g, (_, pre: string, ch: string) => pre + ch.toUpperCase());
}
