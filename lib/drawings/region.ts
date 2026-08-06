/**
 * Turning positioned PDF text items into title-block text. PURE — it takes
 * geometry that some reader already produced and returns a string. No I/O.
 *
 * WHY A REGION AT ALL. A full-size architectural sheet carries hundreds of text
 * items: room names, dimensions, general notes, keynote legends. Feeding all of
 * it to the interpreter buries the six values we want in noise and multiplies
 * false positives — every room number on a plan is `\d{2,3}`-shaped and every
 * north arrow legend has a letter next to a number. The title block, by near
 * universal convention (ISO 7200, the US National CAD Standard, and every
 * office template built on either), occupies the right-hand strip or the bottom
 * strip of the sheet. Restricting to that is the single highest-value
 * preprocessing step available.
 *
 * WHY IT IS A HEURISTIC AND NOT A RULE. Some offices put the title block across
 * the bottom, some down the right edge, some in the bottom-right corner only,
 * and a stamped/reissued sheet may carry a second block. So: take the union of
 * the two strips, and fall back to the whole page when the strips come back
 * nearly empty. Over-including costs precision; under-including costs the value
 * entirely.
 *
 * COORDINATES are PDF user space: origin BOTTOM-left, y increasing upward, in
 * points. That is what pdf.js reports, so no reader has to convert.
 */

export type PdfTextItem = {
  text: string;
  /** Left edge, PDF user space (points from the left edge of the page). */
  x: number;
  /** Baseline, PDF user space (points from the BOTTOM edge of the page). */
  y: number;
  width: number;
  height: number;
};

export type PdfPageText = {
  pageNumber: number;
  /** Page width in points. */
  width: number;
  /** Page height in points. */
  height: number;
  items: PdfTextItem[];
};

export type RegionOptions = {
  /** Fraction of page width, measured from the right edge. */
  rightStrip: number;
  /** Fraction of page height, measured from the bottom edge. */
  bottomStrip: number;
  /** Below this many characters the strips are considered a miss. */
  minChars: number;
  /** Vertical tolerance, in points, for treating two items as one line. */
  lineTolerance: number;
};

export const DEFAULT_REGION_OPTIONS: RegionOptions = {
  // 32% of an A1 landscape sheet's width is ~265mm — wider than any title block
  // in practice, which is the right side of the trade-off: including a column of
  // general notes costs a few false candidates, excluding the project name
  // costs the feature.
  rightStrip: 0.32,
  bottomStrip: 0.18,
  minChars: 24,
  lineTolerance: 3,
};

export type RegionResult = {
  text: string;
  /** True when the strips were empty and the whole page was used instead. */
  usedWholePage: boolean;
  itemCount: number;
};

/**
 * Extract the title-block text of one page. Never throws; a page with no items
 * returns empty text.
 */
export function selectTitleBlockText(
  page: PdfPageText,
  options: Partial<RegionOptions> = {},
): RegionResult {
  const opts = { ...DEFAULT_REGION_OPTIONS, ...options };
  const items = Array.isArray(page?.items) ? page.items.filter((i) => i && i.text?.trim()) : [];
  if (items.length === 0) return { text: "", usedWholePage: false, itemCount: 0 };

  const width = page.width > 0 ? page.width : Math.max(...items.map((i) => i.x + i.width), 1);
  const height = page.height > 0 ? page.height : Math.max(...items.map((i) => i.y + i.height), 1);

  const xThreshold = width * (1 - opts.rightStrip);
  const yThreshold = height * opts.bottomStrip;

  const inStrip = items.filter((i) => i.x >= xThreshold || i.y <= yThreshold);
  const chosen = joinChars(inStrip) >= opts.minChars ? inStrip : items;

  return {
    text: layoutToText(chosen, opts.lineTolerance),
    usedWholePage: chosen === items,
    itemCount: chosen.length,
  };
}

function joinChars(items: PdfTextItem[]): number {
  let n = 0;
  for (const i of items) n += i.text.trim().length;
  return n;
}

/**
 * Reassemble items into lines: cluster by baseline, top-down, then left-right
 * within a line. Extracted PDF text arrives in DRAW order, which for a CAD
 * export is effectively random, so this step is what makes `LABEL: value` pairs
 * appear on the same line for `titleblock.ts` to find.
 */
export function layoutToText(items: PdfTextItem[], tolerance = DEFAULT_REGION_OPTIONS.lineTolerance): string {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: PdfTextItem[][] = [];
  for (const item of sorted) {
    const line = lines[lines.length - 1];
    if (line && Math.abs(line[0].y - item.y) <= tolerance) line.push(item);
    else lines.push([item]);
  }
  return lines
    .map((line) =>
      [...line]
        .sort((a, b) => a.x - b.x)
        .map((i) => i.text.trim())
        .filter(Boolean)
        .join(" ")
        .replace(/\s{2,}/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}
