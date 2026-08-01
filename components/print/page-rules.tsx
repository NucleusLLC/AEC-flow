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
  pageSizeMm,
  type Density,
  type MarginPreset,
  type Margins,
  type Orientation,
  type PaperSize,
} from "@/lib/documents/tokens";
import { gutterZones } from "@/lib/documents/preview-geometry";

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

export type PageRulesOptions = {
  paper?: PaperSize;
  orientation?: Orientation;
  /** A named preset, or explicit millimetre margins for a document that needs them. */
  margins?: MarginPreset | Margins;
  whiteBackgroundOnPrint?: boolean;
  /** "Page N of M" in the bottom margin of every page. */
  pageNumbers?: boolean;
  /** Small text in the bottom-left margin, e.g. a document reference. */
  footerLeft?: string;
  /** Shared keep-together / repeating-header rules. */
  breakRules?: boolean;
  /** Row and list rhythm. Registers and schedules want "compact". */
  density?: Density;
};

/**
 * The stylesheet `PageRules` renders, as a string.
 *
 * Split out from the component so the page geometry can be asserted without a
 * DOM: the `@page` margin box work (see `PAGE_NUMBER_WIDTH_MM`) put two at-rules
 * inside the same block as the `margin` shorthand, and a malformed one there
 * would take the document's whole margin down with it. That failure is silent —
 * the page simply prints flush to the paper edge — so it is guarded by
 * lib/documents/page-css.test.ts rather than by reading the output.
 */
