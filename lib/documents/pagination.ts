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
 * The vocabulary matches `BREAK_RULES` and `UNUSED_AREA_WARN` in ./tokens:
 * nothing here invents a threshold of its own.
 */
import { UNUSED_AREA_WARN } from "./tokens";

/**
 * A block the print engine refuses to split — a table row, an image, or
 * anything carrying `break-inside: avoid`. Splittable text contributes no
 * constraint and is deliberately absent (see `collectAtoms` in PagedPreview).
 *
 * `soft` marks a block the MEASURING PASS itself made unbreakable (PagedPreview's
 * `data-auto-keep`), as opposed to one the document or the print CSS made
 * unbreakable. The distinction matters because only a soft block can be given
 * back: when moving it whole would vacate more of the page than
 * `UNUSED_AREA_WARN` allows, the caller drops the attribute and lets it split.
 * A hard block cannot be argued with — the browser will move it whole whatever
 * we model — so it is never declined, or the preview would stop matching print.
 */
export type PaginationBlock = {
  top: number;
  bottom: number;
  height: number;
  soft?: boolean;
};

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
  /**
   * Index into `blocks` of a SOFT block this boundary runs through because
   * moving it whole would have wasted more than `maxUnusedFraction` of the page.
   * The caller must stop making that block unbreakable, or the printed page will
   * move it down and disagree with this layout.
   */
  splitBlockIndex?: number;
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
  /**
   * Most of a page that may be left unused to move a SOFT block down whole.
   * Defaults to the §7.1 token; see the `soft` note on `PaginationBlock`.
   */
  maxUnusedFraction?: number;
  maxPages?: number;
}): PageCut[] {
  const { contentHeight, pageHeight, blocks } = input;
  const maxPages = input.maxPages ?? MAX_PAGES;
  const maxUnused = input.maxUnusedFraction ?? UNUSED_AREA_WARN;
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
    let splitBlockIndex: number | undefined;

    if (moreContent) {
      const straddler = blocks.findIndex(
        (b) => b.top > pageStart && b.top < at && b.bottom > at && b.height <= pageHeight,
      );
      // A block that will not fit in what is left of the page moves down whole —
      // but only while the hole it leaves stays within the §7.1 ceiling. A soft
      // block that would vacate more than that is worth less than the page it
      // costs, so the boundary runs through it and the caller unbinds it. The
      // page it would have started is the one that ends up nearly empty, which is
      // the failure this ceiling exists to stop.
      const vacates = straddler >= 0 ? pageHeight - (blocks[straddler].top - pageStart) : 0;
      const declined =
        straddler >= 0 && blocks[straddler].soft === true && vacates > pageHeight * maxUnused;

      if (declined) {
        splitBlockIndex = straddler;
        const starter = blocks.findIndex((b, i) => i !== straddler && b.top >= at - 1);
        if (starter >= 0) blockIndex = starter;
      } else if (straddler >= 0) {
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
      // The page now ends earlier than the block that was going to be split, so
      // nothing has to be unbound after all.
      splitBlockIndex = undefined;
    } else if (!moreContent) {
      // The only forced break left sits past the end of the content, or close
      // enough to the boundary to be a no-op. Nothing more to cut.
      break;
    }

    if (at <= pageStart + PAGE_START_EPSILON_PX) break;

    cuts.push({ at, kind, blockIndex, forcedIndex, splitBlockIndex });
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
 *
 * `followingContentHeight` is the third clamp, and the one the floor cannot do
 * without: the height of everything that actually follows the heading inside its
 * own section. A heading can only strand content that EXISTS, so a section whose
 * whole body is shorter than the floor needs exactly its own height and no more.
 * Without this, a three-line section sitting 20mm above the page foot was judged
 * stranded and pushed — vacating the foot of one page to open another holding
 * three lines (measured on SP-2026-001: 91% of page two blank, three printed
 * pages where two hold the document).
 */
export function headingRequiredSpace(input: {
  headingHeight: number;
  minimumSpacePx: number;
  leadInSpacePx?: number;
  maxUnitHeight: number;
  /** Height of the heading's own following content, when the caller can measure it. */
  followingContentHeight?: number;
}): number {
  const need = Math.max(input.minimumSpacePx, input.leadInSpacePx ?? 0);
  const ceiling = Math.min(input.maxUnitHeight, input.followingContentHeight ?? Infinity);
  return input.headingHeight + Math.min(need, ceiling);
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
  /**
   * The final layout. `forcedIndex` on these cuts is rewritten into the caller's
   * `headings` index space — NOT the internal forced-set space `computeCuts`
   * reports — so `headings[cut.forcedIndex]` is the element that begins the page.
   * Reading the raw index here put every screen page-boundary marker on the wrong
   * element (the first two headings of the document instead of the pushed ones).
   */
  cuts: PageCut[];
  /**
   * Heading indices that must carry `break-before: page`. Only headings whose
   * push actually produced a cut in the final layout appear here: stamping one
   * the layout ignored would make the printed page disagree with the measured
   * one for no benefit.
   */
  forcedHeadings: number[];
  /**
   * Indices into `blocks` of soft blocks a boundary runs through. The caller must
   * stop making these unbreakable — see `splitBlockIndex` on `PageCut`.
   */
  softSplits: number[];
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

  // Out of the forced-set index space and into the caller's.
  const resolved = cuts.map((c) =>
    c.forcedIndex === undefined ? c : { ...c, forcedIndex: forced[c.forcedIndex] },
  );

  const forcedHeadings = resolved
    .filter((c) => c.kind === "forced" && c.forcedIndex !== undefined)
    .map((c) => c.forcedIndex as number);

  const softSplits = resolved
    .filter((c) => c.splitBlockIndex !== undefined)
    .map((c) => c.splitBlockIndex as number);

  return { cuts: resolved, forcedHeadings, softSplits, passes, settled };
}
