import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DevPrintShell, PrintSection, PrintKv } from "@/components/development/print-shell";
import { getDevelopmentProject } from "@/lib/data/development";
import { deriveProjectMetrics } from "@/lib/development/metrics";
import { getServerLocale, getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";
import { formatCurrency, formatDate } from "@/lib/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const p = await getDevelopmentProject(id);
  const t = await getServerT();
  return { title: p ? `${p.projectNumber} — ${t("Close-out Report")}` : t("Close-out Report") };
}

export default async function CloseoutPrintPage({ params }: PageProps) {
  const { id } = await params;
  const project = await getDevelopmentProject(id);
  if (!project) notFound();
  const t = await getServerT();
  const locale = await getServerLocale();
  const m = deriveProjectMetrics(project);
  const cur = m.currency;
  const budgetVariance = m.totalProjectCost - m.budgetPaid;

  return (
    <DevPrintShell
      backHref={`/development/${project.id}/reports`}
      docTitle={t("Project Close-out Report")}
      refNumber={project.projectNumber}
      projectName={project.name}
      meta={[
        { label: t("Location"), value: project.location ?? "—" },
        { label: t("Target close-out"), value: formatDate(project.targetCloseoutDate, locale) },
        { label: t("Developer"), value: project.developer ?? "—" },
        { label: t("Issued"), value: formatDate(project.updatedAt, locale) },
      ]}
    >
      <h1 className="mt-6 text-lg font-bold text-gray-900">{t("Project Close-out Report")}</h1>

      <PrintSection title={t("Delivery")}>
        <PrintKv rows={[
          [t("Permit tasks approved"), fmt(t("{done} of {total} ({pct}%)"), { done: m.permitDone, total: m.permitTotal, pct: m.permitProgressPct.toFixed(0) })],
          [t("Lots placed (sold + closed)"), fmt(t("{done} of {total}"), { done: m.lotsSold + m.lotsClosed, total: m.totalLots })],
          [t("Sales absorption"), `${m.salesProgressPct.toFixed(0)}%`],
        ]} />
      </PrintSection>

      <PrintSection title={t("Final cost position")}>
        <PrintKv rows={[
          [t("Total project budget"), formatCurrency(m.totalProjectCost, cur)],
          [t("Paid to date"), formatCurrency(m.budgetPaid, cur)],
          [t("Outstanding / variance"), formatCurrency(budgetVariance, cur)],
          [t("Budget overruns (lines)"), String(m.budgetOverruns)],
        ]} />
      </PrintSection>

      <PrintSection title={t("Final financial result")}>
        <PrintKv rows={[
          [t("Total revenue"), formatCurrency(m.totalRevenue, cur)],
          [t("Total cost"), formatCurrency(m.totalProjectCost, cur)],
          [t("Total profit"), formatCurrency(m.totalProfit, cur)],
          [t("Gross margin"), `${m.grossMarginPct.toFixed(1)}%`],
          [t("Return on cost (ROI)"), `${m.roiPct.toFixed(1)}%`],
          [t("Cash collected"), formatCurrency(m.cashCollected, cur)],
          [t("Outstanding receivable"), formatCurrency(m.outstandingReceivables, cur)],
        ]} />
      </PrintSection>

      <PrintSection title={t("Sign-off")}>
        <div className="mt-6 grid grid-cols-3 gap-8">
          {[t("Project Manager"), t("Developer"), t("Owner")].map((role) => (
            <div key={role}>
              <div className="h-px w-full bg-gray-400" />
              <div className="mt-1 text-[11px] text-gray-600">{role}</div>
              <div className="text-[10px] text-gray-400">{t("Name · Date")}</div>
            </div>
          ))}
        </div>
      </PrintSection>
    </DevPrintShell>
  );
}
