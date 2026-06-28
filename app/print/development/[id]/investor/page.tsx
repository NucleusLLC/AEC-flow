import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DevPrintShell, PrintSection, PrintKv } from "@/components/development/print-shell";
import { getDevelopmentProject } from "@/lib/data/development";
import { deriveProjectMetrics } from "@/lib/development/metrics";
import { computeCashFlow, sum, safeDiv, type CashFlowMonthInput } from "@/lib/development/calc";
import { formatCurrency, formatDate } from "@/lib/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const p = await getDevelopmentProject(id);
  return { title: p ? `${p.projectNumber} — Investor / Bank Report` : "Investor Report" };
}

export default async function InvestorPrintPage({ params }: PageProps) {
  const { id } = await params;
  const project = await getDevelopmentProject(id);
  if (!project) notFound();
  const m = deriveProjectMetrics(project);
  const cur = m.currency;

  const cf = computeCashFlow(project.cashFlow.map((x) => x as CashFlowMonthInput), 0);
  const equity = sum(project.cashFlow.map((x) => x.equityInvested));
  const equityMultiple = safeDiv(m.totalProfit + equity, equity);

  return (
    <DevPrintShell
      backHref={`/development/${project.id}/reports`}
      docTitle="Investor / Bank Report"
      refNumber={project.projectNumber}
      projectName={project.name}
      meta={[
        { label: "Location", value: project.location ?? "—" },
        { label: "Owner", value: project.clientOwner ?? "—" },
        { label: "Currency", value: cur },
        { label: "Issued", value: formatDate(project.updatedAt) },
      ]}
    >
      <h1 className="mt-6 text-lg font-bold text-gray-900">Investment & Financing Summary</h1>

      <PrintSection title="Capital">
        <PrintKv rows={[
          ["Total project cost", formatCurrency(m.totalProjectCost, cur)],
          ["Equity invested (to date)", formatCurrency(equity, cur)],
          ["Peak capital requirement", formatCurrency(cf.peakCapitalRequirement, cur)],
          ["Peak funding month", cf.peakNegativeMonth ?? "—"],
          ["Cash-flow break-even month", cf.breakEvenMonth ?? "—"],
        ]} />
      </PrintSection>

      <PrintSection title="Returns">
        <PrintKv rows={[
          ["Total expected revenue", formatCurrency(m.totalRevenue, cur)],
          ["Total profit", formatCurrency(m.totalProfit, cur)],
          ["Gross margin", `${m.grossMarginPct.toFixed(1)}%`],
          ["Return on cost (ROI)", `${m.roiPct.toFixed(1)}%`],
          ["Equity multiple", equity > 0 ? `${equityMultiple.toFixed(2)}×` : "—"],
        ]} />
      </PrintSection>

      <PrintSection title="Sales & receivables">
        <PrintKv rows={[
          ["Lots sold / closed", `${m.lotsSold + m.lotsClosed} of ${m.totalLots}`],
          ["Sales absorption", `${m.salesProgressPct.toFixed(0)}%`],
          ["Cash collected", formatCurrency(m.cashCollected, cur)],
          ["Outstanding receivable", formatCurrency(m.outstandingReceivables, cur)],
        ]} />
      </PrintSection>
    </DevPrintShell>
  );
}
