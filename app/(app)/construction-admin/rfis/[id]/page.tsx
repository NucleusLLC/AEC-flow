import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Link2, FileDown } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { RfiStatusBadge, RfiPriorityBadge, DisciplineBadge } from "@/components/construction-admin/badges";
import { RfiRespond } from "@/components/construction-admin/rfi-respond";
import { getRfi } from "@/lib/data/ca/rfis";
import { formatDate } from "@/lib/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const rfi = await getRfi(id);
  return { title: rfi ? `${rfi.rfiNumber} · ${rfi.subject} · AEC-flow` : "RFI · AEC-flow" };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-xs text-muted">{label}</span>
      <span className="text-right text-sm text-fg">{children}</span>
    </div>
  );
}

export default async function RfiDetailPage({ params }: PageProps) {
  const { id } = await params;
  const rfi = await getRfi(id);
  if (!rfi) notFound();

  return (
    <div className="w-full space-y-6">
      <Link href="/construction-admin/rfis" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        RFIs
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-faint">{rfi.rfiNumber}</span>
            <RfiStatusBadge status={rfi.status} />
            <RfiPriorityBadge priority={rfi.priority} />
            <DisciplineBadge discipline={rfi.discipline} />
          </div>
          <h2 className="mt-1 text-xl font-semibold text-fg">{rfi.subject}</h2>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted">
            <Building2 className="h-3.5 w-3.5" />
            {rfi.projectName}
          </span>
        </div>
        <Link
          href={`/print/construction-admin/rfis/${rfi.id}`}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          <FileDown className="h-4 w-4" />
          Print / PDF
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Question" />
            <CardBody>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{rfi.question ?? "—"}</p>
            </CardBody>
          </Card>

          {rfi.response ? (
            <Card>
              <CardHeader title="Response" subtitle={rfi.responseBy ? `By ${rfi.responseBy}` : undefined} />
              <CardBody>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{rfi.response}</p>
              </CardBody>
            </Card>
          ) : null}

          <RfiRespond rfiId={rfi.id} initialResponse={rfi.response} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="divide-y divide-border py-0">
              <Row label="Submitted by">{rfi.submittedBy ?? "—"}</Row>
              <Row label="Assigned to">{rfi.assignedTo ?? "—"}</Row>
              <Row label="Submitted">{formatDate(rfi.dateSubmitted)}</Row>
              <Row label="Required by">{formatDate(rfi.dateRequired)}</Row>
              <Row label="Responded">{formatDate(rfi.dateResponded)}</Row>
              {rfi.linkedChangeOrderId ? (
                <Row label="Linked CO">
                  <Link href={`/construction-admin/change-orders/${rfi.linkedChangeOrderId}`} className="inline-flex items-center gap-1 text-brand hover:underline">
                    <Link2 className="h-3.5 w-3.5" />
                    {rfi.linkedChangeOrderId}
                  </Link>
                </Row>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
