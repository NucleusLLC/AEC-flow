import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, ExternalLink } from "lucide-react";
import { getDeliverable } from "@/lib/data/design";
import {
  DISCIPLINE_LABEL,
  DISCIPLINE_SLUG,
  DELIVERABLE_TYPE_LABEL,
} from "@/lib/design/types";
import { Card, CardBody } from "@/components/ui/card";
import { DeliverableStatusBadge } from "@/components/design/status-badge";
import { DeliverableDeleteButton } from "@/components/design/deliverable-delete-button";

export const metadata: Metadata = { title: "Deliverable · AEC-flow" };

export default async function DeliverableDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const d = await getDeliverable(id);
  if (!d) notFound();

  return (
    <div className="w-full max-w-4xl space-y-6">
      <Link
        href={`/design/${DISCIPLINE_SLUG[d.discipline]}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {DISCIPLINE_LABEL[d.discipline]}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-semibold text-fg">{d.number}</span>
            <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-muted">Rev {d.revision}</span>
            <DeliverableStatusBadge status={d.status} />
          </div>
          <h2 className="mt-1 text-xl font-semibold text-fg">{d.title}</h2>
          <p className="text-sm text-muted">
            {DISCIPLINE_LABEL[d.discipline]} · {DELIVERABLE_TYPE_LABEL[d.type]}
            {d.projectName ? ` · ${d.projectName}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/design/deliverable/${d.id}/edit`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Pencil className="h-4 w-4" /> Edit
          </Link>
          <DeliverableDeleteButton id={d.id} number={d.number} discipline={DISCIPLINE_SLUG[d.discipline]} />
        </div>
      </div>

      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <Field label="Type" value={DELIVERABLE_TYPE_LABEL[d.type]} />
          <Field label="Revision" value={d.revision} />
          <Field label="Scale" value={d.scale ?? "—"} />
          <Field label="Sheet size" value={d.sheetSize ?? "—"} />
          <Field label="Issued to" value={d.issuedTo ?? "—"} />
          <Field label="Issued date" value={d.issuedDate ?? "—"} />
          <Field label="Due date" value={d.dueDate ?? "—"} />
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted">File</div>
            <div className="mt-0.5 text-sm">
              {d.fileLink ? (
                <a href={d.fileLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
                  Open <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <span className="text-fg">—</span>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {d.notes ? (
        <Card>
          <CardBody>
            <div className="text-xs font-medium uppercase tracking-wide text-muted">Notes</div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-fg">{d.notes}</p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-sm text-fg">{value}</div>
    </div>
  );
}
