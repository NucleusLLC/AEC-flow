/**
 * What sheet of paper was this plotted to? PURE — geometry in, a named size out.
 *
 * WHY THIS IS WORTH A MODULE. A drawing register that does not know whether a
 * sheet is A1 or A3 cannot print a transmittal, cannot warn that a set arrived
 * at half size, and cannot tell a contractor what to plot. The information is
 * already in the file — every PDF page carries its media box — and the reader
 * in `lib/drawings/pdf-text.ts` already reports it in points. Nothing read it
 * until now.
 *
 * POINTS, MILLIMETRES, AND WHY THE TOLERANCE IS WHAT IT IS. A PDF point is
 * 1/72 inch exactly, so A1 landscape is 2383.94 x 1683.78 pt. Real files are
 * never exactly that: CAD exporters round the media box, some add a hairline
 * bleed, and a few write the size in whole millimetres converted back at single
 * precision. Two millimetres of slack catches all of that. Eight millimetres —
 * the "near" band — catches the rest, and says so rather than claiming a match
 * it does not have.
 *
 * ORIENTATION IS NOT PART OF THE NAME. "A1 landscape" is one sheet rotated, not
 * a different sheet, so the size is matched on the sorted pair of dimensions
 * and the orientation is reported separately. Getting this wrong is how a
 * register ends up with an "A1" and an "841x594" that are the same thing.
 */

export type PaperSeries = "ISO_A" | "ISO_B" | "ANSI" | "ARCH" | "CUSTOM";

export type PaperOrientation = "portrait" | "landscape" | "square";

/** How well the page matched a named size. */
export type PaperMatch = "exact" | "near" | "custom";

export type PaperSize = {
  /** `A1`, `ANSI D`, `ARCH C`, or `Custom`. */
  name: string;
  series: PaperSeries;
  /** The sheet's own dimensions, short edge first, in whole-ish millimetres. */
  shortMm: number;
  longMm: number;
};

export type DetectedPaper = {
  /** The named size, or a custom entry carrying the page's own dimensions. */
  size: PaperSize;
  orientation: PaperOrientation;
  /** The PAGE as measured, rounded to 0.1 mm. Not the nominal size. */
  widthMm: number;
  heightMm: number;
  widthPt: number;
  heightPt: number;
  match: PaperMatch;
  /** Millimetres between the page and the named size, on the worse edge. */
  deviationMm: number;
  /** 0..1, for the same reason every other extracted value carries one. */
  confidence: number;
  /** The runners-up, nearest first — an A1 plotted to ARCH E is close to both. */
  alternates: { size: PaperSize; deviationMm: number }[];
  /** A sentence for the screen. Never a stack trace, never empty. */
  note: string;
};

export const MM_PER_POINT = 25.4 / 72;

/** Within this, the page IS that size. */
export const EXACT_TOLERANCE_MM = 2;

/** Beyond `EXACT`, within this, the page is that size with a caveat. */
export const NEAR_TOLERANCE_MM = 8;

/**
 * The sizes a practice actually plots to. ISO A first because that is what
 * Aruba, the Netherlands and every ISO-7200 title block use; ANSI and ARCH
 * because American consultants send them and a register that calls a 24x36
 * sheet "custom" is a register nobody trusts.
 */
export const PAPER_SIZES: PaperSize[] = [
  { name: "A0", series: "ISO_A", shortMm: 841, longMm: 1189 },
  { name: "A1", series: "ISO_A", shortMm: 594, longMm: 841 },
  { name: "A2", series: "ISO_A", shortMm: 420, longMm: 594 },
  { name: "A3", series: "ISO_A", shortMm: 297, longMm: 420 },
  { name: "A4", series: "ISO_A", shortMm: 210, longMm: 297 },
  { name: "A5", series: "ISO_A", shortMm: 148, longMm: 210 },
  { name: "B1", series: "ISO_B", shortMm: 707, longMm: 1000 },
  { name: "B2", series: "ISO_B", shortMm: 500, longMm: 707 },
  { name: "B3", series: "ISO_B", shortMm: 353, longMm: 500 },
  { name: "ANSI A", series: "ANSI", shortMm: 215.9, longMm: 279.4 },
  { name: "ANSI B", series: "ANSI", shortMm: 279.4, longMm: 431.8 },
  { name: "ANSI C", series: "ANSI", shortMm: 431.8, longMm: 558.8 },
  { name: "ANSI D", series: "ANSI", shortMm: 558.8, longMm: 863.6 },
  { name: "ANSI E", series: "ANSI", shortMm: 863.6, longMm: 1117.6 },
  { name: "ARCH A", series: "ARCH", shortMm: 228.6, longMm: 304.8 },
  { name: "ARCH B", series: "ARCH", shortMm: 304.8, longMm: 457.2 },
  { name: "ARCH C", series: "ARCH", shortMm: 457.2, longMm: 609.6 },
  { name: "ARCH D", series: "ARCH", shortMm: 609.6, longMm: 914.4 },
  { name: "ARCH E", series: "ARCH", shortMm: 914.4, longMm: 1219.2 },
  { name: "ARCH E1", series: "ARCH", shortMm: 762, longMm: 1066.8 },
];

export function pointsToMm(points: number): number {
  if (!Number.isFinite(points) || points <= 0) return 0;
  return Math.round(points * MM_PER_POINT * 10) / 10;
}

export function mmToPoints(mm: number): number {
  if (!Number.isFinite(mm) || mm <= 0) return 0;
  return Math.round((mm / MM_PER_POINT) * 100) / 100;
}

