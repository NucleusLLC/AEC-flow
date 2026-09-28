import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaPrintShell, PrintSection } from "@/components/construction-admin/print-shell";
import { getReport } from "@/lib/data/ca/reports";
import { CA_REPORT_TYPE_LABEL, CA_REPORT_STATUS_LABEL } from "@/lib/ca/labels";
import { formatDate } from "@/lib/format";
import { getServerT } from "@/lib/i18n/server";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const r = await getReport(id);
  return { title: r ? `${r.reportNumber} — ${CA_REPORT_TYPE_LABEL[r.reportType]}` : "Report" };
}

function Para({ title, body }: { title: string; body: string | null }) {
  if (!body) return null;
  return (
    <PrintSection title={title}>
      <p className="whitespace-pre-wrap text-gray-800">{body}</p>
    </PrintSection>
  );
}

export default async function ReportPrintPage({ params }: PageProps) {
  const t = await getServerT();
  const { id } = await params;
  const r = await getReport(id);
  if (!r) notFound();

  return (
    <CaPrintShell
      backHref={`/construction-admin/reports/${r.id}`}
      docTitle={t(CA_REPORT_TYPE_LABEL[r.reportType])}
      refNumber={r.reportNumber}
      statusLabel={t(CA_REPORT_STATUS_LABEL[r.status])}
      title={`${r.projectName}`}
      meta={[
        { label: t("Period"), value: r.reportingPeriodStart ? `${formatDate(r.reportingPeriodStart)} – ${formatDate(r.reportingPeriodEnd)}` : "—" },
        { label: t("Prepared by"), value: r.preparedBy ?? "—" },
        { label: t("Reviewed by"), value: r.reviewedBy ?? "—" },
        { label: t("Weather"), value: r.weatherSummary ?? "—" },
      ]}
      signatures={[
        { role: t("Prepared by"), name: r.preparedBy ?? "" },
        { role: t("Reviewed by"), name: r.reviewedBy ?? "" },
        { role: t("Approved by"), name: r.approvedBy ?? "" },
      ]}
    >
      <Para title={t("Work Completed")} body={r.workCompleted} />
      <Para title={t("Work Planned Next Period")} body={r.workPlannedNextPeriod} />
      <Para title={t("Site Conditions")} body={r.siteConditions} />

      {r.manpowerSummary.length ? (
        <PrintSection title={t("Manpower")}>
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr className="border-y border-gray-300 text-left text-[10px] uppercase tracking-wide text-gray-500">
                <th className="py-1.5 pr-3 font-semibold">{t("Trade")}</th>
                <th className="py-1.5 pr-3 text-right font-semibold">{t("No.")}</th>
                <th className="py-1.5 text-right font-semibold">{t("Hours")}</th>
              </tr>
            </thead>
            <tbody>
              {r.manpowerSummary.map((m, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1.5 pr-3 text-gray-800">{m.trade}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-gray-900">{m.count}</td>
                  <td className="py-1.5 text-right tabular-nums text-gray-900">{m.hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PrintSection>
      ) : null}

      <Para title={t("Material Deliveries")} body={r.materialDeliveries} />
      <Para title={t("Safety Incidents")} body={r.safetyIncidents} />
      <Para title={t("Quality Issues")} body={r.qualityIssues} />
      <Para title={t("Delays")} body={r.delays} />
      <Para title={t("Risks")} body={r.risks} />
      <Para title={t("Notes")} body={r.notes} />
    </CaPrintShell>
  );
}
