import { DocumentLetterhead } from "@/components/print/document-letterhead";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { getFirmIdentity } from "@/lib/server/firm";
import { PrintSurface } from "@/components/print/print-surface";

/**
 * Shared A4 print surface for Land Development reports — practice letterhead
 * (configured company logo, or the company-name wordmark as a fallback), a meta
 * strip and a disclaimer. `@page { size: A4 }` yields a true A4 PDF via the
 * browser's "Save as PDF". The toolbar is hidden when printing.
 *
 * Everything about the PAGE — geometry, paged preview, footer band, break rules —
 * comes from `PrintSurface`, the same surface the Construction Admin shell sits
 * on. This shell had drifted from it in one specific way: it declared 14/20mm
 * margins to `PageRules` but handed `PagedPreview` nothing, leaving the preview
 * to fall back on its own defaults. Those defaults happened to match, so the gap
 * between two previewed pages was right by luck rather than by construction —
 * and a later margin change here would silently have made it wrong.
 *
 * There is deliberately NO version label: a feasibility study or a lot schedule
 * has no version concept, and inventing one would print a number that means
 * nothing.
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
  const { logoDataUrl, logo } = await getPracticeSettings();
  const firm = await getFirmIdentity();
  const companyName = firm.name;
  return (
    <PrintSurface backHref={backHref}>
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
    </PrintSurface>
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
