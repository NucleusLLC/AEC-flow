import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/construction-admin/print-button";
import { DocumentLetterhead } from "@/components/print/document-letterhead";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { getFirmIdentity } from "@/lib/server/firm";
import { PageRules } from "@/components/print/page-rules";
import { DocumentFont } from "@/components/print/document-font";

/**
 * Shared A4 print surface for Construction Admin documents. Renders the
 * practice letterhead (configured company logo, or the company-name wordmark as
 * a fallback), a meta strip, the spec's signature blocks and a disclaimer; the
 * toolbar is hidden when printing. `@page { size: A4 }` gives a true A4 PDF via
 * the browser's "Save as PDF".
 *
 * Async server component: it loads the org-wide practice settings itself so
 * every consuming print route gets the logo without threading props.
 */
export async function CaPrintShell({
  backHref,
  docTitle,
  refNumber,
  statusLabel,
  title,
  meta,
  children,
  signatures,
}: {
  backHref: string;
  docTitle: string;
  refNumber: string;
  statusLabel: string;
  title: string;
  meta: { label: string; value: string }[];
  children: React.ReactNode;
  signatures: { role: string; name: string }[];
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

      <div className="mx-auto my-6 w-[210mm] max-w-full bg-white p-[16mm] text-[12px] leading-relaxed text-gray-900 shadow-sm print:my-0 print:w-auto print:p-0 print:shadow-none">
        {/* Letterhead */}
        <DocumentLetterhead
          logo={{ dataUrl: logoDataUrl, position: logo.position, size: logo.size }}
          name={companyName}
          tagline="Architecture · Engineering · Project Management"
          borderClass="border-b-2 border-gray-900 pb-4"
          details={
            <div className="text-right">
              <div className="text-sm font-semibold uppercase tracking-wide text-gray-900">{docTitle}</div>
              <div className="mt-1 font-mono text-xs text-gray-600">{refNumber}</div>
              <div className="text-[11px] text-gray-500">{statusLabel}</div>
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

        <h1 className="mt-6 text-lg font-bold text-gray-900">{title}</h1>

        {children}

        {/* Signatures */}
        <div className="mt-10 break-inside-avoid border-t border-gray-300 pt-6">
          <div className="grid grid-cols-3 gap-8">
            {signatures.map((s) => (
              <div key={s.role}>
                <div className="h-px w-full bg-gray-400" />
                <div className="mt-1 text-xs text-gray-600">{s.role}</div>
                <div className="text-[11px] text-gray-400">{s.name || "Name"} · Date</div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-6 text-[9px] leading-relaxed text-gray-400">
          Disclaimer: This document is issued for construction administration purposes. Figures are
          based on information available at the date of issue and remain subject to verification and
          final account. © {companyName}.
        </p>

        <div className="mt-3 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
          {companyName} · {refNumber} · {docTitle}
        </div>
      </div>
    </DocumentFont>
  );
}

/**
 * A titled block of document content.
 *
 * Deliberately NOT `break-inside: avoid`. A section whose content is taller than
 * one page cannot be kept together, and Chrome resolves that by pushing the
 * whole section to a fresh page — which left the first page of a Service
 * Proposal roughly 70% blank while its Scope of Services section jumped to page
 * two. Sections flow; the heading is held to its content by the shared
 * `break-after: avoid` rule in PageRules, so it can never strand alone at a page
 * foot. Genuinely atomic blocks opt in with `data-keep-together`.
 */
export function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="border-b border-gray-300 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
