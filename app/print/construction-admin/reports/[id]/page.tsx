import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaPrintShell, PrintSection } from "@/components/construction-admin/print-shell";
import { getReport } from "@/lib/data/ca/reports";
import { CA_REPORT_TYPE_LABEL, CA_REPORT_STATUS_LABEL } from "@/lib/ca/labels";
import { formatDate } from "@/lib/format";

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
  const { id } = await params;
  const r = await getReport(id);
  if (!r) notFound();

  return (
    <CaPrintShell
      backHref={`/construction-admin/reports/${r.id}`}
      docTitle={CA_REPORT_TYPE_LABEL[r.reportType]}
      refNumber={r.reportNumber}
      statusLabel={CA_REPORT_STATUS_LABEL[r.status]}
      title={`${r.projectName}`}
      meta={[
        { label: "Period", value: r.reportingPeriodStart ? `${formatDate(r.reportingPeriodStart)} – ${formatDate(r.reportingPeriodEnd)}` : "—" },
        { label: "Prepared by", value: r.preparedBy ?? "—" },
        { label: "Reviewed by", value: r.reviewedBy ?? "—" },
        { label: "Weather", value: r.weatherSummary ?? "—" },
      ]}
      signatures={[
        { role: "Prepared by", name: r.preparedBy ?? "" },
        { role: "Reviewed by", name: r.reviewedBy ?? "" },
        { role: "Approved by", name: r.approvedBy ?? "" },
      ]}
    >
      <Para title="Work Completed" body={r.workCompleted} />
      <Para title="Work Planned Next Period" body={r.workPlannedNextPeriod} />
      <Para title="Site Conditions" body={r.siteConditions} />

      {r.manpowerSummary.length ? (
        <PrintSection title="Manpower">
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr className="border-y border-gray-300 text-left text-[10px] uppercase tracking-wide text-gray-500">
                <th className="py-1.5 pr-3 font-semibold">Trade</th>
                <th className="py-1.5 pr-3 text-right font-semibold">No.</th>
                <th className="py-1.5 text-right font-semibold">Hours</th>
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

      <Para title="Material Deliveries" body={r.materialDeliveries} />
      <Para title="Safety Incidents" body={r.safetyIncidents} />
      <Para title="Quality Issues" body={r.qualityIssues} />
      <Para title="Delays" body={r.delays} />
      <Para title="Risks" body={r.risks} />
      <Para title="Notes" body={r.notes} />
    </CaPrintShell>
  );
}
