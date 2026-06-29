import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer, Building2 } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { ReportStatusBadge } from "@/components/construction-admin/badges";
import { getReport } from "@/lib/data/ca/reports";
import { CA_REPORT_TYPE_LABEL } from "@/lib/ca/labels";
import { formatDate } from "@/lib/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const r = await getReport(id);
  return { title: r ? `${r.reportNumber} · AEC-flow` : "Report · AEC-flow" };
}

function Section({ title, body }: { title: string; body: string | null }) {
  if (!body) return null;
  return (
    <div>
      <div className="text-xs font-medium text-muted">{title}</div>
      <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-fg">{body}</p>
    </div>
  );
}

export default async function ReportDetailPage({ params }: PageProps) {
  const { id } = await params;
  const r = await getReport(id);
  if (!r) notFound();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href="/construction-admin/reports" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        Reports
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-faint">{r.reportNumber}</span>
            <ReportStatusBadge status={r.status} />
          </div>
          <h2 className="mt-1 text-xl font-semibold text-fg">{CA_REPORT_TYPE_LABEL[r.reportType]}</h2>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted">
            <Building2 className="h-3.5 w-3.5" />
            {r.projectName}
            {r.reportingPeriodStart ? ` · ${formatDate(r.reportingPeriodStart)} – ${formatDate(r.reportingPeriodEnd)}` : ""}
          </span>
        </div>
        <a
          href={`/print/construction-admin/reports/${r.id}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          <Printer className="h-4 w-4" />
          Print / PDF
        </a>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Progress" />
            <CardBody className="space-y-4">
              <Section title="Work completed" body={r.workCompleted} />
              <Section title="Work planned next period" body={r.workPlannedNextPeriod} />
              <Section title="Site conditions" body={r.siteConditions} />
            </CardBody>
          </Card>

          {r.manpowerSummary.length ? (
            <Card>
              <CardHeader title="Manpower" />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                      <th className="px-5 py-2.5 font-medium">Trade</th>
                      <th className="px-3 py-2.5 font-medium text-right">No.</th>
                      <th className="px-5 py-2.5 font-medium text-right">Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {r.manpowerSummary.map((m, i) => (
                      <tr key={i}>
                        <td className="px-5 py-2.5 text-fg">{m.trade}</td>
                        <td className="px-3 py-2.5 text-right text-fg">{m.count}</td>
                        <td className="px-5 py-2.5 text-right text-fg">{m.hours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Events, Quality &amp; Risk" />
            <CardBody className="space-y-4">
              <Section title="Material deliveries" body={r.materialDeliveries} />
              <Section title="Safety incidents" body={r.safetyIncidents} />
              <Section title="Quality issues" body={r.qualityIssues} />
              <Section title="Delays" body={r.delays} />
              <Section title="Risks" body={r.risks} />
              <Section title="Notes" body={r.notes} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="divide-y divide-border py-0">
              <div className="flex items-center justify-between py-2"><span className="text-xs text-muted">Prepared by</span><span className="text-sm text-fg">{r.preparedBy ?? "—"}</span></div>
              <div className="flex items-center justify-between py-2"><span className="text-xs text-muted">Reviewed by</span><span className="text-sm text-fg">{r.reviewedBy ?? "—"}</span></div>
              <div className="flex items-center justify-between py-2"><span className="text-xs text-muted">Approved by</span><span className="text-sm text-fg">{r.approvedBy ?? "—"}</span></div>
              <div className="flex items-center justify-between py-2"><span className="text-xs text-muted">Weather</span><span className="text-sm text-fg">{r.weatherSummary ?? "—"}</span></div>
              <div className="flex items-center justify-between py-2"><span className="text-xs text-muted">Updated</span><span className="text-sm text-fg">{formatDate(r.updatedAt)}</span></div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
