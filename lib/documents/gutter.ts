/**
 * How the paged preview opens the gap that stands for a page boundary, and where
 * the page therefore ends.
 *
 * WHY THIS EXISTS AS ITS OWN MODULE. `PagedPreview` opens that gap by putting a
 * top margin on the block that begins the next page, and then reads the footer
 * band's position back as "the top of that block, less the margin". Both halves
 * assume the margin took effect. On a table row it does not: CSS discards margins
 * on table-internal boxes entirely, and there is no error, no warning and no
 * visible gap — the band is simply drawn a full gutter's height too high, across
 * whatever content is really there.
 *
 * Measured on a minutes document whose action-item table crossed page one
 * (Villa Sabana, 8 items): the footer rule landed at 830px while the table went
 * on painting to 953px — 123px, about 33mm, of live rows under the footer and
 * into the next page's top margin. Every register in this app is a table, so the
 * defect belonged to all of them, not to minutes.
 *
 * The decision is here rather than inline in the component because it is the part
 * that can be reasoned about and tested without a layout engine. The component
 * imports these functions; it does not carry its own copy of the rule.
 */

/**
 * Displays whose boxes silently discard a top margin.
 *
 * Per CSS 2.1 §17.5.3 and CSS Display 3, margins do not apply to internal table
 * boxes. `table` and `table-caption` are absent on purpose: both are margin boxes
 * and the ordinary mechanism works on them.
 */
export const MARGIN_LESS_DISPLAYS: ReadonlySet<string> = new Set([
  "table-row",
  "table-row-group",
  "table-header-group",
  "table-footer-group",
  "table-cell",
  "table-column",
  "table-column-group",
]);

/**
 * "margin" — put the gap above the block, in its own top margin.
 * "spacer"  — the block cannot hold a margin, so the gap must be a real node
 *             inserted in front of it.
 */
export type GutterMode = "margin" | "spacer";

export function gutterMode(display: string): GutterMode {
  return MARGIN_LESS_DISPLAYS.has(display) ? "spacer" : "margin";
}

/**
 * Where the page ends, measured back from whichever element marks the gap.
 *
 * The two modes put the gap on opposite sides of the marker's border box, and
 * conflating them is the whole bug: a margin sits ABOVE the block that begins the
 * next page, so the page ended a gutter earlier; a spacer IS the gap, so the page
 * ends exactly at its top. Subtracting the gutter in the spacer case would move
 * the footer band a full gutter too high — which is what the margin mechanism was
 * doing to every table.
 */
export function pageEndAt(input: {
  /** Flow coordinate of the marker's border-box top, after the gap opened. */
  markerTop: number;
  gutterPx: number;
  mode: GutterMode;
}): number {
  return input.mode === "margin" ? input.markerTop - input.gutterPx : input.markerTop;
}

/**
 * Columns a spacer row must span to sit in a table without disturbing its
 * column widths — the real column count, so `colspan` cells are counted for what
 * they cover rather than as one column each.
 */
export function spanOf(cells: readonly { colSpan?: number }[]): number {
  const total = cells.reduce((sum, cell) => sum + (cell.colSpan && cell.colSpan > 0 ? cell.colSpan : 1), 0);
  return Math.max(1, total);
}
