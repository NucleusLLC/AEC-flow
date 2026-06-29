import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Link2 } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { SiteInstructionStatusBadge, DisciplineBadge, ImpactBadge } from "@/components/construction-admin/badges";
import { SiteInstructionStatus } from "@/components/construction-admin/site-instruction-status";
import { getSiteInstruction } from "@/lib/data/ca/site-instructions";
import { formatDate } from "@/lib/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const si = await getSiteInstruction(id);
  return { title: si ? `${si.instructionNumber} · ${si.title} · AEC-flow` : "Site Instruction · AEC-flow" };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-xs text-muted">{label}</span>
      <span className="text-right text-sm text-fg">{children}</span>
    </div>
  );
}

export default async function SiteInstructionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const si = await getSiteInstruction(id);
  if (!si) notFound();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href="/construction-admin/site-instructions" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        Site Instructions
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-faint">{si.instructionNumber}</span>
            <SiteInstructionStatusBadge status={si.status} />
            <DisciplineBadge discipline={si.discipline} />
          </div>
          <h2 className="mt-1 text-xl font-semibold text-fg">{si.title}</h2>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted">
            <Building2 className="h-3.5 w-3.5" />
            {si.projectName}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Instruction" />
            <CardBody>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{si.description ?? "—"}</p>
            </CardBody>
          </Card>

          <SiteInstructionStatus instructionId={si.id} currentStatus={si.status} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="divide-y divide-border py-0">
              <Row label="Issued by">{si.issuedBy ?? "—"}</Row>
              <Row label="Issued to">{si.issuedTo ?? "—"}</Row>
              <Row label="Issued">{formatDate(si.dateIssued)}</Row>
              <Row label="Cost impact"><ImpactBadge level={si.costImpact} /></Row>
              <Row label="Schedule impact"><ImpactBadge level={si.scheduleImpact} /></Row>
              {si.linkedChangeOrderId ? (
                <Row label="Linked CO">
                  <Link href={`/construction-admin/change-orders/${si.linkedChangeOrderId}`} className="inline-flex items-center gap-1 text-brand hover:underline">
                    <Link2 className="h-3.5 w-3.5" />
                    {si.linkedChangeOrderId}
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
