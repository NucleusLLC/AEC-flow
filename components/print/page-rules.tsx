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
  SPACING,
  TABLE_TOKENS,
  LINE_HEIGHT,
  type Density,
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
  /** Row and list rhythm. Registers and schedules want "compact". */
  density = "compact",
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
  density?: Density;
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
    documentCss(density),
    breakRules ? PRINT_BREAK_CSS : "",
  ]
    .filter(Boolean)
    .join("\n");

  return <style>{css}</style>;
}

/**
 * Table and list rhythm, scoped to `.aec-doc` so it reaches document sheets only
 * and never the surrounding app chrome.
 *
 * Applied on screen AND print, deliberately: the preview is meant to show what
 * will be printed, so it cannot use different row heights.
 *
 * Zebra banding uses a neutral slate tint rather than a colour, so it survives
 * grayscale printing and photocopying — a banded row must still read as banded
 * when the document reaches a contractor's black-and-white printer.
 * `print-color-adjust: exact` is required or browsers drop the tint entirely
 * when "Background graphics" is off, which is the common default.
 */
function documentCss(density: Density): string {
  const s = SPACING[density];
  const zebra = `rgba(15, 23, 42, ${TABLE_TOKENS.zebraOpacity})`;

  return `
.aec-doc table { border-collapse: collapse; width: 100%; }

.aec-doc th,
.aec-doc td {
  padding: ${s.tableCellY}mm ${s.tableCellX}mm;
  line-height: ${LINE_HEIGHT.tableBody};
  vertical-align: top;
}

.aec-doc thead th {
  font-weight: 600;
  border-bottom: ${TABLE_TOKENS.headerRuleWidthPt}pt solid #111827;
}

/* Banding is applied to the cells, not the row: a background on <tr> is not
 * painted reliably when the table has border-collapse. */
.aec-doc tbody tr:nth-child(even) > td {
  background-color: ${zebra};
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.aec-doc tbody tr > td { border-bottom: ${TABLE_TOKENS.bodyRuleWidthPt}pt solid #e5e7eb; }
.aec-doc tfoot td { border-top: ${TABLE_TOKENS.totalsRuleWidthPt}pt solid #111827; font-weight: 700; }

/* Lists: tight leading and minimal gaps, with the marker hung outside the text
 * block so wrapped lines align under the first character rather than the bullet. */
.aec-doc ul,
.aec-doc ol {
  margin: ${s.paragraph}mm 0;
  padding-left: 4.5mm;
}

.aec-doc li {
  line-height: ${LINE_HEIGHT.compactBody};
  margin: 0;
}

.aec-doc li + li { margin-top: ${s.listItem}mm; }

/* A blank paragraph between bullets is a common artefact of pasted content and
 * doubles the height of every list. */
.aec-doc li > p { margin: 0; }
.aec-doc li > p + p { margin-top: ${s.listItem}mm; }
`.trim();
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
