import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/estimates/print-button";
import { EstimateDocument } from "@/components/estimates/estimate-document";
import { getEstimateById } from "@/lib/data/estimates";
import { getGeneralConditions } from "@/lib/data/general-conditions-db";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { getFirmIdentity } from "@/lib/server/firm";
import { footerMarginBoxesCss } from "@/lib/documents/footer-boxes";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ gc?: string; usd?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const est = await getEstimateById(id);
  return { title: est ? `${est.id} — Cost Estimate` : "Cost Estimate" };
}

export default async function EstimatePrintPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { gc, usd } = await searchParams;
  const est = await getEstimateById(id);
  if (!est) notFound();
  const { logoDataUrl, logo, profile, footer } = await getPracticeSettings();
  const firm = await getFirmIdentity();
  const companyName = firm.name;

  // General Conditions are opt-in (matches the editor's default-off toggle). Use the
  // firm's SAVED General Conditions (DB), not the static seed, so the exported PDF
  // matches what the editor shows.
  const generalConditions = gc === "1" ? await getGeneralConditions() : undefined;
  // Optional USD secondary unit: ?usd=<rate> (1 estimate-currency = rate USD).
  const usdParsed = usd ? Number(usd) : NaN;
  const usdRate = Number.isFinite(usdParsed) && usdParsed > 0 ? usdParsed : undefined;

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* PROTECTED SYSTEM — integration-only change, approved 2026-08-03.
        *
        * The geometry is UNCHANGED: A4 at 14mm on all four sides, exactly as this
        * route has always declared it, so not a single line of the estimate moves.
        * What it lacked were the two `@page` margin boxes, which is why the Cost
        * Estimate was the one document in the app that printed with no page
        * numbers and no practice strapline — the two things every other document
        * gained. Nothing inside EstimateDocument or the estimate engines is
        * touched; the boxes live in the page context, not in the layout.
        *
        * The box arithmetic is shared with every other document (clearance above
        * the paper edge, explicit widths so "Page 1 of 3" cannot wrap) via
        * lib/documents/footer-boxes. */}
      <style>{`@page { size: A4; margin: 14mm; ${footerMarginBoxesCss({
        pageWidthMm: 210,
        marginLeftMm: 14,
        marginRightMm: 14,
        marginBottomMm: 14,
        footerLeft: footer.text,
      })} } @media print { html, body { background: #fff; } }`}</style>

      {/* Toolbar — hidden when printing */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 print:hidden">
        <Link
          href="/estimates"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to estimate
        </Link>
        <PrintButton />
      </div>

      {/* A4 document sheet */}
      <div className="my-6 print:my-0">
        <EstimateDocument est={est} generalConditions={generalConditions} usdRate={usdRate} logo={{ dataUrl: logoDataUrl, position: logo.position, size: logo.size }} companyName={companyName} />
      </div>
    </div>
  );
}
