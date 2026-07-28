/**
 * PageRules — emits the `@page` block for a printed document from the shared
 * page tokens, so geometry lives in one place instead of fourteen.
 *
 * It replaces per-route literals like:
 *
 *     <style>{`@page { size: A4 portrait; margin: 14mm; } …`}</style>
 *
 * which had drifted to margins between 0mm and 14mm across the print routes,
 * with A4 hardcoded almost everywhere (docs/document-system/01-AUDIT.md §F2).
 *
 * Presentational and hook-free, so it renders identically in server print routes
 * and client preview shells. Emitting a <style> tag is intentional: `@page` is a
 * page-context at-rule that cannot be expressed as an inline style or a Tailwind
 * utility, and it must reach the print stylesheet for the browser's Save-as-PDF
 * to produce a correctly sized page.
 */
import {
  DEFAULT_PAGE,
  MARGIN_PRESETS,
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
}: {
  paper?: PaperSize;
  orientation?: Orientation;
  /** A named preset, or explicit millimetre margins for a document that needs them. */
  margins?: MarginPreset | Margins;
  /** Forces a white page background when printing (screen shells use a grey desk). */
  whiteBackgroundOnPrint?: boolean;
}) {
  const m: Margins = typeof margins === "string" ? MARGIN_PRESETS[margins] : margins;
  const box = `${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm`;

  const css =
    `@page { size: ${paper} ${orientation}; margin: ${box}; }` +
    (whiteBackgroundOnPrint ? ` @media print { html, body { background: #fff; } }` : "");

  return <style>{css}</style>;
}
