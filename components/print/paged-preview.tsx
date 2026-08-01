"use client";

import { useEffect, useRef, useState } from "react";
import { BREAK_RULES, TABLE_TOKENS } from "@/lib/documents/tokens";
import {
  headingRequiredSpace,
  resolveHeadingBreaks,
  type PageCut,
} from "@/lib/documents/pagination";
import { gutterZones } from "@/lib/documents/preview-geometry";

/**
 * PagedPreview — makes the on-screen document look like the printed one, and
 * makes the printed one break where a human would break it.
 *
 * The print routes render the document as one continuous sheet. When printed,
 * the browser paginates it and the `@page` margin boxes in PageRules add page
 * numbers — but on screen there is no pagination at all, so the reader sees a
 * single endless page with no boundaries and no numbers. That is what made a
 * "Print / Preview" screen fail to show what would actually be printed.
 *
 * This measures the real rendered content and inserts a page boundary wherever
 * the browser will break, then labels each page. It mirrors the browser's own
 * block-flow rule: a top-level block that will not fit in the space left on the
 * page moves to the next one.
 *
 * ACCURACY AND ITS LIMIT. Boundaries are computed from measured element heights
 * against the true printable height, so they land on the same elements the print
 * pipeline chooses in ordinary cases. Two things can still shift a real break:
 * an element taller than a whole page (the browser slices it internally, we
 * cannot), and `break-inside` rules applied deep inside a block rather than at
 * top level. The preview therefore reports the page count it computed, and any
 * disagreement with the printed PDF is a bug worth chasing, not an accepted
 * tolerance.
 *
 * WHAT REACHES THE PRINTED PAGE — read this before changing anything here.
 * An earlier version of this comment claimed the component was screen-only and
 * left print byte-identical. That was never true: the attributes stamped below
 * resolve against rules in PageRules that are deliberately NOT wrapped in
 * `@media print`, so they governed the printed page too whenever the preview had
 * rendered first. That is now the intended design, not an accident:
 *
 *   - `data-auto-keep`      short text blocks that may not be split
 *   - `data-keep-with-next` a heading bound to its opening content
 *   - `data-break-before`   a heading pushed off the foot of a page
 *
 * are measurement results, and the measurement is the only thing in the stack
 * that knows where a page ends — Chrome's print path largely ignores
 * `break-after: avoid`, so a heading cannot be held to its content by CSS alone.
 * The preview and the printer must agree, so both are driven by the same pass.
 * A `beforeprint` listener runs it as well, which covers printing straight from
 * the route without the preview having settled, and repeated prints cannot
 * compound because every pass clears the previous pass's stamps first.
 *
 * Only the page chrome — the boundary rules, footer bands and labels — is
 * screen-only, via `print:hidden` and the `@media screen` gutter rule.
 *
 * The limit of that agreement: heights are measured in screen media. The sheet
 * is laid out at the printed content width (see the note in CaPrintShell), so
 * the two match — but a viewport too narrow to hold paper width wraps text
 * differently, and the pass then refuses to stamp anything rather than stamp
 * wrong. Printing from a squeezed window falls back to plain browser flow.
 */

type Atom = {
  el: HTMLElement;
  top: number;
  bottom: number;
  height: number;
  /** True when this pass is what made the block unbreakable, so it can be undone. */
  soft: boolean;
};

/** Every attribute this component stamps, cleared before each pass. */
const STAMPED_ATTRS = ["data-auto-keep", "data-keep-with-next", "data-break-before"] as const;

/** Removes the spacing applied by a previous measuring pass. */
function clearGutters(root: HTMLElement): void {
  for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-paged-break]"))) {
    el.removeAttribute("data-paged-break");
    el.style.removeProperty("--paged-gutter");
  }
}

/**
 * Removes the break decisions of a previous pass.
 *
 * Without this a second run — a resize, or a second trip through the print
 * dialog — would paginate a document already carrying the first run's forced
 * breaks, and every pass would push headings a little further down the document.
 * Author-written `data-keep-together` is left alone: it is markup, not a
 * measurement, which is why the stamped equivalent has its own attribute.
 */
function clearStamps(root: HTMLElement): void {
  for (const attr of STAMPED_ATTRS) {
    for (const el of Array.from(root.querySelectorAll<HTMLElement>(`[${attr}]`))) {
      el.removeAttribute(attr);
    }
  }
}

