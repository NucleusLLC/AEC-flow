"use client";

import { useEffect, useRef, useState } from "react";

/**
 * PagedPreview — makes the on-screen document look like the printed one.
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
 * ALL OF THIS IS SCREEN ONLY. Every element added here is `print:hidden`, and no
 * layout property is changed for print, so the printed output is byte-identical
 * to what it was before. Print numbering stays with `@page`, which is the only
 * mechanism that can number pages the browser itself decides on.
 */

type Atom = { el: HTMLElement; top: number; bottom: number; height: number };

/** Removes the spacing applied by a previous measuring pass. */
function clearGutters(root: HTMLElement): void {
  for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-paged-break]"))) {
    el.removeAttribute("data-paged-break");
    el.style.removeProperty("--paged-gutter");
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
        out.push({ el: child, top, bottom: top + rect.height, height: rect.height });
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

/** Height of the on-screen gutter drawn between two pages, in millimetres. */
const GUTTER_MM = 16;

export function PagedPreview({
  /** Printable height of one page in millimetres (page height − top/bottom margins). */
  pageContentHeightMm,
  /** Printable width, used only to detect a sheet squeezed narrower than paper. */
  pageContentWidthMm = 182,
  /** The practice footer line, shown at the left of each page's footer band. */
  footerText,
  children,
}: {
  pageContentHeightMm: number;
  pageContentWidthMm?: number;
  footerText?: string;
  children: React.ReactNode;
}) {
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
      const hostRect = el.getBoundingClientRect();
      const hostTop = hostRect.top + window.scrollY;

      // `max-w-full` on the sheet lets a narrow viewport shrink it below paper
      // width. Text then wraps differently from print and every measured height
      // is wrong, so show no boundaries rather than confident wrong ones.
      const squeezed = hostRect.width < pageContentWidthMm * pxPerMm - 2;
      setNarrow(squeezed);
      if (squeezed) {
        setBreaks([]);
        setTotal(1);
        return;
      }

      // Any gutters from a previous pass must go before measuring, or each run
      // would paginate a document already inflated by the last run's spacing.
      clearGutters(el);

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
        else block.removeAttribute("data-auto-keep");
      }

      const atoms = collectAtoms(el, hostTop);
      const contentHeight = el.getBoundingClientRect().height;

      // Fill each page to its full height, then pull the boundary back only if
      // it would land inside a block that cannot be split — that block moves down
      // whole, which is exactly what the print engine does.
      const cuts: { at: number; atom?: Atom }[] = [];
      let pageStart = 0;

      while (pageStart + pageH < contentHeight - 1) {
        let boundary = pageStart + pageH;

        const straddler = atoms.find(
          (a) => a.top > pageStart && a.top < boundary && a.bottom > boundary && a.height <= pageH,
        );
        if (straddler) boundary = straddler.top;

        // The block that will begin the next page — the one to push down so the
        // gutter opens in the right place.
        const starter = straddler ?? atoms.find((a) => a.top >= boundary - 1);

        cuts.push({ at: boundary, atom: starter });
        pageStart = boundary;

        // Defensive: a boundary that fails to advance would spin forever.
        if (cuts.length > 200) break;
      }

      // Open a real gap at each cut so the page footer has room and content is
      // never printed into the band. Screen-only: see the CSS note in PageRules.
      const gutterPx = GUTTER_MM * pxPerMm;
      for (const cut of cuts) {
        if (!cut.atom) continue;
        cut.atom.el.setAttribute("data-paged-break", "");
        cut.atom.el.style.setProperty("--paged-gutter", `${gutterPx}px`);
      }

      // Positions shifted when the gutters opened, so read them back rather than
      // predicting where everything landed.
      const hostTop2 = el.getBoundingClientRect().top + window.scrollY;
      const bands = cuts.map((cut, i) => {
        const top = cut.atom
          ? cut.atom.el.getBoundingClientRect().top + window.scrollY - hostTop2 - gutterPx
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
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
    // `children` is deliberately NOT a dependency. It arrives as an opaque
    // server payload whose identity changes on every render, which would re-run
    // this effect — and tear down the observer — on each one. Content changes
    // are already caught by the ResizeObserver.
  }, [pageContentHeightMm, pageContentWidthMm]);

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
          style={{ top: b.top, height: `${GUTTER_MM}mm` }}
        >
          {/* The page's own footer band — the practice line left, the page
           * number right, exactly as the printed margin boxes place them. */}
          <div className="flex items-end justify-between border-t border-gray-200 pt-1 text-[9px] text-gray-400">
            <span className="truncate pr-4">{footerText}</span>
            <span className="shrink-0 tabular-nums">
              Page {b.page} of {total}
            </span>
          </div>
          {/* The sheet edge: everything below is the next page. */}
          <div className="absolute inset-x-[-14mm] bottom-0 border-b border-gray-300" />
          <div className="absolute inset-x-[-14mm] bottom-0 h-[6mm] translate-y-full bg-gray-100" />
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
