import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { SubmittalStatusBadge, DisciplineBadge } from "@/components/construction-admin/badges";
import { SubmittalReview } from "@/components/construction-admin/submittal-review";
import { getSubmittal } from "@/lib/data/ca/submittals";
import { formatDate } from "@/lib/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const sub = await getSubmittal(id);
  return { title: sub ? `${sub.submittalNumber} · ${sub.title} · AEC-flow` : "Submittal · AEC-flow" };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-xs text-muted">{label}</span>
      <span className="text-right text-sm text-fg">{children}</span>
    </div>
  );
}

export default async function SubmittalDetailPage({ params }: PageProps) {
  const { id } = await params;
  const sub = await getSubmittal(id);
  if (!sub) notFound();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href="/construction-admin/submittals" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        Submittals
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-faint">{sub.submittalNumber}</span>
            <SubmittalStatusBadge status={sub.status} />
            <DisciplineBadge discipline={sub.discipline} />
          </div>
          <h2 className="mt-1 text-xl font-semibold text-fg">{sub.title}</h2>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted">
            <Building2 className="h-3.5 w-3.5" />
            {sub.projectName}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Description" />
            <CardBody>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{sub.description ?? "—"}</p>
            </CardBody>
          </Card>

          {sub.reviewerComments ? (
            <Card>
              <CardHeader title="Reviewer comments" subtitle={sub.reviewedBy ? `By ${sub.reviewedBy}` : undefined} />
              <CardBody>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{sub.reviewerComments}</p>
              </CardBody>
            </Card>
          ) : null}

          <SubmittalReview
            submittalId={sub.id}
            currentStatus={sub.status}
            currentReviewedBy={sub.reviewedBy}
            currentComments={sub.reviewerComments}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="divide-y divide-border py-0">
              <Row label="Submitted by">{sub.submittedBy ?? "—"}</Row>
              <Row label="Reviewed by">{sub.reviewedBy ?? "—"}</Row>
              <Row label="Required by">{formatDate(sub.dateRequired)}</Row>
              <Row label="Submitted">{formatDate(sub.dateSubmitted)}</Row>
              <Row label="Reviewed">{formatDate(sub.dateReviewed)}</Row>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
