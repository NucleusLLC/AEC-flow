/**
 * Combine drafts from several sources (filename, title block, and later OCR)
 * into the single proposal shown to the user.
 *
 * The rules, and why:
 *
 *   agreement   -> raise confidence, but only a little, and never to 1.0. Two
 *                  sources agreeing is meaningful corroboration; it is not
 *                  proof, because both can be wrong the same way (a file named
 *                  after a title block that was itself never updated).
 *
 *   disagreement-> keep the stronger reading, DEMOTE it, keep the loser as an
 *                  alternate, and raise a warning. A conflict between the
 *                  filename and the drawing itself is exactly the case a human
 *                  must adjudicate; silently preferring one would hide it.
 *
 *   absence     -> stays absent. There is no filling in of blanks by inference.
 */

import {
  bandOf,
  clamp01,
  EMPTY_DRAFT,
  type Alternate,
  type DrawingMetadataDraft,
  type Field,
  type SheetDiscipline,
} from "./types";

const AGREEMENT_BONUS = 0.06;
const DISAGREEMENT_PENALTY = 0.08;
const CONFIDENCE_CEILING = 0.98;

export function mergeField<T>(a: Field<T> | null, b: Field<T> | null): Field<T> | null {
  if (!a) return b;
  if (!b) return a;

  const [strong, weak] = a.confidence >= b.confidence ? [a, b] : [b, a];

  if (Object.is(strong.value, weak.value)) {
    const confidence = clamp01(Math.min(CONFIDENCE_CEILING, strong.confidence + AGREEMENT_BONUS));
    return {
      value: strong.value,
      confidence,
      band: bandOf(confidence),
      evidence: [...strong.evidence, ...weak.evidence],
      alternates: dedupeAlternates(strong.value, [...strong.alternates, ...weak.alternates]),
    };
  }

  const confidence = clamp01(strong.confidence - DISAGREEMENT_PENALTY);
  return {
    value: strong.value,
    confidence,
    band: bandOf(confidence),
    evidence: strong.evidence,
    alternates: dedupeAlternates(strong.value, [
      { value: weak.value, confidence: weak.confidence, evidence: weak.evidence },
      ...strong.alternates,
      ...weak.alternates,
    ]),
  };
}

function dedupeAlternates<T>(primary: T, list: Alternate<T>[]): Alternate<T>[] {
  const out: Alternate<T>[] = [];
  for (const a of list) {
    if (Object.is(a.value, primary)) continue;
    const existing = out.find((o) => Object.is(o.value, a.value));
    if (existing) {
      existing.confidence = Math.max(existing.confidence, a.confidence);
      existing.evidence = [...existing.evidence, ...a.evidence];
    } else {
      out.push({ ...a });
    }
  }
  return out.sort((x, y) => y.confidence - x.confidence);
}

/** Did these two drafts disagree on `key`? Used to word the warning. */
function conflictNote(key: string, a: string, b: string): string {
  return `${key}: filename and drawing content disagree (${a} vs ${b}) — confirm before saving.`;
}

/**
 * Merge in order of increasing authority is NOT required — `mergeField` is
 * commutative except for tie-breaking, which falls to the first argument.
 * Pass the title-block draft second so it wins exact ties.
 */
export function mergeDrafts(
  filenameDraft: DrawingMetadataDraft,
  contentDraft: DrawingMetadataDraft | null,
): DrawingMetadataDraft {
  if (!contentDraft) return filenameDraft;

  const warnings = [...filenameDraft.warnings, ...contentDraft.warnings];

  const stringKeys = ["sheetNumber", "title", "projectNumber", "projectName", "revision", "issueDate"] as const;
  for (const k of stringKeys) {
    const a = filenameDraft[k];
    const b = contentDraft[k];
    if (a && b && a.value !== b.value) warnings.push(conflictNote(k, a.value, b.value));
  }

  const discA = filenameDraft.discipline;
  const discB = contentDraft.discipline;
  if (discA && discB && discA.value !== discB.value) {
    warnings.push(conflictNote("discipline", discA.value, discB.value));
  }

  return {
    ...EMPTY_DRAFT,
    sheetNumber: mergeField(filenameDraft.sheetNumber, contentDraft.sheetNumber),
    discipline: mergeField<SheetDiscipline>(filenameDraft.discipline, contentDraft.discipline),
    title: mergeField(filenameDraft.title, contentDraft.title),
    projectNumber: mergeField(filenameDraft.projectNumber, contentDraft.projectNumber),
    projectName: mergeField(filenameDraft.projectName, contentDraft.projectName),
    revision: mergeField(filenameDraft.revision, contentDraft.revision),
    issueDate: mergeField(filenameDraft.issueDate, contentDraft.issueDate),
    warnings: [...new Set(warnings)],
  };
}
