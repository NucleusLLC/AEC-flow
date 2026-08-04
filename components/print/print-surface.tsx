import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/print/print-button";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { DOCUMENT_SHEET_CLASS, PageRules } from "@/components/print/page-rules";
import { DocumentFont } from "@/components/print/document-font";
import { PagedPreview } from "@/components/print/paged-preview";
import { sheetGeometry, type SheetRequest } from "@/lib/documents/preview-geometry";
import type { Density } from "@/lib/documents/tokens";

/**
 * PrintSurface — the print behaviour every AEC-Flow document shares, in one place.
 *
 * WHAT IT OWNS, AND WHY IT HAS TO OWN IT. The print-preview work done on the
 * Service Proposal is not one setting; it is a set of numbers that only work
 * because they agree with each other. The `@page` margins, the width the sheet
 * is laid out at on screen, the printable height the measuring pass paginates
 * against, the footer band's height and the 8mm clearance under the strapline
 * are all the same three or four millimetre figures seen from different sides.
 * Every print route used to restate them as its own literals, and they had
 * already drifted: 14/14/20/14 in one shell, 14/14/14/14 in five routes, 12mm
 * page margins with 14mm of sheet padding on the landscape register, and three
 * documents with no paged preview at all. A document whose preview column is a
 * different width from its printed one is not a preview.
 *
 * So the numbers are resolved ONCE, by `sheetGeometry`, and handed to both
 * consumers: `PageRules` (which emits `@page` and the screen sheet rule from
 * them) and `PagedPreview` (which measures against them). A route cannot supply
 * one and forget the other, because it supplies neither.
 *
 * WHAT IT DELIBERATELY DOES NOT OWN. Letterheads, meta strips, signature blocks
 * and disclaimers differ per document and are none of this component's business —
 * they arrive as children. `CaPrintShell` and `DevPrintShell` are those opinions,
 * each wrapped around this surface.
 *
 * Async server component: it reads the org-wide practice settings itself, so a
 * route gets the configured typeface and footer strapline without threading
 * props — and, more to the point, cannot forget to.
 */
export async function PrintSurface({
  backHref,
  backLabel = "Back",
  paper,
  orientation,
  margins,
  density,
  children,
}: SheetRequest & {
  backHref: string;
  /** Toolbar wording; the toolbar itself never prints. */
  backLabel?: string;
  /** Row and list rhythm. Registers and schedules want "compact". */
  density?: Density;
  children: React.ReactNode;
}) {
  const { documentFontId, footer } = await getPracticeSettings();
  const geo = sheetGeometry({ paper, orientation, margins });

  return (
    <DocumentFont fontId={documentFontId} className="min-h-screen bg-gray-100 print:bg-white">
      <PageRules
        paper={geo.paper}
        orientation={geo.orientation}
        margins={geo.margins}
        footerLeft={footer.text}
        density={density}
      />

      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 print:hidden">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        <PrintButton />
      </div>

      {/* The sheet carries no size of its own: DOCUMENT_SHEET_CLASS resolves to the
        * `@media screen` rule PageRules emits from the very margins above, so the
        * preview column is the printed column by construction rather than by two
        * literals agreeing. `max-w-full` still lets a narrow viewport squeeze it —
        * which the measuring pass detects and refuses to paginate under. */}
      <div
        className={`aec-doc ${DOCUMENT_SHEET_CLASS} mx-auto my-6 max-w-full bg-white text-[12px] leading-relaxed text-gray-900 shadow-sm print:my-0 print:shadow-none`}
      >
        <PagedPreview
          pageContentHeightMm={geo.contentHeightMm}
          pageContentWidthMm={geo.contentWidthMm}
          topMarginMm={geo.margins.top}
          bottomMarginMm={geo.margins.bottom}
          sideMarginMm={geo.margins.left}
          footerText={footer.text}
        >
          {children}
        </PagedPreview>
      </div>
    </DocumentFont>
  );
}
