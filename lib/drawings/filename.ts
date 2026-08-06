/**
 * Filename -> candidate metadata.
 *
 * A filename is the cheapest signal available: it costs nothing to read, needs
 * no PDF library, and works for DWG and RVT where we cannot read the content at
 * all. It is also the signal a practice controls — a firm with a naming standard
 * gets near-perfect extraction from this module alone.
 *
 * SUPPORTED FORMS (each is exercised by a fixture in `fixtures.ts`):
 *
 *   A-101                      prefix + separator + number
 *   A101                       prefix + number, run together
 *   A.101 / A_101 / A 101      other separators
 *   ID-501                     two-letter discipline prefix
 *   A-101.1                    sub-sheet suffix
 *   A-101_Rev-B                keyword revision, letter
 *   A-101 Rev 02               keyword revision, numeric
 *   ZA-2026-121-A-101          project number prefix + sheet
 *   ... 2026-08-04             ISO date
 *   ... 04-08-2026             DD-MM-YYYY (day-first; flagged when ambiguous)
 *   ... 04 Aug 2026            DD MMM YYYY
 *   ... Aug 4 2026             MMM DD YYYY
 *   ... 20260804               compact ISO (low confidence)
 *
 * NOT SUPPORTED, on purpose:
 *   - A bare trailing letter as a revision (`A-101-B`). Ambiguous with a sheet
 *     series suffix; see `scanRevisions` in `primitives.ts`.
 *   - Sheet numbers whose prefix is not in `DISCIPLINE_PREFIXES`.
 *   - `A-1.01` (single leading digit). Rare; would loosen the number pattern
 *     enough to start matching version tags like `v1.2`.
 */

import {
  scanDates,
  scanProjectNumbers,
  scanRevisions,
  scanSheetNumbers,
} from "./primitives";
import { EMPTY_DRAFT, field, type DrawingMetadataDraft } from "./types";

/** Strip the extension. Handles `A-101.pdf` and dotless names; never throws. */
export function splitExtension(filename: string): { base: string; ext: string } {
  const name = String(filename ?? "").replace(/^.*[\\/]/, "");
  const dot = name.lastIndexOf(".");
  // A dot at position 0 is a leading-dot file, not an extension. A "extension"
  // longer than 5 chars is almost certainly part of the name.
  if (dot <= 0 || name.length - dot - 1 > 5) return { base: name, ext: "" };
  return { base: name.slice(0, dot), ext: name.slice(dot + 1).toLowerCase() };
}

/** Turn separator soup into spaces so leftover-title extraction is readable. */
function humanise(s: string): string {
  return s
    .replace(/[_]+/g, " ")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s\-–—.,]+|[\s\-–—.,]+$/g, "")
    .trim();
}

/**
 * Words that carry no title meaning. Used ONLY to decide whether a leftover is
 * entirely noise — never to strip words out of the middle of a title, because
 * "Cover Sheet" and "Drawing List" are real sheet titles.
 */
const TITLE_STOPWORDS = new Set([
  "REV", "REVISION", "ISSUE", "PDF", "DWG", "FINAL", "COPY", "NEW", "OLD",
  "V1", "V2", "SCAN", "SCANNED", "UNTITLED", "DOCUMENT", "FILE",
]);

/**
 * Extract every field we can see in a filename.
 *
 * Total: any input, including `""`, `undefined` coerced to a string, or 400
 * characters of punctuation, produces a draft rather than an exception.
 */
