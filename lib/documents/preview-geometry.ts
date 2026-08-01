/**
 * The geometry of the gap the on-screen preview opens between two pages.
 *
 * WHY THIS IS PURE AND SEPARATE. The gap used to be a flat 16mm constant inside
 * PagedPreview. A page's bottom margin alone is 20mm, so the footer band filled
 * the entire gap and the next page's content resumed with NO top margin — drawn
 * inside the header zone, on paper a printer physically cannot reach. A single
 * wrong constant, invisible to every test, because the arithmetic lived in a
 * component that only a browser can run.
 *
 * The rule, in one place: between the last line of one page and the first line of
 * the next there is the bottom margin of the page ending, the visible break
 * between two sheets, and the top margin of the page beginning. Nothing else, and
 * nothing less.
 *
 *      ── last line of page N ──
 *      bottomMarginMm   the page's own bottom margin; the footer sits at its foot
 *      sheetGapMm       the visible break between one sheet and the next
 *      topMarginMm      the next page's top margin — must stay empty
 *      ── first line of page N+1 ──
 */

export type PageMargins = {
  topMm: number;
  bottomMm: number;
  /** The visible break drawn between one sheet and the next. */
  sheetGapMm: number;
};

export type GutterZones = {
  /** Total gap opened between the two pages. */
  gutterMm: number;
  /** Height of the footer band: the bottom margin of the page that is ending. */
  footerBandMm: number;
  /** Offset within the gutter where the sheet edge is drawn. */
  sheetEdgeAtMm: number;
  /** Offset within the gutter where the next page's top margin begins. */
  topMarginStartsAtMm: number;
  /** Offset within the gutter where the next page's content may begin. */
  contentResumesAtMm: number;
};

export function gutterZones({ topMm, bottomMm, sheetGapMm }: PageMargins): GutterZones {
  if (topMm < 0 || bottomMm < 0 || sheetGapMm < 0) {
    throw new Error("Page margins cannot be negative.");
  }
  return {
    gutterMm: bottomMm + sheetGapMm + topMm,
    footerBandMm: bottomMm,
    sheetEdgeAtMm: bottomMm,
    topMarginStartsAtMm: bottomMm + sheetGapMm,
    contentResumesAtMm: bottomMm + sheetGapMm + topMm,
  };
}

/**
 * Does content at `offsetMm` past a page's last line intrude into a margin?
 *
 * The user's rule, verbatim: "Headers and footers are off-limits and are destined
 * for headers and footers. the text can only continue within the boundary of
 * Headers, footers and Side margins." So anything landing before the gutter is
 * fully spent is an intrusion, and this states it as a question a test can ask.
 */
export function intrudesIntoMargin(offsetMm: number, margins: PageMargins): boolean {
  return offsetMm < gutterZones(margins).contentResumesAtMm;
}

/** A4 less its margins, as the printable content box the preview must model. */
export function printableHeightMm(pageHeightMm: number, margins: Pick<PageMargins, "topMm" | "bottomMm">): number {
  return pageHeightMm - margins.topMm - margins.bottomMm;
}