export function pageRulesCss({
  paper = DEFAULT_PAGE.paper,
  orientation = DEFAULT_PAGE.orientation,
  margins = "standard",
  whiteBackgroundOnPrint = true,
  pageNumbers = true,
  footerLeft,
  breakRules = true,
  density = "compact",
}: PageRulesOptions): string {
  const m: Margins = typeof margins === "string" ? MARGIN_PRESETS[margins] : margins;
  const box = `${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm`;

  // CSS strings are escaped: a stray quote in a document reference would
  // otherwise terminate the content string and break the whole rule.
  const cssString = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

  // The footer sits FOOTER_FROM_EDGE_MM above the paper edge rather than at the
  // foot of the bottom margin, which read as crowding the edge — and that
  // clearance is inside the unprintable border of a typical desktop printer, so
  // the line cannot be clipped. `vertical-align: bottom` puts the content at the
  // foot of the margin box and the padding then lifts it. The same figure drives
  // the on-screen band (lib/documents/preview-geometry), so the two agree.
  const footerPadMm = gutterZones({ topMm: m.top, bottomMm: m.bottom, sheetGapMm: 0 })
    .footerPadBottomMm;
  const marginBoxStyle = `font-size: ${TYPE_SCALE.footer}pt; line-height: ${LINE_HEIGHT.footer}; color: #6b7280; font-family: inherit; vertical-align: bottom; padding-bottom: ${footerPadMm}mm;`;

  // Footer band layout, matching the Estimates sheet: the practice's footer line
  // on the left, the page number on the right. Nothing sits centred, so a long
  // footer line and the page number cannot collide.
  //
  // Both boxes carry an EXPLICIT width, and the two add up to the strip between
  // the page's left and right margins. Left to the browser's proportional sizing,
  // a footer line longer than the strip took the page number's width with it (see
  // PAGE_NUMBER_WIDTH_MM) and pushed its own tail — a practice's web address — to
  // wherever the remaining width happened to break, which on a real proposal fell
  // inside the address. With a fixed width the line always breaks in the same
  // place, well before its end, and the bottom margin has room for both lines.
  const stripMm = pageSizeMm({ paper, orientation }).width - m.left - m.right;
  const numberWidthMm = pageNumbers ? Math.min(PAGE_NUMBER_WIDTH_MM, stripMm) : 0;
  const footerWidthMm = Math.max(0, stripMm - numberWidthMm);

  const marginBoxes = [
    footerLeft
      ? `@bottom-left { content: ${cssString(footerLeft)}; width: ${footerWidthMm}mm; text-align: left; ${marginBoxStyle} }`
      : "",
    pageNumbers
      ? `@bottom-right { content: "Page " counter(page) " of " counter(pages); width: ${numberWidthMm}mm; white-space: nowrap; text-align: right; ${marginBoxStyle} }`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return [
    `@page { size: ${paper} ${orientation}; margin: ${box}; ${marginBoxes} }`,
    whiteBackgroundOnPrint ? `@media print { html, body { background: #fff; } }` : "",
    documentCss(density),
    breakRules ? PRINT_BREAK_CSS : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function PageRules(props: PageRulesOptions) {
  return <style>{pageRulesCss(props)}</style>;
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
 * Shared pagination behaviour.
 *
 * The break declarations are deliberately NOT wrapped in `@media print`. They
 * have no visual effect on a continuous screen, but the paged preview reads them
 * back with `getComputedStyle` to work out which blocks the printer will refuse
 * to split. Hidden inside a print-only block they would be invisible to the
 * preview, and the preview would once again disagree with the printed page.
 *
 * `break-inside` is the modern property; the `page-break-*` aliases are kept
 * because Chrome's print path still honours them on elements where the modern
 * property alone is ignored.
 */
const PRINT_BREAK_CSS = `
.aec-doc tr,
.aec-doc img,
.aec-doc figure { break-inside: avoid; page-break-inside: avoid; }

/* NOTE: paragraphs and list items are deliberately NOT marked unbreakable here.
 * Doing so made a 197mm scope paragraph atomic, which forced the page to end at
 * its top and left three quarters of the sheet empty — the same waste twice
 * fixed elsewhere. Instead PagedPreview marks only SHORT blocks with
 * data-keep-together (rule below), so ordinary paragraphs and bullets move whole
 * to the next page while an over-long one still splits. */

/* A heading must not be the last thing on a page. */
.aec-doc h1,
.aec-doc h2,
.aec-doc h3,
.aec-doc h4 { break-after: avoid; page-break-after: avoid; }

.aec-doc [data-keep-together] { break-inside: avoid; page-break-inside: avoid; }

/* Applied by PagedPreview to text blocks short enough to move whole. Keeps a
 * page from ending mid-sentence without stranding a page for a long block. */
.aec-doc [data-auto-keep] { break-inside: avoid; page-break-inside: avoid; }

/* Applied by PagedPreview to a heading plus its opening content, and ONLY when
 * that unit is short enough to move whole. Chrome largely ignores
 * \`break-after: avoid\` on the heading itself, so without this rule the pair was
 * never actually held together: a heading could sit at the foot of a page with
 * its body starting the next one — which is exactly what happened to "TERMS &
 * CONDITIONS" on SP-2026-001. The measuring pass treats these units as SOFT, so
 * if honouring one would vacate more of a page than §7.1 allows, the boundary
 * runs through it and the stamp is removed instead. */
.aec-doc [data-keep-with-next] { break-inside: avoid; page-break-inside: avoid; }

.aec-doc [data-break-before] { break-before: page; page-break-before: always; }

.aec-doc p,
.aec-doc li { orphans: ${BREAK_RULES.minimumOrphanLines}; widows: ${BREAK_RULES.minimumWidowLines}; }

/* Screen-only page gutter. PagedPreview sets --paged-gutter on the block that
 * starts each new page, opening a real gap for that page's footer band so
 * content is never drawn underneath it. It is deliberately absent from print:
 * there the gap is the @page bottom margin, and adding margin as well would push
 * every page short. The original top margin is intentionally overridden — a
 * block that begins a page has its top margin dropped by the print engine too. */
@media screen {
  .aec-doc [data-paged-break] { margin-top: var(--paged-gutter, 0) !important; }
}

@media print {
  /* A table split across pages must carry its header onto the next one. */
  .aec-doc thead { display: table-header-group; }
  .aec-doc tfoot { display: table-footer-group; }

  /* ── Adopted from the Cost Estimation sheet (components/estimates/estimate-view.tsx),
   * which was asked for as the reference for how a document should print. Estimates
   * is a protected system, so these were read from it, not moved out of it.
   *
   * A row is never split, and the cells opt in too: Chrome honours break-inside on
   * a <tr> unreliably unless the cells carry it as well, which is what produced
   * half-cut rows there. */
  .aec-doc tr { break-inside: avoid !important; page-break-inside: avoid !important; }
  .aec-doc td,
  .aec-doc th { break-inside: avoid !important; page-break-inside: avoid !important; }
  /* Breaks between a section's rows are fine; inside one is not. */
  .aec-doc tbody { break-inside: auto; page-break-inside: auto; }
  /* Print the colours that are on screen — without this browsers drop light text
   * and backgrounds, which is how the turquoise version label would have printed
   * as nothing. Estimates applies this globally for the same reason. */
  .aec-doc * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  /* Card chrome is screen furniture; the printed sheet carries none. */
  .aec-doc [data-print-plain] { box-shadow: none !important; border: none !important; }
}
`.trim();
