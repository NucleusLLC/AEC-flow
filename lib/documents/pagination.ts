/**
 * Pagination arithmetic for paged documents — where the pages end, and which
 * headings have to be pushed off the foot of one.
 *
 * WHY THIS IS PURE AND SEPARATE. The measuring pass in `PagedPreview` runs in
 * the browser against real geometry, so the only way to test the rules that
 * govern it — the threshold maths, the fixed-point loop's termination, the
 * "heading already begins its page" guard — is to keep them out of the DOM.
 * Everything here works in one coordinate space: CSS pixels measured down the
 * flow of the document, zero at the top of the sheet. The caller converts
 * millimetre tokens into that space once, using a measured px-per-mm.
 *
 * The vocabulary matches `BREAK_RULES` in ./tokens: nothing here invents a
 * threshold of its own.
 */

/**
 * A block the print engine refuses to split — a table row, an image, or
 * anything carrying `break-inside: avoid`. Splittable text contributes no
 * constraint and is deliberately absent (see `collectAtoms` in PagedPreview).
 */
export type PaginationBlock = { top: number; bottom: number; height: number };

/** A heading, and the space it needs below its own top to not read as stranded. */
export type HeadingMetric = {
  top: number;
  /** Heading height plus its lead-in requirement — see `headingRequiredSpace`. */
  requiredSpace: number;
};

export type PageCut = {
  /** Flow coordinate where the page ends. */
  at: number;
  /**
   * "flow"   — the page simply filled up;
   * "atom"   — pulled back to the top of a block that could not be split;
   * "forced" — a heading was pushed to the next page.
   */
  kind: "flow" | "atom" | "forced";
  /** Index into `blocks` of the block that begins the next page, when known. */
  blockIndex?: number;
  /** Index into `forcedTops` of the block that begins the next page. */
  forcedIndex?: number;
};

/**
 * How close to the top of a page a forced break may sit before it is treated as
 * already satisfied. A break requested 2px below where the page already starts
 * must be ignored: honouring it would emit a 2px page — the empty-page failure
 * this whole mechanism exists to avoid.
 *
 * Four pixels is roughly one millimetre at 96dpi, comfortably below any real
 * block's height and comfortably above sub-pixel layout noise. The heading
 * selector below uses the same figure, so the two can never disagree about
 * whether a heading already begins its page.
 */
export const PAGE_START_EPSILON_PX = 4;

/** Hard stop on the page loop. A boundary that failed to advance would spin forever. */
const MAX_PAGES = 200;

/**
 * Where the browser will end each page.
 *
 * Mirrors the print engine's block-flow rule: fill the page, then pull the
 * boundary back only if it would land inside a block that cannot be split — that
 * block moves down whole. A forced break (`break-before: page`) ends the page
 * earlier still, and is the only thing that can create a page shorter than the
 * first unbreakable block would have made it.
 */
export function computeCuts(input: {
  contentHeight: number;
  pageHeight: number;
  /** Unbreakable blocks in document order. */
  blocks: readonly PaginationBlock[];
  /** Flow coordinates of blocks stamped with a forced page break. Any order. */
  forcedTops?: readonly number[];
  maxPages?: number;
}): PageCut[] {
  const { contentHeight, pageHeight, blocks } = input;
  const maxPages = input.maxPages ?? MAX_PAGES;
  const cuts: PageCut[] = [];
  if (!(pageHeight > 0)) return cuts;

  // Sorted by position but carrying the caller's index, so the cut can name the
  // element that caused it however the caller chose to order the array.
  const forced = (input.forcedTops ?? [])
    .map((top, index) => ({ top, index }))
    .sort((a, b) => a.top - b.top);

  let pageStart = 0;

  while (cuts.length < maxPages) {
    const naturalEnd = pageStart + pageHeight;
    // The `- 1` absorbs sub-pixel rounding: content one pixel past the last page
    // boundary is the end of the document, not a new page.
    const moreContent = naturalEnd < contentHeight - 1;
    const nextForced = forced.find((f) => f.top > pageStart + PAGE_START_EPSILON_PX);
    const forcedIsAhead = nextForced !== undefined && nextForced.top < contentHeight;

    if (!moreContent && !forcedIsAhead) break;

    // With no natural page left, only a forced break can still cut the document.
    let at = moreContent ? naturalEnd : contentHeight;
    let kind: PageCut["kind"] = "flow";
    let blockIndex: number | undefined;
    let forcedIndex: number | undefined;

    if (moreContent) {
      const straddler = blocks.findIndex(
        (b) => b.top > pageStart && b.top < at && b.bottom > at && b.height <= pageHeight,
      );
      if (straddler >= 0) {
        at = blocks[straddler].top;
        kind = "atom";
        blockIndex = straddler;
      } else {
        // The block that will begin the next page, if the boundary lands on one.
        const starter = blocks.findIndex((b) => b.top >= at - 1);
        if (starter >= 0) blockIndex = starter;
      }
    }

    if (forcedIsAhead && nextForced.top < at - PAGE_START_EPSILON_PX) {
      at = nextForced.top;
      kind = "forced";
      forcedIndex = nextForced.index;
      blockIndex = undefined;
    } else if (!moreContent) {
      // The only forced break left sits past the end of the content, or close
      // enough to the boundary to be a no-op. Nothing more to cut.
      break;
    }

    if (at <= pageStart + PAGE_START_EPSILON_PX) break;

    cuts.push({ at, kind, blockIndex, forcedIndex });
    pageStart = at;
  }

  return cuts;
}

