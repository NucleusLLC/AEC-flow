import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DevPrintShell, PrintSection, PrintKv } from "@/components/development/print-shell";
import { getDevelopmentProject } from "@/lib/data/development";
import { deriveProjectMetrics } from "@/lib/development/metrics";
import { computeCashFlow, sum, safeDiv, type CashFlowMonthInput } from "@/lib/development/calc";
import { getServerLocale, getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";
import { formatCurrency, formatDate } from "@/lib/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const p = await getDevelopmentProject(id);
  const t = await getServerT();
  return { title: p ? `${p.projectNumber} — ${t("Investor / Bank Report")}` : t("Investor Report") };
}

export default async function InvestorPrintPage({ params }: PageProps) {
  const { id } = await params;
  const project = await getDevelopmentProject(id);
  if (!project) notFound();
  const t = await getServerT();
  const locale = await getServerLocale();
  const m = deriveProjectMetrics(project);
  const cur = m.currency;

  const cf = computeCashFlow(project.cashFlow.map((x) => x as CashFlowMonthInput), 0);
  const equity = sum(project.cashFlow.map((x) => x.equityInvested));
  const equityMultiple = safeDiv(m.totalProfit + equity, equity);

  return (
    <DevPrintShell
      backHref={`/development/${project.id}/reports`}
      docTitle={t("Investor / Bank Report")}
      refNumber={project.projectNumber}
      projectName={project.name}
      meta={[
        { label: t("Location"), value: project.location ?? "—" },
        { label: t("Owner"), value: project.clientOwner ?? "—" },
        { label: t("Currency"), value: cur },
        { label: t("Issued"), value: formatDate(project.updatedAt, locale) },
      ]}
    >
      <h1 className="mt-6 text-lg font-bold text-gray-900">{t("Investment & Financing Summary")}</h1>

      <PrintSection title={t("Capital")}>
        <PrintKv rows={[
          [t("Total project cost"), formatCurrency(m.totalProjectCost, cur)],
          [t("Equity invested (to date)"), formatCurrency(equity, cur)],
          [t("Peak capital requirement"), formatCurrency(cf.peakCapitalRequirement, cur)],
          [t("Peak funding month"), cf.peakNegativeMonth ?? "—"],
          [t("Cash-flow break-even month"), cf.breakEvenMonth ?? "—"],
        ]} />
      </PrintSection>

      <PrintSection title={t("Returns")}>
        <PrintKv rows={[
          [t("Total expected revenue"), formatCurrency(m.totalRevenue, cur)],
          [t("Total profit"), formatCurrency(m.totalProfit, cur)],
          [t("Gross margin"), `${m.grossMarginPct.toFixed(1)}%`],
          [t("Return on cost (ROI)"), `${m.roiPct.toFixed(1)}%`],
          [t("Equity multiple"), equity > 0 ? `${equityMultiple.toFixed(2)}×` : "—"],
        ]} />
      </PrintSection>

      <PrintSection title={t("Sales & receivables")}>
        <PrintKv rows={[
          [t("Lots sold / closed"), fmt(t("{done} of {total}"), { done: m.lotsSold + m.lotsClosed, total: m.totalLots })],
          [t("Sales absorption"), `${m.salesProgressPct.toFixed(0)}%`],
          [t("Cash collected"), formatCurrency(m.cashCollected, cur)],
          [t("Outstanding receivable"), formatCurrency(m.outstandingReceivables, cur)],
        ]} />
      </PrintSection>
    </DevPrintShell>
  );
}