function orientationOf(widthMm: number, heightMm: number): PaperOrientation {
  if (Math.abs(widthMm - heightMm) <= 1) return "square";
  return widthMm > heightMm ? "landscape" : "portrait";
}

function customSize(shortMm: number, longMm: number): PaperSize {
  return {
    name: `${Math.round(shortMm)} × ${Math.round(longMm)} mm`,
    series: "CUSTOM",
    shortMm: Math.round(shortMm * 10) / 10,
    longMm: Math.round(longMm * 10) / 10,
  };
}

const NOT_A_PAGE: DetectedPaper = {
  size: { name: "Unknown", series: "CUSTOM", shortMm: 0, longMm: 0 },
  orientation: "landscape",
  widthMm: 0,
  heightMm: 0,
  widthPt: 0,
  heightPt: 0,
  match: "custom",
  deviationMm: 0,
  confidence: 0,
  alternates: [],
  note: "The page size could not be read from the file.",
};

/**
 * The sheet a page was plotted to.
 *
 * Takes the media box in POINTS, as the PDF reports it. A page with no usable
 * geometry returns a zero-confidence result rather than throwing — the same
 * contract every other module in `lib/drawings/` keeps.
 */
export function detectPaperSize(widthPt: number, heightPt: number): DetectedPaper {
  if (!Number.isFinite(widthPt) || !Number.isFinite(heightPt) || widthPt <= 0 || heightPt <= 0) {
    return NOT_A_PAGE;
  }

  const widthMm = pointsToMm(widthPt);
  const heightMm = pointsToMm(heightPt);
  const shortMm = Math.min(widthMm, heightMm);
  const longMm = Math.max(widthMm, heightMm);
  const orientation = orientationOf(widthMm, heightMm);

  const ranked = PAPER_SIZES.map((size) => ({
    size,
    deviationMm:
      Math.round(Math.max(Math.abs(size.shortMm - shortMm), Math.abs(size.longMm - longMm)) * 10) /
      10,
  })).sort((a, b) => a.deviationMm - b.deviationMm);

  const best = ranked[0];
  const alternates = ranked.slice(1, 4).filter((r) => r.deviationMm <= NEAR_TOLERANCE_MM * 3);

  if (best.deviationMm <= EXACT_TOLERANCE_MM) {
    return {
      size: best.size,
      orientation,
      widthMm,
      heightMm,
      widthPt: Math.round(widthPt * 100) / 100,
      heightPt: Math.round(heightPt * 100) / 100,
      match: "exact",
      deviationMm: best.deviationMm,
      confidence: 0.97,
      alternates,
      note: `${best.size.name} ${orientation} (${widthMm} × ${heightMm} mm).`,
    };
  }

  if (best.deviationMm <= NEAR_TOLERANCE_MM) {
    return {
      size: best.size,
      orientation,
      widthMm,
      heightMm,
      widthPt: Math.round(widthPt * 100) / 100,
      heightPt: Math.round(heightPt * 100) / 100,
      match: "near",
      deviationMm: best.deviationMm,
      confidence: 0.7,
      alternates,
      note:
        `Closest to ${best.size.name} ${orientation}, off by ${best.deviationMm} mm ` +
        `(page is ${widthMm} × ${heightMm} mm). Trimmed, or plotted with a bleed.`,
    };
  }

  return {
    size: customSize(shortMm, longMm),
    orientation,
    widthMm,
    heightMm,
    widthPt: Math.round(widthPt * 100) / 100,
    heightPt: Math.round(heightPt * 100) / 100,
    match: "custom",
    deviationMm: best.deviationMm,
    confidence: 0.4,
    alternates: ranked.slice(0, 3),
    note: `A non-standard sheet: ${widthMm} × ${heightMm} mm. Nearest named size is ${best.size.name}.`,
  };
}

/**
 * Was this set plotted down from a bigger sheet?
 *
 * An A1 drawing sent as A3 is the single most common thing that goes wrong with
 * a drawing set: it prints at 50% and every scaled dimension taken off it is
 * wrong. ISO A sizes are all the same shape, so the aspect ratio cannot tell
 * them apart — only the intent can, and intent is what the title block says the
 * scale is. What this DOES report is that the sheet is small for a working
 * drawing, which is the part a register can know on its own.
 *
 * Returns null when there is nothing to say.
 */
export function undersizeWarning(paper: DetectedPaper): string | null {
  if (paper.confidence === 0) return null;
  const smallSeries = paper.size.series === "ISO_A" || paper.size.series === "CUSTOM";
  if (!smallSeries) return null;
  if (paper.size.longMm >= 594) return null; // A2 and up is a working sheet
  if (paper.size.longMm < 200) return null; // A5 and under is a note, not a plan
  return (
    `This is ${paper.size.name} — a reading copy, not a plot. If it came from an A1 sheet, ` +
    `anything scaled off it will be wrong.`
  );
}

/**
 * ISO A sizes halve along the long edge, so a set can be reported in the size
 * it was DESIGNED at when the title block says one thing and the page says
 * another. Given a named ISO A size, the size one step up.
 */
export function oneSizeUp(size: PaperSize): PaperSize | null {
  if (size.series !== "ISO_A") return null;
  const index = PAPER_SIZES.findIndex((s) => s.name === size.name);
  if (index <= 0) return null;
  const up = PAPER_SIZES[index - 1];
  return up.series === "ISO_A" ? up : null;
}

/** `A1 landscape`, or `420 × 594 mm portrait` when there is no name for it. */
export function describePaper(paper: DetectedPaper): string {
  if (paper.confidence === 0) return "Unknown size";
  if (paper.orientation === "square") return `${paper.size.name} square`;
  return `${paper.size.name} ${paper.orientation}`;
}