/**
 * The space a heading needs below its own top before the page foot.
 *
 * `minimumSpacePx` is `BREAK_RULES.minimumSpaceAfterHeadingMm` in flow pixels —
 * the floor, expressed once as a token so no component carries the number.
 * `leadInSpacePx` is what the heading's actual opening content needs (two lines
 * of a paragraph, or a table header plus its first rows); it raises the floor for
 * documents whose lead-in is taller than the generic figure.
 *
 * The result is clamped to `maxUnitHeight` — the same 35%-of-a-page ceiling that
 * governs which blocks may be made unbreakable. Without it a heading followed by
 * a tall table would demand most of a page and strand the page above it, which is
 * the waste this codebase has already been burned by twice.
 */
export function headingRequiredSpace(input: {
  headingHeight: number;
  minimumSpacePx: number;
  leadInSpacePx?: number;
  maxUnitHeight: number;
}): number {
  const need = Math.max(input.minimumSpacePx, input.leadInSpacePx ?? 0);
  return input.headingHeight + Math.min(need, input.maxUnitHeight);
}

/**
 * Headings that end up too close to the foot of their page.
 *
 * Returns indices into `headings`. Three headings are deliberately never
 * returned:
 *
 *   - one that already begins its page — pushing it yields an empty page, or a
 *     loop that never terminates because the push recreates the condition;
 *   - one on the final page, which has no foot to strand against;
 *   - one whose requirement exceeds a whole page, which no push can satisfy.
 */
export function selectHeadingsToPush(input: {
  headings: readonly HeadingMetric[];
  /** Page boundaries in ascending flow order. */
  cuts: readonly number[];
  pageHeight: number;
}): number[] {
  const { headings, cuts, pageHeight } = input;
  const out: number[] = [];

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    if (h.requiredSpace > pageHeight) continue;

    const foot = cuts.find((c) => c > h.top + PAGE_START_EPSILON_PX);
    if (foot === undefined) continue;

    let pageTop = 0;
    for (const c of cuts) {
      if (c <= h.top + PAGE_START_EPSILON_PX) pageTop = c;
      else break;
    }
    if (h.top - pageTop <= PAGE_START_EPSILON_PX) continue;

    if (foot - h.top < h.requiredSpace) out.push(i);
  }

  return out;
}

export type HeadingBreakResult = {
  cuts: PageCut[];
  /**
   * Heading indices that must carry `break-before: page`. Only headings whose
   * push actually produced a cut in the final layout appear here: stamping one
   * the layout ignored would make the printed page disagree with the measured
   * one for no benefit.
   */
  forcedHeadings: number[];
  /** Recomputes performed. Zero means the first layout already satisfied the rule. */
  passes: number;
  /** False when the cap was reached with work still outstanding. */
  settled: boolean;
};

/**
 * Push headings off page feet until nothing else needs pushing.
 *
 * Pushing one heading moves every boundary below it, which can strand a heading
 * that was previously fine, so the pass has to be repeated. Termination is
 * guaranteed by construction rather than by the cap: the forced set only ever
 * grows, and it is bounded by the number of headings. The cap is a second belt
 * — three passes clear every real document measured, and stopping there leaves
 * the last self-consistent layout (its cuts are computed from its forced set)
 * rather than an abandoned half-applied one.
 */
export function resolveHeadingBreaks(input: {
  contentHeight: number;
  pageHeight: number;
  blocks: readonly PaginationBlock[];
  headings: readonly HeadingMetric[];
  maxPasses?: number;
  maxPages?: number;
}): HeadingBreakResult {
  const { contentHeight, pageHeight, blocks, headings } = input;
  const maxPasses = input.maxPasses ?? 3;

  const forced: number[] = [];
  const run = () =>
    computeCuts({
      contentHeight,
      pageHeight,
      blocks,
      forcedTops: forced.map((i) => headings[i].top),
      maxPages: input.maxPages,
    });

  let cuts = run();
  let passes = 0;
  let settled = false;

  // Selection runs once more than the recompute does: the extra run is what
  // proves the last layout needs no further pushing.
  for (;;) {
    const next = selectHeadingsToPush({
      headings,
      cuts: cuts.map((c) => c.at),
      pageHeight,
    }).filter((i) => !forced.includes(i));

    if (next.length === 0) {
      settled = true;
      break;
    }
    if (passes >= maxPasses) break;

    forced.push(...next);
    cuts = run();
    passes++;
  }

  const forcedHeadings = cuts
    .filter((c) => c.kind === "forced" && c.forcedIndex !== undefined)
    .map((c) => forced[c.forcedIndex as number]);

  return { cuts, forcedHeadings, passes, settled };
}
