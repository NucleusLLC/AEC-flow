/**
 * PageRules — the `@page` block and shared print break rules for a document.
 *
 * Replaces the per-route `<style>{`@page { … }`}</style>` literals that had
 * drifted to margins between 0mm and 14mm (docs/document-system/01-AUDIT.md §F2),
 * and adds the two things every multi-page document was missing: page numbers
 * and break control.
 *
 * PAGE NUMBERS. Printed via CSS paged-media margin boxes:
 *
 *     @page { @bottom-center { content: "Page " counter(page) " of " counter(pages); } }
 *
 * This was verified by printing to PDF in Chrome 150 and reading the result
 * back, not assumed — margin boxes were unsupported in Chrome for years, and
 * plenty of advice still says so. They work now.
 *
 * The trade is that numbering lives in the browser's page context, so it costs
 * no layout code and works even in documents whose internals we do not own. On a
 * browser that does not support margin boxes the rule is ignored: no page
 * numbers, no broken layout. That is the correct degradation, but it does mean
 * page numbers depend on the printing browser — recorded in
 * docs/document-system/01-AUDIT.md.
 *
 * BREAK RULES. Emitted as a print stylesheet rather than per-component classes
 * so every document gets the same behaviour: table headers repeat on
 * continuation pages, and headings, signature blocks, totals and captions do not
 * strand at a page boundary.
 */
import {
  DEFAULT_PAGE,
  MARGIN_PRESETS,
  TYPE_SCALE,
  BREAK_RULES,
  type MarginPreset,
  type Margins,
  type Orientation,
  type PaperSize,
} from "@/lib/documents/tokens";

export function PageRules({
  paper = DEFAULT_PAGE.paper,
  orientation = DEFAULT_PAGE.orientation,
  margins = "standard",
  whiteBackgroundOnPrint = true,
  pageNumbers = true,
  /** Small text in the bottom-left margin, e.g. a document reference. */
  footerLeft,
  breakRules = true,
}: {
  paper?: PaperSize;
  orientation?: Orientation;
  /** A named preset, or explicit millimetre margins for a document that needs them. */
  margins?: MarginPreset | Margins;
  whiteBackgroundOnPrint?: boolean;
  /** "Page N of M" in the bottom margin of every page. */
  pageNumbers?: boolean;
  footerLeft?: string;
  /** Shared keep-together / repeating-header rules. */
  breakRules?: boolean;
}) {
  const m: Margins = typeof margins === "string" ? MARGIN_PRESETS[margins] : margins;
  const box = `${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm`;

  // CSS strings are escaped: a stray quote in a document reference would
  // otherwise terminate the content string and break the whole rule.
  const cssString = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

  const marginBoxStyle = `font-size: ${TYPE_SCALE.footer}pt; color: #6b7280; font-family: inherit;`;

  const marginBoxes = [
    pageNumbers
      ? `@bottom-center { content: "Page " counter(page) " of " counter(pages); ${marginBoxStyle} }`
      : "",
    footerLeft ? `@bottom-left { content: ${cssString(footerLeft)}; ${marginBoxStyle} }` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const css = [
    `@page { size: ${paper} ${orientation}; margin: ${box}; ${marginBoxes} }`,
    whiteBackgroundOnPrint ? `@media print { html, body { background: #fff; } }` : "",
    breakRules ? PRINT_BREAK_CSS : "",
  ]
    .filter(Boolean)
    .join("\n");

  return <style>{css}</style>;
}

/**
 * Shared pagination behaviour. `break-inside` is the modern property; the
 * `page-break-*` aliases are kept because Chrome's print path still honours them
 * on some elements where the modern property alone is ignored.
 */
const PRINT_BREAK_CSS = `
@media print {
  /* A table split across pages must carry its header onto the next one. */
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr, img, figure { break-inside: avoid; page-break-inside: avoid; }

  /* A heading must not be the last thing on a page. */
  h1, h2, h3, h4 { break-after: avoid; page-break-after: avoid; }

  /* Blocks that lose their meaning when split. */
  [data-keep-together] { break-inside: avoid; page-break-inside: avoid; }
  [data-break-before] { break-before: page; page-break-before: always; }

  p, li { orphans: ${BREAK_RULES.minimumOrphanLines}; widows: ${BREAK_RULES.minimumWidowLines}; }
}
`.trim();