/**
 * The blocks the browser genuinely refuses to split, in document order.
 *
 * Getting this set right is the whole game, and it is narrower than it looks.
 * Text is freely breakable: a paragraph spanning a page boundary is split
 * between lines, not moved. Treating a text element as unbreakable — because it
 * happens to have no child elements — makes the preview push a long paragraph to
 * the next page and end the current one three-quarters empty. Measured against
 * SP-2026-001, that put the first boundary at 259px instead of 1017px.
 *
 * Only `break-inside: avoid` makes a block atomic. The shared print CSS applies
 * it to table rows, images, figures and anything tagged `data-keep-together`;
 * everything else is transparent to pagination and is recursed through.
 */
function collectAtoms(root: HTMLElement, hostTop: number): Atom[] {
  const out: Atom[] = [];

  const walk = (el: HTMLElement) => {
    for (const child of Array.from(el.children) as HTMLElement[]) {
      if (child.dataset.pagedPreviewChrome === "true") continue;
      if (child.tagName === "STYLE" || child.tagName === "SCRIPT") continue;

      const cs = getComputedStyle(child);
      if (cs.display === "none") continue;

      const atomic =
        cs.breakInside === "avoid" ||
        cs.pageBreakInside === "avoid" ||
        child.hasAttribute("data-keep-together");

      if (atomic) {
        const rect = child.getBoundingClientRect();
        const top = rect.top + window.scrollY - hostTop;
        out.push({
          el: child,
          top,
          bottom: top + rect.height,
          height: rect.height,
          // Unbreakable because THIS pass said so, and therefore negotiable: see
          // the `soft` note on PaginationBlock. A heading bound to its opening
          // content counts too — holding the pair is worth less than the page it
          // would cost, so the §7.1 ceiling must be able to decline it.
          soft:
            (child.hasAttribute("data-auto-keep") || child.hasAttribute("data-keep-with-next")) &&
            !child.hasAttribute("data-keep-together"),
        });
      } else if (child.children.length > 0) {
        walk(child);
      }
      // A splittable leaf contributes no constraint: the browser will break
      // inside it wherever the page happens to end.
    }
  };

  walk(root);
  return out;
}

const HEADING_SELECTOR = "h1, h2, h3, h4";

/**
 * Elements that are content in their own right rather than a layout wrapper.
 * The lead-in walk stops at the first of these, so `<div class="mt-2"><p>…` —
 * the shape every PrintSection produces — resolves to the paragraph.
 */
const CONTENT_LEAF = /^(P|UL|OL|DL|TABLE|FIGURE|IMG|BLOCKQUOTE|PRE|H1|H2|H3|H4)$/;

/** The first thing the reader sees under a heading. */
function leadInElement(heading: HTMLElement): HTMLElement | null {
  let node = (heading.nextElementSibling ??
    heading.parentElement?.nextElementSibling ??
    null) as HTMLElement | null;

  for (let depth = 0; depth < 8; depth++) {
    if (!node || CONTENT_LEAF.test(node.tagName) || !node.firstElementChild) break;
    node = node.firstElementChild as HTMLElement;
  }
  return node;
}

/** Resolved line height in pixels; `normal` computes to a keyword, not a number. */
function lineHeightPx(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  const lh = parseFloat(cs.lineHeight);
  if (Number.isFinite(lh)) return lh;
  const fs = parseFloat(cs.fontSize);
  return Number.isFinite(fs) ? fs * 1.4 : 0;
}

/**
 * How much of a heading's opening content has to stay on the heading's page.
 *
 * A table is the interesting case: its header repeats on a continuation page, so
 * what must not be stranded is the header plus its first rows (§7.2,
 * `TABLE_TOKENS.minRowsAfterHeader`). Everything else is measured in lines, and
 * capped at what the block actually is — a one-line lead-in needs one line, not
 * two.
 */
function leadInSpace(heading: HTMLElement): number {
  const el = leadInElement(heading);
  if (!el) return 0;

  const table = el.tagName === "TABLE" ? el : el.querySelector("table");
  if (table) {
    const head = table.querySelector("thead");
    const rows = Array.from(table.querySelectorAll("tbody tr")).slice(
      0,
      TABLE_TOKENS.minRowsAfterHeader,
    );
    return (
      (head?.getBoundingClientRect().height ?? 0) +
      rows.reduce((sum, r) => sum + r.getBoundingClientRect().height, 0)
    );
  }

  if (el.tagName === "UL" || el.tagName === "OL") {
    return Array.from(el.children)
      .slice(0, BREAK_RULES.minimumFollowingLines)
      .reduce((sum, li) => sum + li.getBoundingClientRect().height, 0);
  }

  const line = lineHeightPx(el);
  return Math.min(el.getBoundingClientRect().height, BREAK_RULES.minimumFollowingLines * line);
}

