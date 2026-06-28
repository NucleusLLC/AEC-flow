import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DevPrintShell, PrintSection, PrintKv } from "@/components/development/print-shell";
import { getDevelopmentProject } from "@/lib/data/development";
import { deriveProjectMetrics } from "@/lib/development/metrics";
import { DEV_PROJECT_TYPE_LABEL } from "@/lib/data/development.types";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const p = await getDevelopmentProject(id);
  return { title: p ? `${p.projectNumber} — Feasibility Report` : "Feasibility Report" };
}

export default async function FeasibilityPrintPage({ params }: PageProps) {
  const { id } = await params;
  const project = await getDevelopmentProject(id);
  if (!project) notFound();
  const m = deriveProjectMetrics(project);
  const cur = m.currency;

  return (
    <DevPrintShell
      backHref={`/development/${project.id}/reports`}
      docTitle="Feasibility Report"
      refNumber={project.projectNumber}
      projectName={project.name}
      meta={[
        { label: "Location", value: project.location ?? "—" },
        { label: "Type", value: DEV_PROJECT_TYPE_LABEL[project.projectType] },
        { label: "Developer", value: project.developer ?? "—" },
        { label: "Issued", value: formatDate(project.updatedAt) },
      ]}
    >
      <h1 className="mt-6 text-lg font-bold text-gray-900">Development Feasibility Pro-Forma</h1>

      <PrintSection title="Land & parceling">
        <PrintKv rows={[
          ["Gross parcel area", `${formatNumber(m.grossParcelArea)} m²`],
          ["Net sellable land", `${formatNumber(m.netSellableLand)} m²`],
          ["Net sellable ratio", `${m.sellableRatioPct.toFixed(1)}%`],
          ["Total lots", String(m.totalLots)],
          ["Total units", String(m.totalUnits)],
        ]} />
      </PrintSection>

      <PrintSection title="Cost breakdown by code">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-gray-300 text-left text-gray-500">
              <th className="py-1">Code</th><th className="py-1">Category</th>
              <th className="py-1 text-right">Budget</th><th className="py-1 text-right">Paid</th>
            </tr>
          </thead>
          <tbody>
            {m.budgetByCode.map((b) => (
              <tr key={b.code} className="border-b border-dashed border-gray-200">
                <td className="py-1 font-mono text-gray-500">{b.code}</td>
                <td className="py-1 text-gray-900">{b.name}</td>
                <td className="py-1 text-right tabular-nums">{formatCurrency(b.budget, cur)}</td>
                <td className="py-1 text-right tabular-nums text-gray-500">{formatCurrency(b.paid, cur)}</td>
              </tr>
            ))}
            <tr className="border-t border-gray-400 font-semibold">
              <td className="py-1.5" colSpan={2}>Total project cost</td>
              <td className="py-1.5 text-right tabular-nums">{formatCurrency(m.totalProjectCost, cur)}</td>
              <td className="py-1.5 text-right tabular-nums text-gray-500">{formatCurrency(m.budgetPaid, cur)}</td>
            </tr>
          </tbody>
        </table>
      </PrintSection>

      <PrintSection title="Revenue, profit & returns">
        <PrintKv rows={[
          ["Cost per net sellable m²", `${formatCurrency(m.costPerNetM2, cur)}/m²`],
          ["Break-even sales price", `${formatCurrency(m.breakEvenPerM2, cur)}/m²`],
          ["Lot revenue", formatCurrency(m.lotRevenue, cur)],
          ["Unit revenue", formatCurrency(m.unitRevenue, cur)],
          ["Total expected revenue", formatCurrency(m.totalRevenue, cur)],
          ["Total project cost", formatCurrency(m.totalProjectCost, cur)],
          ["Total profit", formatCurrency(m.totalProfit, cur)],
          ["Gross margin", `${m.grossMarginPct.toFixed(1)}%`],
          ["Return on cost (ROI)", `${m.roiPct.toFixed(1)}%`],
        ]} />
      </PrintSection>

      <PrintSection title="Prepared / approved">
        <div className="mt-6 grid grid-cols-2 gap-8">
          {["Prepared by", "Approved by"].map((role) => (
            <div key={role}>
              <div className="h-px w-full bg-gray-400" />
              <div className="mt-1 text-[11px] text-gray-600">{role}</div>
              <div className="text-[10px] text-gray-400">Name · Date</div>
            </div>
          ))}
        </div>
      </PrintSection>
    </DevPrintShell>
  );
}
