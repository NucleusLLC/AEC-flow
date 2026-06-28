import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DevPrintShell, PrintSection } from "@/components/development/print-shell";
import { getDevelopmentProject, projectCostPerNetM2 } from "@/lib/data/development";
import { computeLot, rollupLots } from "@/lib/development/calc";
import { LOT_STATUS_LABEL } from "@/lib/data/development.types";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const p = await getDevelopmentProject(id);
  return { title: p ? `${p.projectNumber} — Lot Sales Report` : "Lot Sales Report" };
}

export default async function LotsPrintPage({ params }: PageProps) {
  const { id } = await params;
  const project = await getDevelopmentProject(id);
  if (!project) notFound();
  const cur = project.currency;
  const costPerM2 = projectCostPerNetM2(project);
  const totals = rollupLots(project.lots.map((l) => ({ areaM2: l.areaM2, baseLandPricePerM2: l.baseLandPricePerM2, premiumAdjustmentPerM2: l.premiumAdjustmentPerM2, allocatedCostPerM2: costPerM2 })));

  return (
    <DevPrintShell
      backHref={`/development/${project.id}/reports`}
      docTitle="Lot Sales Report"
      refNumber={project.projectNumber}
      projectName={project.name}
      meta={[
        { label: "Location", value: project.location ?? "—" },
        { label: "Lots", value: String(project.lots.length) },
        { label: "Cost / net m²", value: `${formatCurrency(costPerM2, cur)}` },
        { label: "Issued", value: formatDate(project.updatedAt) },
      ]}
    >
      <h1 className="mt-6 text-lg font-bold text-gray-900">Lot Sales Report</h1>
      <PrintSection title="Inventory">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-gray-300 text-left text-gray-500">
              <th className="py-1">Lot</th><th className="py-1">Phase</th>
              <th className="py-1 text-right">Area m²</th><th className="py-1 text-right">Price/m²</th>
              <th className="py-1 text-right">Sales</th><th className="py-1 text-right">Cost</th>
              <th className="py-1 text-right">Profit</th><th className="py-1 text-right">Margin</th>
              <th className="py-1">Status</th><th className="py-1">Buyer</th>
            </tr>
          </thead>
          <tbody>
            {project.lots.map((l) => {
              const c = computeLot({ areaM2: l.areaM2, baseLandPricePerM2: l.baseLandPricePerM2, premiumAdjustmentPerM2: l.premiumAdjustmentPerM2, allocatedCostPerM2: costPerM2 });
              return (
                <tr key={l.id} className="border-b border-dashed border-gray-200">
                  <td className="py-1 font-medium text-gray-900">{l.lotNumber}</td>
                  <td className="py-1 text-gray-500">{l.phase ?? "—"}</td>
                  <td className="py-1 text-right tabular-nums">{formatNumber(l.areaM2)}</td>
                  <td className="py-1 text-right tabular-nums">{formatNumber(c.finalSalesPricePerM2)}</td>
                  <td className="py-1 text-right tabular-nums">{formatCurrency(c.totalSalesPrice, cur)}</td>
                  <td className="py-1 text-right tabular-nums text-gray-500">{formatCurrency(c.totalAllocatedCost, cur)}</td>
                  <td className="py-1 text-right tabular-nums">{formatCurrency(c.grossProfit, cur)}</td>
                  <td className="py-1 text-right tabular-nums">{c.grossMarginPct.toFixed(0)}%</td>
                  <td className="py-1 text-gray-600">{LOT_STATUS_LABEL[l.status]}</td>
                  <td className="py-1 text-gray-600">{l.buyerName ?? "—"}</td>
                </tr>
              );
            })}
            <tr className="border-t border-gray-400 font-semibold">
              <td className="py-1.5" colSpan={2}>Totals · {totals.count} lots</td>
              <td className="py-1.5 text-right tabular-nums">{formatNumber(totals.totalArea)}</td>
              <td className="py-1.5 text-right tabular-nums">{formatNumber(totals.weightedAvgSalesPricePerM2)}</td>
              <td className="py-1.5 text-right tabular-nums">{formatCurrency(totals.totalRevenue, cur)}</td>
              <td className="py-1.5 text-right tabular-nums text-gray-500">{formatCurrency(totals.totalCost, cur)}</td>
              <td className="py-1.5 text-right tabular-nums">{formatCurrency(totals.totalProfit, cur)}</td>
              <td className="py-1.5 text-right tabular-nums">{totals.avgMarginPct.toFixed(0)}%</td>
              <td colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      </PrintSection>
    </DevPrintShell>
  );
}