export function extractFromFilename(filename: string): DrawingMetadataDraft {
  const { base } = splitExtension(String(filename ?? ""));
  if (!base.trim()) return { ...EMPTY_DRAFT, warnings: ["Empty filename"] };

  const draft: DrawingMetadataDraft = { ...EMPTY_DRAFT, warnings: [] };

  // Regions of `base` already claimed by a structured field. What is left over
  // is the only thing eligible to be a title.
  const claimed: Array<[number, number]> = [];

  const sheets = scanSheetNumbers(base, "filename");
  if (sheets.length > 0) {
    const [best, ...rest] = sheets;
    draft.sheetNumber = field(
      best.value,
      best.confidence,
      best.evidence,
      rest.map(({ value, confidence, evidence }) => ({ value, confidence, evidence })),
    );
    draft.discipline = field(
      best.hit.discipline,
      // The discipline is a lookup on a prefix we already matched, so it is at
      // least as certain as the sheet number that produced it.
      best.confidence,
      best.evidence.map((e) => ({ ...e, pattern: "discipline.from-sheet-prefix" })),
    );
    // Claim EVERY sheet-shaped token, not just the winner: a cross-referenced
    // second sheet number is not part of the title either.
    for (const s of sheets) claimed.push([s.hit.index, s.hit.index + s.hit.length]);
    if (rest.length > 0) {
      draft.warnings.push(
        `More than one sheet-number-shaped token in the filename (${sheets
          .map((s) => s.value)
          .join(", ")}) — confirm the right one.`,
      );
    }
  }

  const projects = scanProjectNumbers(base, "filename");
  if (projects.length > 0) {
    const [best, ...rest] = projects;
    draft.projectNumber = field(best.value, best.confidence, best.evidence, rest);
    for (const e of best.evidence) {
      if (e.index !== undefined) claimed.push([e.index, e.index + e.fragment.length]);
    }
  }

  const revisions = scanRevisions(base, "filename");
  if (revisions.length > 0) {
    const [best, ...rest] = revisions;
    draft.revision = field(best.value, best.confidence, best.evidence, rest);
    for (const e of best.evidence) {
      if (e.index !== undefined) claimed.push([e.index, e.index + e.fragment.length]);
    }
  }

  const dates = scanDates(base, "filename");
  if (dates.length > 0) {
    const [best, ...rest] = dates;
    draft.issueDate = field(best.value, best.confidence, best.evidence, rest);
    for (const e of best.evidence) {
      if (e.index !== undefined) claimed.push([e.index, e.index + e.fragment.length]);
    }
    if (rest.length > 0) {
      draft.warnings.push(
        `Filename contains more than one date (${dates.map((d) => d.value).join(", ")}) — ` +
          `the issue date may not be the one chosen.`,
      );
    }
  }

  // Whatever survives is the candidate title. This is genuinely weak: a
  // filename that is only a code has no title, and a filename that is only
  // words has no way to tell a sheet title from a project name. Scored low on
  // purpose so the UI never presents it as settled.
  const leftover = humanise(excise(base, claimed));
  const words = leftover.split(/\s+/).filter((w) => w && w !== "-");
  const meaningful = words.filter((w) => !TITLE_STOPWORDS.has(w.toUpperCase()));
  // A title needs at least one genuine word: a purely alphabetic run of three
  // or more characters. That is what separates `Cover Sheet` from `scan0012`
  // and `DSC00123`, which are camera and scanner artefacts, not titles.
  const hasRealWord = words.some((w) => /^[A-Za-z]{3,}$/.test(w));
  if (meaningful.length >= 1 && hasRealWord) {
    const cleaned = humanise(words.join(" "));
    // With a sheet number present, leftover words read as the sheet title.
    // Without one, they are just as likely the project name — we say both and
    // let the user pick rather than inventing a distinction we cannot see.
    const confidence = draft.sheetNumber ? 0.45 : 0.3;
    draft.title = field(cleaned, confidence, [
      {
        source: "filename",
        pattern: "title.leftover-words",
        fragment: cleaned,
        note: draft.sheetNumber
          ? "Words left after removing the structured tokens"
          : "Words left after removing the structured tokens; no sheet number found, so this may be the project name",
      },
    ]);
  }

  return draft;
}

/** Remove claimed [start, end) ranges from `s`, replacing each with a space. */
function excise(s: string, ranges: Array<[number, number]>): string {
  if (ranges.length === 0) return s;
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  let out = "";
  let cursor = 0;
  for (const [start, end] of sorted) {
    if (start >= cursor) {
      out += s.slice(cursor, start) + " ";
      cursor = end;
    } else if (end > cursor) {
      cursor = end;
    }
  }
  out += s.slice(cursor);
  return out;
}
