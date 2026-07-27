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
  const { logoDataUrl, logo, profile } = await getPracticeSettings();
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
      <style>{`@page { size: A4; margin: 14mm; } @media print { html, body { background: #fff; } }`}</style>

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
