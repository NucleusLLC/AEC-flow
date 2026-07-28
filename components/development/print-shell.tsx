import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/development/print-button";
import { DocumentLetterhead } from "@/components/print/document-letterhead";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { getFirmIdentity } from "@/lib/server/firm";
import { PageRules } from "@/components/print/page-rules";
import { DocumentFont } from "@/components/print/document-font";
import { PagedPreview } from "@/components/print/paged-preview";

/**
 * Shared A4 print surface for Land Development reports — practice letterhead
 * (configured company logo, or the company-name wordmark as a fallback), a meta
 * strip and a disclaimer. `@page { size: A4 }` yields a true A4 PDF via the
 * browser's "Save as PDF". The toolbar is hidden when printing.
 *
 * Async server component: it loads the org-wide practice settings itself so
 * every consuming print route gets the logo without threading props.
 */
export async function DevPrintShell({
  backHref,
  docTitle,
  refNumber,
  projectName,
  meta,
  children,
}: {
  backHref: string;
  docTitle: string;
  refNumber: string;
  projectName: string;
  meta: { label: string; value: string }[];
  children: React.ReactNode;
}) {
  const { logoDataUrl, logo, documentFontId } = await getPracticeSettings();
  const firm = await getFirmIdentity();
  const companyName = firm.name;
  return (
    <DocumentFont fontId={documentFontId} className="min-h-screen bg-gray-100 print:bg-white">
      <PageRules margins={{ top: 14, right: 14, bottom: 14, left: 14 }} footerLeft={refNumber} />

      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 print:hidden">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <PrintButton />
      </div>

      {/* 14mm matches the @page margin, so the preview column is the same width
       * as the printed one and wraps text identically. */}
      <div className="aec-doc mx-auto my-6 w-[210mm] max-w-full bg-white p-[14mm] text-[12px] leading-relaxed text-gray-900 shadow-sm print:my-0 print:w-auto print:p-0 print:shadow-none">
        <PagedPreview pageContentHeightMm={269}>
        {/* Letterhead */}
        <DocumentLetterhead
          logo={{ dataUrl: logoDataUrl, position: logo.position, size: logo.size }}
          name={companyName}
          tagline="Development · Land · Project Management"
          borderClass="border-b-2 border-gray-900 pb-4"
          details={
            <div className="text-right">
              <div className="text-sm font-semibold uppercase tracking-wide text-gray-900">{docTitle}</div>
              <div className="mt-1 font-mono text-xs text-gray-600">{refNumber}</div>
              <div className="text-[11px] text-gray-500">{projectName}</div>
            </div>
          }
        />

        {/* Meta strip */}
        <div className="mt-4 grid grid-cols-4 gap-3 rounded-md bg-gray-50 px-4 py-3 text-[11px] print:bg-gray-50">
          {meta.map((m) => (
            <div key={m.label}>
              <div className="text-gray-400">{m.label}</div>
              <div className="font-medium text-gray-900">{m.value}</div>
            </div>
          ))}
        </div>

        {children}

        <p className="mt-8 text-[9px] leading-relaxed text-gray-400">
          Disclaimer: This development pro-forma is issued for planning and feasibility purposes.
          Figures are based on information available at the date of issue and remain subject to
          verification, market conditions, permit outcomes and final account. Not an offer or a
          guarantee of returns. © {companyName}.
        </p>
        <div className="mt-3 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
          {companyName} · {refNumber} · {docTitle}
        </div>
        </PagedPreview>
      </div>
    </DocumentFont>
  );
}

/**
 * See the note on CaPrintShell's PrintSection: sections must be breakable, or a
 * section taller than a page pushes itself onto a fresh one and leaves most of
 * the preceding page blank. The heading is kept with its content by the shared
 * `break-after: avoid` rule instead.
 */
export function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="border-b border-gray-300 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** Two-column key/value rows for the print sheet. */
export function PrintKv({ rows }: { rows: Array<[string, string]> }) {
  return (
    <table className="w-full text-[11px]">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-dashed border-gray-200">
            <td className="py-1 text-gray-500">{k}</td>
            <td className="py-1 text-right font-medium text-gray-900">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
