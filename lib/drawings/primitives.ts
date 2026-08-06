/**
 * Primitive scanners: sheet number, revision, date, project number.
 *
 * Each scanner takes a chunk of text and returns EVERY candidate it can see,
 * best first, each with its own confidence and evidence. Nothing here picks a
 * winner across sources — that is `merge.ts`'s job. Nothing here throws.
 *
 * The regexes are written against an UPPERCASED copy of the input, and every
 * `fragment`/`index` in the returned evidence refers to the ORIGINAL string, so
 * what the user sees quoted back is what they actually typed.
 */

import type { Alternate, Evidence, EvidenceSource, SheetDiscipline } from "./types";

/* ------------------------------------------------------------------ *
 * Discipline prefixes
 * ------------------------------------------------------------------ */

/**
 * Sheet-number prefixes we recognise. The single letters are the CSI/NCS
 * convention (A/S/M/E/P/C/L/G) plus `I` for interiors, which the brief calls
 * for. The two-letter forms are the ones this codebase and common AE practice
 * actually emit — `lib/data/drawings.ts` ships `ID-501` today.
 *
 * A prefix NOT in this table is not treated as a sheet number at all. That is
 * deliberate: an open-ended `[A-Z]{1,2}` prefix turns every `PH2` and `L2` in a
 * filename into a false sheet number, and in a drawing register a wrong sheet
 * number is worse than a blank one.
 */
export const DISCIPLINE_PREFIXES: Readonly<Record<string, SheetDiscipline>> = {
  G: "GENERAL",
  GN: "GENERAL",
  C: "CIVIL",
  CV: "CIVIL",
  L: "LANDSCAPE",
  LS: "LANDSCAPE",
  A: "ARCHITECTURAL",
  AR: "ARCHITECTURAL",
  I: "INTERIORS",
  ID: "INTERIORS",
  S: "STRUCTURAL",
  ST: "STRUCTURAL",
  M: "MECHANICAL",
  ME: "MECHANICAL",
  E: "ELECTRICAL",
  EL: "ELECTRICAL",
  P: "PLUMBING",
  PL: "PLUMBING",
  FP: "FIRE_PROTECTION",
  FA: "FIRE_PROTECTION",
  T: "TELECOM",
  TC: "TELECOM",
};

export const SHEET_DISCIPLINE_LABEL: Readonly<Record<SheetDiscipline, string>> = {
  GENERAL: "General",
  CIVIL: "Civil",
  LANDSCAPE: "Landscape",
  ARCHITECTURAL: "Architectural",
  INTERIORS: "Interiors",
  STRUCTURAL: "Structural",
  MECHANICAL: "Mechanical",
  ELECTRICAL: "Electrical",
  PLUMBING: "Plumbing",
  FIRE_PROTECTION: "Fire protection",
  TELECOM: "Telecom / data",
};

/* ------------------------------------------------------------------ *
 * Sheet number
 * ------------------------------------------------------------------ */

export type SheetNumberHit = {
  sheetNumber: string;
  discipline: SheetDiscipline;
  /** Index of the match in the original input. */
  index: number;
  /** Length of the match, so callers can excise it from leftover text. */
  length: number;
};

/**
 * `A-101`, `A101`, `A.101`, `A-101.1`, `ID-501`, `M 401`.
 *
 * Bounded on the left by a non-alphanumeric (or start of string) so `LEVEL2`
 * and `PHASE1` cannot produce a hit, and on the right by a non-digit so
 * `A-1012345` (a scan id) does not silently truncate to `A-101`.
 */
const SHEET_RE =
  /(?<![A-Z0-9])([A-Z]{1,2})([-._ ]?)(\d{2,4}(?:[.-]\d{1,2})?)(?![0-9])/g;

/** `A-2026-...` is a project code, not sheet `A-2026`. Year-shaped four-digit
 *  runs that are themselves followed by another `-`/`_` group are excluded. */
function looksLikeYearInCode(digits: string, rest: string): boolean {
  return /^(?:19|20)\d{2}$/.test(digits) && /^[-_]\d/.test(rest);
}