/**
 * The element that binds a heading to the content under it, or null when the
 * markup gives us nothing to bind with.
 *
 * A document section is `<section><h2/>…content…</section>`, so the section
 * itself already IS "the heading plus what follows it" — tagging it is how a
 * heading is made to move down whole without rewriting every template's JSX. The
 * walk deliberately climbs no further than one level: the grandparent holds
 * unrelated sections, and binding those together is how a page ends up
 * three-quarters empty.
 */
function keepUnit(heading: HTMLElement, root: HTMLElement): HTMLElement | null {
  const parent = heading.parentElement;
  if (!parent || parent === root) return null;
  if (parent.firstElementChild !== heading) return null;
  if (parent.childElementCount < 2) return null;
  return parent;
}

/**
 * How much content actually follows the heading inside its own section, or null
 * when the markup gives no section to measure — a heading sitting directly in the
 * sheet is followed by the rest of the document, which is not a bounded figure.
 *
 * This is what stops the 20mm floor from demanding more room than the section
 * occupies, and pushing a section that would have fitted (see
 * `headingRequiredSpace`).
 */
function followingContentHeight(heading: HTMLElement, root: HTMLElement): number | undefined {
  const unit = keepUnit(heading, root);
  if (!unit) return undefined;
  const below = unit.getBoundingClientRect().bottom - heading.getBoundingClientRect().bottom;
  return Math.max(0, below);
}

/**
 * Where a forced break is stamped. When the heading opens a section, the section
 * carries it: breaking before the section takes its top margin with it, and the
 * screen gutter then replaces that margin instead of adding to it. The two
 * elements share a border-box top, so this never moves the boundary.
 */
function breakTarget(heading: HTMLElement, root: HTMLElement): HTMLElement {
  const parent = heading.parentElement;
  return parent && parent !== root && parent.firstElementChild === heading ? parent : heading;
}

/** The visible break drawn between one sheet and the next, in millimetres. */
const SHEET_GAP_MM = 6;

