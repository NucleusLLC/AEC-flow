/**
 * The `@page` bottom margin boxes — the printed footer line and page counter.
 *
 * WHY THIS IS ITS OWN MODULE. Three documents need these boxes and only two of
 * them can use `PageRules`. Estimates and Schedule are protected systems: they
 * carry their own sheet, their own pagination and their own rhythm, so handing
 * them the whole `PageRules` stylesheet would import table and list rules they
 * never asked for — a redesign wearing the clothes of a fix. Schedule also prints
 * at A2 and A1, which are not in the shared paper tokens, and builds its `@page`
 * as a template string inside a client component.
 *
 * What all three genuinely share is the arithmetic: the clearance above the paper
 * edge, and the two explicit widths that keep the counter off a second line. That
 * is what lives here. `PageRules` composes it; the two protected systems inject it
 * into the `@page` blocks they already own, and nothing else about them moves.
 */
import { gutterZones } from "./preview-geometry";
import { LINE_HEIGHT, TYPE_SCALE } from "./tokens";

/**
 * Width reserved for "Page N of M" in the bottom margin strip, in millimetres.
 *
 * Chrome sizes the bottom margin boxes by distributing the strip between them in
 * proportion to their max-content widths. A footer line wider than the strip
 * therefore squeezes the page-number box below the width of its own text, and the
 * total wraps onto a second line — which is how a printed proposal came to read
 * "Page 1 of" with the "3" stranded on a line of its own below it. An explicit
 * width takes the box out of that distribution altogether.
 *
 * "Page 1 of 3" measures 13.8mm at the footer type size, so this is set with room
 * to spare: a hundred-page register still fits on one line.
 */
export const PAGE_NUMBER_WIDTH_MM = 30;

export type FooterBoxesRequest = {
  /** Trim width of the page AFTER orientation, in millimetres. */
  pageWidthMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  /** The strip the boxes live in; also what the clearance is measured against. */
  marginBottomMm: number;
  /** Small text in the bottom-left margin, e.g. the practice strapline. */
  footerLeft?: string;
  /** "Page N of M" in the bottom-right margin. */
  pageNumbers?: boolean;
};

/**
 * A CSS string literal, safe to embed inside a `content:` declaration.
 *
 * A stray quote in a practice strapline would otherwise terminate the content
 * string and take the entire `@page` block with it — and that failure is silent:
 * the page simply prints flush to the paper edge.
 */
export function cssString(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * The `@bottom-left` / `@bottom-right` at-rules, ready to drop inside `@page`.
 *
 * Returns "" when neither box is wanted, so a caller can interpolate it
 * unconditionally without emitting a stray separator.
 */
export function footerMarginBoxesCss({
  pageWidthMm,
  marginLeftMm,
  marginRightMm,
  marginBottomMm,
  footerLeft,
  pageNumbers = true,
}: FooterBoxesRequest): string {
  // The footer sits FOOTER_FROM_EDGE_MM above the paper edge rather than at the
  // foot of the bottom margin, which read as crowding the edge — and that
  // clearance is inside the unprintable border of a typical desktop printer, so
  // the line cannot be clipped. `vertical-align: bottom` puts the content at the
  // foot of the margin box and the padding then lifts it. gutterZones owns the
  // clamp, so a thin margin yields the clearance instead of pushing the footer up
  // out of the band it belongs to.
  const padMm = gutterZones({
    topMm: 0,
    bottomMm: marginBottomMm,
    sheetGapMm: 0,
  }).footerPadBottomMm;

  const style =
    `font-size: ${TYPE_SCALE.footer}pt; line-height: ${LINE_HEIGHT.footer};` +
    ` color: #6b7280; font-family: inherit; vertical-align: bottom;` +
    ` padding-bottom: ${padMm}mm;`;

  // Both boxes carry an EXPLICIT width, and the two add up to the strip between
  // the page's left and right margins — see PAGE_NUMBER_WIDTH_MM.
  const stripMm = pageWidthMm - marginLeftMm - marginRightMm;
  const numberWidthMm = pageNumbers ? Math.min(PAGE_NUMBER_WIDTH_MM, stripMm) : 0;
  const footerWidthMm = Math.max(0, stripMm - numberWidthMm);

  return [
    footerLeft
      ? `@bottom-left { content: ${cssString(footerLeft)}; width: ${footerWidthMm}mm; text-align: left; ${style} }`
      : "",
    pageNumbers
      ? `@bottom-right { content: "Page " counter(page) " of " counter(pages); width: ${numberWidthMm}mm; white-space: nowrap; text-align: right; ${style} }`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}
