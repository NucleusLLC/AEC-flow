import Link from "next/link";
import { FileOutput } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { ESTIMATE_DOCS, SCHEDULE_DOCS, SOURCE_LABEL, type SourceSystem, type DocType } from "@/lib/documents/catalog";

export const metadata = { title: "Document Templates · AEC-flow" };

function TemplateGroup({ source, docs }: { source: SourceSystem; docs: DocType[] }) {
  return (
    <Card>
      <CardHeader title={`${SOURCE_LABEL[source]} documents`} subtitle="Generated from the existing system" />
      <CardBody>
        <ul className="grid gap-2 sm:grid-cols-2">
          {docs.map((d) => (
            <li key={d.key}>
              <Link
                href={`/documents/generate?source=${source}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg transition-colors hover:bg-surface-2"
              >
                <span className="flex items-center gap-2">
                  <FileOutput className="h-4 w-4 text-brand" />
                  {d.label}
                </span>
                {!d.backed ? (
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted">
                    Soon
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

export default function DocumentTemplatesPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-fg">Document Templates</h1>
        <p className="mt-1 text-sm text-muted">
          The document types available from each protected system. Selecting one opens the generator
          with that source. Backed types render today; the rest are planned.
        </p>
      </div>
      <TemplateGroup source="estimates" docs={ESTIMATE_DOCS} />
      <TemplateGroup source="schedule" docs={SCHEDULE_DOCS} />
    </div>
  );
}
