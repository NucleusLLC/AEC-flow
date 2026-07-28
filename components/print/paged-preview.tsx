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

type Atom = { top: number; bottom: number; height: number };

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
        out.push({ top, bottom: top + rect.height, height: rect.height });
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

export function PagedPreview({
  /** Printable height of one page in millimetres (page height − top/bottom margins). */
  pageContentHeightMm,
  /** Printable width, used only to detect a sheet squeezed narrower than paper. */
  pageContentWidthMm = 182,
  children,
}: {
  pageContentHeightMm: number;
  pageContentWidthMm?: number;
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

      const atoms = collectAtoms(el, hostTop);
      const contentHeight = hostRect.height;

      // Fill each page to its full height, then pull the boundary back only if
      // it would land inside a block that cannot be split — that block moves down
      // whole, which is exactly what the print engine does.
      const found: { top: number; page: number }[] = [];
      let pageStart = 0;
      let page = 1;

      while (pageStart + pageH < contentHeight - 1) {
        let boundary = pageStart + pageH;

        const straddler = atoms.find(
          (a) => a.top > pageStart && a.top < boundary && a.bottom > boundary && a.height <= pageH,
        );
        if (straddler) boundary = straddler.top;

        found.push({ top: boundary, page });
        page += 1;
        pageStart = boundary;

        // Defensive: a boundary that fails to advance would spin forever.
        if (found.length > 200) break;
      }

      setBreaks(found);
      setTotal(page);
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
          style={{ top: b.top }}
        >
          <div className="relative -mx-[14mm] border-t border-dashed border-gray-300">
            <span className="absolute -top-[9px] right-[14mm] bg-white px-2 text-[10px] font-medium text-gray-400">
              Page {b.page} of {total}
            </span>
          </div>
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
