import Link from "next/link";
import { FileOutput } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";
import { ESTIMATE_DOCS, SCHEDULE_DOCS, SOURCE_LABEL, type SourceSystem, type DocType } from "@/lib/documents/catalog";

export const metadata = { title: "Document Templates · AEC-flow" };

function TemplateGroup({
  source,
  docs,
  t,
}: {
  source: SourceSystem;
  docs: DocType[];
  t: (text: string) => string;
}) {
  return (
    <Card>
      <CardHeader title={fmt(t("{source} documents"), { source: t(SOURCE_LABEL[source]) })}
        subtitle={t("Generated from the existing system")} />
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
                  {t(d.label)}
                </span>
                {!d.backed ? (
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted">
                    {t("Soon")}
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

export default async function DocumentTemplatesPage() {
  const t = await getServerT();
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-fg">{t("Document Templates")}</h1>
        <p className="mt-1 text-sm text-muted">
          {t(
            "The document types available from each protected system. Selecting one opens the generator with that source. Backed types render today; the rest are planned.",
          )}
        </p>
      </div>
      <TemplateGroup source="estimates" docs={ESTIMATE_DOCS} t={t} />
      <TemplateGroup source="schedule" docs={SCHEDULE_DOCS} t={t} />
    </div>
  );
}
