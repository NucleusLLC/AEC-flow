import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DevPrintShell, PrintSection, PrintKv } from "@/components/development/print-shell";
import { getDevelopmentProject } from "@/lib/data/development";
import { deriveProjectMetrics } from "@/lib/development/metrics";
import { formatCurrency, formatDate } from "@/lib/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const p = await getDevelopmentProject(id);
  return { title: p ? `${p.projectNumber} — Close-out Report` : "Close-out Report" };
}

export default async function CloseoutPrintPage({ params }: PageProps) {
  const { id } = await params;
  const project = await getDevelopmentProject(id);
  if (!project) notFound();
  const m = deriveProjectMetrics(project);
  const cur = m.currency;
  const budgetVariance = m.totalProjectCost - m.budgetPaid;

  return (
    <DevPrintShell
      backHref={`/development/${project.id}/reports`}
      docTitle="Project Close-out Report"
      refNumber={project.projectNumber}
      projectName={project.name}
      meta={[
        { label: "Location", value: project.location ?? "—" },
        { label: "Target close-out", value: formatDate(project.targetCloseoutDate) },
        { label: "Developer", value: project.developer ?? "—" },
        { label: "Issued", value: formatDate(project.updatedAt) },
      ]}
    >
      <h1 className="mt-6 text-lg font-bold text-gray-900">Project Close-out Report</h1>

      <PrintSection title="Delivery">
        <PrintKv rows={[
          ["Permit tasks approved", `${m.permitDone} of ${m.permitTotal} (${m.permitProgressPct.toFixed(0)}%)`],
          ["Lots placed (sold + closed)", `${m.lotsSold + m.lotsClosed} of ${m.totalLots}`],
          ["Sales absorption", `${m.salesProgressPct.toFixed(0)}%`],
        ]} />
      </PrintSection>

      <PrintSection title="Final cost position">
        <PrintKv rows={[
          ["Total project budget", formatCurrency(m.totalProjectCost, cur)],
          ["Paid to date", formatCurrency(m.budgetPaid, cur)],
          ["Outstanding / variance", formatCurrency(budgetVariance, cur)],
          ["Budget overruns (lines)", String(m.budgetOverruns)],
        ]} />
      </PrintSection>

      <PrintSection title="Final financial result">
        <PrintKv rows={[
          ["Total revenue", formatCurrency(m.totalRevenue, cur)],
          ["Total cost", formatCurrency(m.totalProjectCost, cur)],
          ["Total profit", formatCurrency(m.totalProfit, cur)],
          ["Gross margin", `${m.grossMarginPct.toFixed(1)}%`],
          ["Return on cost (ROI)", `${m.roiPct.toFixed(1)}%`],
          ["Cash collected", formatCurrency(m.cashCollected, cur)],
          ["Outstanding receivable", formatCurrency(m.outstandingReceivables, cur)],
        ]} />
      </PrintSection>

      <PrintSection title="Sign-off">
        <div className="mt-6 grid grid-cols-3 gap-8">
          {["Project Manager", "Developer", "Owner"].map((role) => (
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
