import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { DelayStatusBadge } from "@/components/construction-admin/badges";
import { DelayNoticeDetermination } from "@/components/construction-admin/delay-notice-determination";
import { getDelayNotice } from "@/lib/data/ca/delay-notices";
import { formatCurrency, formatDate } from "@/lib/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const dn = await getDelayNotice(id);
  return { title: dn ? `${dn.delayNoticeNumber} · ${dn.title} · AEC-flow` : "Delay Notice · AEC-flow" };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-xs text-muted">{label}</span>
      <span className="text-right text-sm text-fg">{children}</span>
    </div>
  );
}

export default async function DelayNoticeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const dn = await getDelayNotice(id);
  if (!dn) notFound();

  return (
    <div className="w-full space-y-6">
      <Link href="/construction-admin/delay-notices" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        Delay Notices
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-faint">{dn.delayNoticeNumber}</span>
            <DelayStatusBadge status={dn.status} />
          </div>
          <h2 className="mt-1 text-xl font-semibold text-fg">{dn.title}</h2>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted">
            <Building2 className="h-3.5 w-3.5" />
            {dn.projectName}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Description" />
            <CardBody className="space-y-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{dn.description ?? "—"}</p>
              {dn.cause ? (
                <div>
                  <div className="text-xs font-medium text-muted">Cause</div>
                  <p className="mt-0.5 text-sm text-fg">{dn.cause}</p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <DelayNoticeDetermination noticeId={dn.id} currentStatus={dn.status} currentApprovedDays={dn.approvedDays} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="divide-y divide-border py-0">
              <Row label="Responsible party">{dn.responsibleParty ?? "—"}</Row>
              <Row label="Claimed days">{dn.claimedDays} d</Row>
              <Row label="Approved days"><span className="font-semibold">{dn.approvedDays} d</span></Row>
              <Row label="Cost impact">{formatCurrency(dn.costImpact, dn.currency)}</Row>
              <Row label="Delay started">{formatDate(dn.dateStarted)}</Row>
              <Row label="Resolved">{formatDate(dn.dateResolved)}</Row>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