export function scanSheetNumbers(
  text: string,
  source: EvidenceSource,
): Array<Alternate<string> & { hit: SheetNumberHit }> {
  const upper = text.toUpperCase();
  const out: Array<Alternate<string> & { hit: SheetNumberHit }> = [];
  SHEET_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SHEET_RE.exec(upper)) !== null) {
    const prefix = m[1];
    const separator = m[2];
    const digits = m[3];
    const discipline = DISCIPLINE_PREFIXES[prefix];
    if (!discipline) continue;
    if (looksLikeYearInCode(digits, upper.slice(m.index + m[0].length))) continue;

    // A separated form (`A-101`) is the convention; the run-together form
    // (`A101`) is real but collides with more non-sheet tokens, so it scores
    // lower. Both are far above the leftover-text heuristics.
    const separated = separator.trim().length > 0;
    // Four-digit sheet numbers (`A-1002`) are common in large sets but overlap
    // with years and part numbers, so they carry a small discount.
    const wide = /^\d{4}/.test(digits);
    const confidence = (separated ? 0.9 : 0.78) - (wide ? 0.05 : 0);
    const fragment = text.slice(m.index, m.index + m[0].length);
    const evidence: Evidence[] = [
      {
        source,
        pattern: separated ? "sheet.prefix-sep-number" : "sheet.prefix-number",
        fragment,
        index: m.index,
        note: separated ? undefined : "No separator between prefix and number",
      },
    ];
    out.push({
      value: `${prefix}-${digits}`,
      confidence,
      evidence,
      hit: {
        sheetNumber: `${prefix}-${digits}`,
        discipline,
        index: m.index,
        length: m[0].length,
      },
    });
  }

  // Strongest pattern first, then EARLIEST. A project code that could be
  // mistaken for a sheet is already excluded by `looksLikeYearInCode`, so the
  // remaining multi-hit case is a filename covering two sheets
  // (`E-101 & E-102`), where the first is the subject and the second is a
  // cross-reference.
  out.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.hit.index - b.hit.index;
  });

  // More than one plausible sheet number is a genuine ambiguity. Say so on the
  // winner rather than presenting it as clean.
  if (out.length > 1) {
    for (const c of out) {
      c.confidence = Math.max(0, c.confidence - 0.12);
      c.evidence = c.evidence.map((e) => ({
        ...e,
        note: [e.note, `${out.length} sheet-number-shaped tokens in the same text`]
          .filter(Boolean)
          .join("; "),
      }));
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Project number
 * ------------------------------------------------------------------ */

/** `ZA-2026-121`, `ZA_2026_121`, `AEC-2025-7`. Letters, year, sequence. */
const PROJECT_NO_LETTERED_RE =
  /(?<![A-Z0-9])([A-Z]{1,4})[-_]((?:19|20)\d{2})[-_](\d{1,4})(?![0-9])/g;
/** `2026-121` with no letters. Real, but collides with `YYYY-MM`. */
const PROJECT_NO_BARE_RE = /(?<![A-Z0-9_-])((?:19|20)\d{2})[-_](\d{2,4})(?![0-9_-])/g;

export function scanProjectNumbers(text: string, source: EvidenceSource): Alternate<string>[] {
  const upper = text.toUpperCase();
  const out: Alternate<string>[] = [];

  PROJECT_NO_LETTERED_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PROJECT_NO_LETTERED_RE.exec(upper)) !== null) {
    out.push({
      value: `${m[1]}-${m[2]}-${m[3]}`,
      confidence: 0.88,
      evidence: [
        {
          source,
          pattern: "project.letters-year-seq",
          fragment: text.slice(m.index, m.index + m[0].length),
          index: m.index,
        },
      ],
    });
  }

  if (out.length === 0) {
    PROJECT_NO_BARE_RE.lastIndex = 0;
    while ((m = PROJECT_NO_BARE_RE.exec(upper)) !== null) {
      const seq = m[2];
      // `2026-08` is far more likely a year-month than a project sequence.
      const looksLikeMonth = seq.length === 2 && Number(seq) >= 1 && Number(seq) <= 12;
      out.push({
        value: `${m[1]}-${seq}`,
        confidence: looksLikeMonth ? 0.35 : 0.6,
        evidence: [
          {
            source,
            pattern: "project.year-seq",
            fragment: text.slice(m.index, m.index + m[0].length),
            index: m.index,
            note: looksLikeMonth
              ? "Could equally be a year-month, not a project number"
              : undefined,
          },
        ],
      });
    }
  }

  out.sort((a, b) => b.confidence - a.confidence);
  return out;
}

