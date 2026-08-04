import { DocumentLetterhead } from "@/components/print/document-letterhead";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { getFirmIdentity } from "@/lib/server/firm";
import { PrintSurface } from "@/components/print/print-surface";
import { VersionTag } from "@/components/service-proposals/version-tag";

/**
 * Shared A4 print surface for Construction Admin documents. Renders the
 * practice letterhead (configured company logo, or the company-name wordmark as
 * a fallback), a meta strip, the spec's signature blocks and a disclaimer; the
 * toolbar is hidden when printing. `@page { size: A4 }` gives a true A4 PDF via
 * the browser's "Save as PDF".
 *
 * The page geometry, the paged preview and the footer band are NOT here: they
 * are `PrintSurface`, which every document in the app now sits on. This file is
 * only the Construction Admin document's own furniture. What used to live here —
 * the 14/14/20/14 margins, the 210mm sheet, `pageContentHeightMm={263}` — is
 * `MARGIN_PRESETS.document` and the arithmetic in lib/documents/preview-geometry.
 *
 * Async server component: it loads the org-wide practice settings itself so
 * every consuming print route gets the logo without threading props.
 */
export async function CaPrintShell({
  backHref,
  docTitle,
  refNumber,
  statusLabel,
  versionLabel,
  title,
  meta,
  children,
  signatures,
}: {
  backHref: string;
  docTitle: string;
  refNumber: string;
  statusLabel: string;
  /** Optional document version, printed in Bright Turquoise. Documents without a version
   *  concept simply omit it and nothing renders. */
  versionLabel?: string | null;
  title: string;
  meta: { label: string; value: string }[];
  children: React.ReactNode;
  signatures: { role: string; name: string }[];
}) {
  const { logoDataUrl, logo } = await getPracticeSettings();
  const firm = await getFirmIdentity();
  const companyName = firm.name;
  return (
    <PrintSurface backHref={backHref}>
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
            <div className="text-[11px] text-gray-500">
              {statusLabel}
              {versionLabel ? (
                <>
                  {" · "}
                  <VersionTag label={versionLabel} className="text-[11px]" />
                </>
              ) : null}
            </div>
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
    </PrintSurface>
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