export function PagedPreview({
  /** Printable height of one page in millimetres (page height − top/bottom margins). */
  pageContentHeightMm,
  /** Printable width, used only to detect a sheet squeezed narrower than paper. */
  pageContentWidthMm = 182,
  /**
   * The page's own margins in millimetres — the SAME numbers handed to PageRules.
   *
   * The gap between two previewed pages is not decoration: it stands for the
   * bottom margin of the page above plus the top margin of the page below. It
   * used to be a flat 16mm, which is less than the bottom margin alone, so the
   * footer band filled the whole gap and the next page's content resumed with NO
   * top margin — drawn inside the header zone, in paper a printer cannot reach.
   */
  topMarginMm = 14,
  bottomMarginMm = 20,
  /** The practice footer line, shown at the left of each page's footer band. */
  footerText,
  children,
}: {
  pageContentHeightMm: number;
  pageContentWidthMm?: number;
  topMarginMm?: number;
  bottomMarginMm?: number;
  footerText?: string;
  children: React.ReactNode;
}) {
  // The gap opened between two pages: the bottom margin of the page ending, the
  // visible break between two sheets, then the top margin of the page beginning.
  // Content resumes only after all three. The arithmetic lives in
  // lib/documents/preview-geometry so it is unit-tested — a wrong constant here is
  // precisely what drew a continuation page's first line inside the header zone.
  const zones = gutterZones({
    topMm: topMarginMm,
    bottomMm: bottomMarginMm,
    sheetGapMm: SHEET_GAP_MM,
  });
  const gutterMm = zones.gutterMm;
  const hostRef = useRef<HTMLDivElement>(null);
  const [breaks, setBreaks] = useState<{ top: number; page: number }[]>([]);
  const [total, setTotal] = useState(1);
  /** True when the viewport has shrunk the sheet below paper width. */
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    function measure() {
      const el = hostRef.current;
      if (!el) return;

      // Derive px-per-mm from the browser rather than assuming 96dpi: zoom and
      // display scaling both change it, and a wrong factor puts every boundary
      // in the wrong place.
      const probe = document.createElement("div");
      probe.style.cssText = "position:absolute;visibility:hidden;height:100mm;";
      el.appendChild(probe);
      const pxPerMm = probe.getBoundingClientRect().height / 100;
      probe.remove();
      if (!pxPerMm) return;

      const pageH = pageContentHeightMm * pxPerMm;

      // Anything a previous pass applied must go before measuring, or each run
      // would paginate a document already inflated — or already re-broken — by
      // the last one. This is also what keeps a second trip through the print
      // dialog from compounding stamps.
      clearGutters(el);
      clearStamps(el);

      const hostRect = el.getBoundingClientRect();
      const hostTop = hostRect.top + window.scrollY;

      // `max-w-full` on the sheet lets a narrow viewport shrink it below paper
      // width. Text then wraps differently from print and every measured height
      // is wrong, so show no boundaries — and stamp no break decisions — rather
      // than confident wrong ones.
      const squeezed = hostRect.width < pageContentWidthMm * pxPerMm - 2;
      setNarrow(squeezed);
      if (squeezed) {
        setBreaks([]);
        setTotal(1);
        return;
      }

      // A page should not end mid-sentence, so short text blocks are made
      // unbreakable and move whole. The ceiling matters: marking EVERY paragraph
      // unbreakable turned a 197mm scope paragraph into an atom and forced the
      // page to end at its top, wasting three quarters of a sheet. Anything
      // longer than this keeps splitting, which is the lesser evil.
      const keepMax = pageH * 0.35;
      for (const block of Array.from(
        el.querySelectorAll<HTMLElement>("p, li, dd, blockquote"),
      )) {
        const h = block.getBoundingClientRect().height;
        if (h > 0 && h <= keepMax) block.setAttribute("data-auto-keep", "");
      }

      const headings = Array.from(el.querySelectorAll<HTMLElement>(HEADING_SELECTOR)).filter(
        (h) => getComputedStyle(h).display !== "none",
      );

      // KEEP WITH NEXT. A heading and its opening content become one unbreakable
      // unit, so a boundary that would fall between them moves the pair down
      // instead. Bound only when the unit is SHORT, against the same ceiling: a
      // tall unit made atomic is the stranded-page waste described above.
      for (const heading of headings) {
        const unit = keepUnit(heading, el);
        if (unit && unit.getBoundingClientRect().height <= keepMax) {
          unit.setAttribute("data-keep-with-next", "");
        }
      }

      const atoms = collectAtoms(el, hostTop);
      const contentHeight = el.getBoundingClientRect().height;

      // MINIMUM SPACE AT THE FOOT. Binding only helps a section short enough to
      // move whole; a long one still opens with its heading wherever the page
      // happens to be. So measure each heading against the space left below it
      // and push the ones that would arrive with nothing to show.
      const minimumSpacePx = BREAK_RULES.minimumSpaceAfterHeadingMm * pxPerMm;
      const metrics = headings.map((heading) => {
        const rect = heading.getBoundingClientRect();
        return {
          top: rect.top + window.scrollY - hostTop,
          requiredSpace: headingRequiredSpace({
            headingHeight: rect.height,
            minimumSpacePx,
            leadInSpacePx: leadInSpace(heading),
            maxUnitHeight: keepMax,
            followingContentHeight: followingContentHeight(heading, el),
          }),
        };
      });

      const { cuts, forcedHeadings, softSplits } = resolveHeadingBreaks({
        contentHeight,
        pageHeight: pageH,
        blocks: atoms,
        headings: metrics,
      });

      // A block this pass made unbreakable, which the layout then decided to run
      // a boundary through because moving it whole would have wasted most of a
      // page. The stamp has to go, or the print engine would move it after all
      // and print the page this layout says does not exist.
      for (const i of softSplits) {
        atoms[i].el.removeAttribute("data-auto-keep");
        // A declined heading-unit must lose its binding too, or print would hold
        // the pair together and produce the near-empty page this decision
        // rejected.
        atoms[i].el.removeAttribute("data-keep-with-next");
      }

      // `break-before: page` has no effect on a continuous screen, so the pass
      // has already modelled these breaks itself — the attribute is what carries
      // the same decision into the print engine.
      for (const i of forcedHeadings) {
        breakTarget(headings[i], el).setAttribute("data-break-before", "");
      }

      // The block that will begin each next page — the one to push down so the
      // gutter opens in the right place.
      const starterOf = (cut: PageCut): HTMLElement | undefined => {
        // `forcedIndex` from resolveHeadingBreaks is already in this array's index
        // space — see the note on HeadingBreakResult.cuts.
        if (cut.kind === "forced" && cut.forcedIndex !== undefined) {
          return breakTarget(headings[cut.forcedIndex], el);
        }
        return cut.blockIndex !== undefined ? atoms[cut.blockIndex].el : undefined;
      };

      // Open a real gap at each cut: the bottom margin of the page ending, plus
      // the top margin of the page beginning. Screen-only — in print the same gap
      // IS the @page margins. See the CSS note in PageRules.
      const gutterPx = gutterMm * pxPerMm;
      const starters = cuts.map(starterOf);
      for (const starter of starters) {
        if (!starter) continue;
        starter.setAttribute("data-paged-break", "");
        starter.style.setProperty("--paged-gutter", `${gutterPx}px`);
      }

      // Positions shifted when the gutters opened, so read them back rather than
      // predicting where everything landed.
      const hostTop2 = el.getBoundingClientRect().top + window.scrollY;
      const bands = cuts.map((cut, i) => {
        const starter = starters[i];
        const top = starter
          ? starter.getBoundingClientRect().top + window.scrollY - hostTop2 - gutterPx
          : cut.at;
        return { top, page: i + 1 };
      });

      setBreaks(bands);
      setTotal(cuts.length + 1);
    }

    measure();

    // Fonts land after first paint and change every height, so re-measure.
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    if (document.fonts?.ready) void document.fonts.ready.then(measure);
    window.addEventListener("resize", measure);
    // Printing straight from the route, without the preview having settled,
    // must get the same pagination. Chrome fires this before it switches to
    // print layout, so the measurement still reads the screen sheet — which is
    // laid out at the printed content width.
    window.addEventListener("beforeprint", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("beforeprint", measure);
    };
    // `children` is deliberately NOT a dependency. It arrives as an opaque
    // server payload whose identity changes on every render, which would re-run
    // this effect — and tear down the observer — on each one. Content changes
    // are already caught by the ResizeObserver.
    //
    // `gutterMm` IS one: it is the size of the gap the pass opens between pages,
    // so a margin change has to re-measure or every boundary keeps the old
    // spacing.
  }, [pageContentHeightMm, pageContentWidthMm, gutterMm]);

  return (
    <div ref={hostRef} className="relative">
      {children}

      {/* Boundary markers. Absolutely positioned so they add no height and
       * cannot perturb the very layout they are measuring. */}
      {breaks.map((b, i) => (
        <div
          key={i}
          data-paged-preview-chrome="true"
          aria-hidden
          className="pointer-events-none absolute left-0 right-0 z-10 print:hidden"
          style={{ top: b.top, height: `${gutterMm}mm` }}
        >
          {/* The bottom margin of the page that is ending. The footer sits at ITS
            * foot, where the printed @bottom-left / @bottom-right margin boxes
            * are, so the strip above the footer reads as the margin it is.
            *
            * The strapline WRAPS rather than truncating: the printed margin box
            * wraps too, and a preview that ellipsised what print carries onto a
            * second line reported a truncation that was not there — and hid one
            * that was. */}
          <div
            className="flex flex-col justify-end"
            style={{ height: `${zones.footerBandMm}mm` }}
          >
            <div className="flex items-end justify-between gap-4 border-t border-gray-200 pt-1 text-[9px] leading-snug text-gray-400">
              <span className="min-w-0">{footerText}</span>
              <span className="shrink-0 tabular-nums">
                Page {b.page} of {total}
              </span>
            </div>
          </div>
          {/* The sheet edge, then the break between sheets. Below that lies the
            * next page's TOP MARGIN — the remaining `topMarginMm` of this gutter,
            * left empty so content cannot begin inside the header zone. */}
          <div
            className="absolute inset-x-[-14mm] border-b border-gray-300"
            style={{ top: `${zones.sheetEdgeAtMm}mm` }}
          />
          <div
            className="absolute inset-x-[-14mm] bg-gray-100"
            style={{ top: `${zones.sheetEdgeAtMm}mm`, height: `${SHEET_GAP_MM}mm` }}
          />
          <div
            className="absolute inset-x-[-14mm] border-t border-gray-300"
            style={{ top: `${zones.topMarginStartsAtMm}mm` }}
          />
        </div>
      ))}

      {/* The final page carries no boundary above the next one, so label it. */}
      <div
        data-paged-preview-chrome="true"
        aria-hidden
        className="mt-4 border-t border-dashed border-gray-200 pt-2 text-right text-[10px] font-medium text-gray-400 print:hidden"
      >
        {narrow
          ? "Widen the window to preview page breaks at true paper size"
          : `Page ${total} of ${total} · end of document`}
      </div>
    </div>
  );
}