/* ------------------------------------------------------------------ *
 * Revision
 * ------------------------------------------------------------------ */

/**
 * Keyword-anchored only: `Rev B`, `REV-02`, `Revision: C`, `Issue 3`.
 *
 * A bare trailing letter (`A-101-B`) is NOT read as a revision. It is just as
 * often a sheet-series suffix, and guessing wrong writes a false revision into
 * a register that people use to decide what to build from.
 */
const REVISION_RE =
  /(?<![A-Z0-9])(REVISION|REV|ISSUE)(?![A-Z])[\s._:-]{0,3}(?:NO\.?[\s._:-]{0,3})?([A-Z]|\d{1,2})(?![A-Z0-9])/g;

export function scanRevisions(text: string, source: EvidenceSource): Alternate<string>[] {
  const upper = text.toUpperCase();
  const out: Alternate<string>[] = [];
  REVISION_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = REVISION_RE.exec(upper)) !== null) {
    const token = m[2];
    // `REV` immediately followed by a lone `A`..`Z` that is itself the start of
    // a word we already read as something else is unlikely; the trailing
    // boundary above already guards that. Numeric and alpha revisions score
    // the same — both conventions are in daily use.
    out.push({
      value: token,
      confidence: 0.92,
      evidence: [
        {
          source,
          pattern: /^\d+$/.test(token) ? "revision.keyword-numeric" : "revision.keyword-alpha",
          fragment: text.slice(m.index, m.index + m[0].length),
          index: m.index,
        },
      ],
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Dates
 * ------------------------------------------------------------------ */

const MONTHS: Readonly<Record<string, number>> = {
  JAN: 1, JANUARY: 1,
  FEB: 2, FEBRUARY: 2,
  MAR: 3, MARCH: 3,
  APR: 4, APRIL: 4,
  MAY: 5,
  JUN: 6, JUNE: 6,
  JUL: 7, JULY: 7,
  AUG: 8, AUGUST: 8,
  SEP: 9, SEPT: 9, SEPTEMBER: 9,
  OCT: 10, OCTOBER: 10,
  NOV: 11, NOVEMBER: 11,
  DEC: 12, DECEMBER: 12,
};

/** True only for a real calendar date. Rejects 2026-02-30, month 13, day 0. */
export function isRealDate(y: number, mo: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return false;
  if (y < 1900 || y > 2199) return false;
  if (mo < 1 || mo > 12) return false;
  if (d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function iso(y: number, mo: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Two-digit year pivot. 00-69 -> 2000s, 70-99 -> 1900s. */
function expandYear(yy: number): number {
  return yy <= 69 ? 2000 + yy : 1900 + yy;
}

const ISO_RE = /(?<!\d)((?:19|20)\d{2})[-._/](\d{1,2})[-._/](\d{1,2})(?!\d)/g;
const DMY_RE = /(?<!\d)(\d{1,2})[-._/](\d{1,2})[-._/]((?:19|20)\d{2}|\d{2})(?!\d)/g;
const DMONY_RE = /(?<![A-Z0-9])(\d{1,2})[-._ ]?([A-Z]{3,9})[-._ ,]{1,2}((?:19|20)\d{2}|\d{2})(?![A-Z0-9])/g;
const MONDY_RE =
  /(?<![A-Z0-9])([A-Z]{3,9})[-._ ]{1,2}(\d{1,2})(?:ST|ND|RD|TH)?[-._ ,]{1,2}((?:19|20)\d{2})(?![A-Z0-9])/g;
const COMPACT_RE = /(?<!\d)((?:19|20)\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?!\d)/g;

/**
 * All date-shaped tokens in `text`, normalised to ISO, best first.
 *
 * Ordering rationale: an unambiguous written month beats ISO beats a numeric
 * DD/MM (which we read day-first per the brief, but flag whenever MM/DD is
 * equally readable).
 */
export function scanDates(text: string, source: EvidenceSource): Alternate<string>[] {
  const upper = text.toUpperCase();
  const out: Alternate<string>[] = [];
  const push = (
    value: string,
    confidence: number,
    pattern: string,
    index: number,
    length: number,
    note?: string,
  ) => {
    out.push({
      value,
      confidence,
      evidence: [{ source, pattern, fragment: text.slice(index, index + length), index, note }],
    });
  };

  let m: RegExpExecArray | null;

  DMONY_RE.lastIndex = 0;
  while ((m = DMONY_RE.exec(upper)) !== null) {
    const mo = MONTHS[m[2]];
    if (mo === undefined) continue;
    const d = Number(m[1]);
    const y = m[3].length === 2 ? expandYear(Number(m[3])) : Number(m[3]);
    if (!isRealDate(y, mo, d)) continue;
    push(iso(y, mo, d), 0.95, "date.dd-mon-yyyy", m.index, m[0].length);
  }

  MONDY_RE.lastIndex = 0;
  while ((m = MONDY_RE.exec(upper)) !== null) {
    const mo = MONTHS[m[1]];
    if (mo === undefined) continue;
    const d = Number(m[2]);
    const y = Number(m[3]);
    if (!isRealDate(y, mo, d)) continue;
    push(iso(y, mo, d), 0.93, "date.mon-dd-yyyy", m.index, m[0].length);
  }

  ISO_RE.lastIndex = 0;
  while ((m = ISO_RE.exec(upper)) !== null) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!isRealDate(y, mo, d)) continue;
    push(iso(y, mo, d), 0.95, "date.iso", m.index, m[0].length);
  }

  DMY_RE.lastIndex = 0;
  while ((m = DMY_RE.exec(upper)) !== null) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = m[3].length === 2 ? expandYear(Number(m[3])) : Number(m[3]);
    const twoDigitYear = m[3].length === 2;
    // Day-first per the brief. If the first component is <= 12 the US reading
    // is equally valid and we cannot tell — that is a real ambiguity, not a
    // confidence we can engineer away.
    const ambiguous = a <= 12 && b <= 12 && a !== b;
    if (!isRealDate(y, b, a)) {
      // Not a valid day-first date. Try month-first before giving up.
      if (isRealDate(y, a, b)) {
        push(
          iso(y, a, b),
          twoDigitYear ? 0.55 : 0.7,
          "date.mm-dd-yyyy",
          m.index,
          m[0].length,
          "Read month-first because the day-first reading is not a real date",
        );
      }
      continue;
    }
    let confidence = ambiguous ? 0.6 : 0.85;
    if (twoDigitYear) confidence -= 0.12;
    push(
      iso(y, b, a),
      confidence,
      "date.dd-mm-yyyy",
      m.index,
      m[0].length,
      [
        ambiguous ? "Ambiguous: could be MM-DD-YYYY" : undefined,
        twoDigitYear ? "Two-digit year expanded with a 1970 pivot" : undefined,
      ]
        .filter(Boolean)
        .join("; ") || undefined,
    );
  }

  COMPACT_RE.lastIndex = 0;
  while ((m = COMPACT_RE.exec(upper)) !== null) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!isRealDate(y, mo, d)) continue;
    push(
      iso(y, mo, d),
      0.68,
      "date.yyyymmdd",
      m.index,
      m[0].length,
      "Undelimited 8-digit token; could be an unrelated number",
    );
  }

  // Deduplicate identical ISO values, keeping the strongest evidence and
  // folding the weaker match in as corroboration.
  const byValue = new Map<string, Alternate<string>>();
  for (const c of out) {
    const prev = byValue.get(c.value);
    if (!prev) {
      byValue.set(c.value, c);
    } else if (c.confidence > prev.confidence) {
      byValue.set(c.value, { ...c, evidence: [...c.evidence, ...prev.evidence] });
    } else {
      prev.evidence = [...prev.evidence, ...c.evidence];
    }
  }

  return [...byValue.values()].sort((a, b) => b.confidence - a.confidence);
}
