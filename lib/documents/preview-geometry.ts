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
import {
  MARGIN_PRESETS,
  pageSizeMm,
  printableAreaMm,
  type Margins,
  type MarginPreset,
  type Orientation,
  type PaperSize,
} from "./tokens";

export type PageMargins = {
  topMm: number;
  bottomMm: number;
  /** The visible break drawn between one sheet and the next. */
  sheetGapMm: number;
};

/**
 * How far the footer line sits above the bottom edge of the paper.
 *
 * It used to sit at the very foot of the bottom margin, which read as crowding
 * the paper edge. Eight millimetres is the requested clearance, and it is also
 * inside the unprintable border of every common desktop printer, so the line
 * cannot be clipped.
 */
export const FOOTER_FROM_EDGE_MM = 8;

/**
 * The visible break drawn between one sheet and the next, in millimetres.
 *
 * Screen furniture — there is no such gap on paper, where one page simply ends
 * and the next begins. It lived as a private constant inside `PagedPreview`,
 * which meant nothing that computed a gutter outside that component could agree
 * with it; the print surface needs the same figure to size its sheet, so it is
 * declared here with the rest of the gutter arithmetic.
 */
export const SHEET_GAP_MM = 6;

export type GutterZones = {
  /** Total gap opened between the two pages. */
  gutterMm: number;
  /** Height of the footer band: the bottom margin of the page that is ending. */
  footerBandMm: number;
  /** Clearance left below the footer line, so it does not crowd the paper edge. */
  footerPadBottomMm: number;
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
    // Never negative, and never so large it would push the footer up out of the
    // margin it belongs to: a 12mm margin cannot hold an 8mm clearance and a line
    // of text, so the clearance yields.
    footerPadBottomMm: Math.max(0, Math.min(FOOTER_FROM_EDGE_MM, bottomMm - 4)),
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

/* ─────────────────────────── the document sheet ─────────────────────────── */

/** What a document asks for; everything else about its sheet follows from this. */
export type SheetRequest = {
  paper?: PaperSize;
  orientation?: Orientation;
  /** A named preset, or explicit millimetre margins for a document that needs them. */
  margins?: MarginPreset | Margins;
};

export type SheetGeometry = {
  paper: PaperSize;
  orientation: Orientation;
  /** The resolved margins — the SAME numbers `@page` is given. */
  margins: Margins;
  /** Trim size after orientation, i.e. the width the on-screen sheet is drawn at. */
  sheetWidthMm: number;
  sheetHeightMm: number;
  /** The text block: trim less margins, which is what the preview must model. */
  contentWidthMm: number;
  contentHeightMm: number;
  /** The gap this document opens between two previewed pages. */
  gutter: GutterZones;
};

/**
 * Everything a print surface needs, derived once from the page tokens.
 *
 * WHY IT IS HERE RATHER THAN IN THE COMPONENT. Every print route used to carry
 * its own copy of this arithmetic as literals — `w-[210mm]`, `p-[14mm]`,
 * `pageContentHeightMm={269}` — and the copies disagreed: a landscape register
 * declared 12mm page margins and then padded its sheet by 14, so the preview
 * wrapped its text at a width the printer would never use. Deriving the sheet,
 * the text block and the gutter from ONE set of margins is what makes "the
 * preview is what prints" a property of the code rather than of three literals
 * happening to agree.
 */
export function sheetGeometry({
  paper = "A4",
  orientation = "portrait",
  margins = "document",
}: SheetRequest = {}): SheetGeometry {
  const m: Margins = typeof margins === "string" ? MARGIN_PRESETS[margins] : margins;
  const trim = pageSizeMm({ paper, orientation });
  const area = printableAreaMm({ paper, orientation, margins: m });

  return {
    paper,
    orientation,
    margins: m,
    sheetWidthMm: trim.width,
    sheetHeightMm: trim.height,
    contentWidthMm: area.width,
    contentHeightMm: area.height,
    gutter: gutterZones({ topMm: m.top, bottomMm: m.bottom, sheetGapMm: SHEET_GAP_MM }),
  };
}
