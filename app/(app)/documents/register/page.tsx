import Link from "next/link";
import { FileOutput, ArrowUpRight } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { listGeneratedDocuments } from "@/lib/documents/registry";
import { getServerT } from "@/lib/i18n/server";
import { SOURCE_LABEL, docLabel, type SourceSystem } from "@/lib/documents/catalog";

export const metadata = { title: "Document Register · AEC-flow" };

export default async function DocumentRegisterPage() {
  const docs = await listGeneratedDocuments();
  const t = await getServerT();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">{t("Document Register")}</h1>
          <p className="mt-1 text-sm text-muted">
            {t(
              "Documents generated from Estimates and Schedule, each stamped with the exact source record and version.",
            )}
          </p>
        </div>
        <Link
          href="/documents/generate"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-fg transition-opacity hover:opacity-90"
        >
          <FileOutput className="h-4 w-4" /> {t("Generate")}
        </Link>
      </div>

      {docs.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <p className="text-sm text-muted">{t("No documents recorded yet.")}</p>
            <p className="mx-auto mt-2 max-w-md text-xs text-faint">
              {t(
                "Generate a document to see it here. If you've just added the register, run {command} to create the {table} table.",
              )
                .split(/(\{command\}|\{table\})/)
                .map((part, i) =>
                  part === "{command}" ? (
                    <span key={i} className="font-mono">prisma db push</span>
                  ) : part === "{table}" ? (
                    <span key={i} className="font-mono">generated_documents</span>
                  ) : (
                    part
                  ),
                )}
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-5 py-3">{t("Document")}</th>
                  <th className="px-5 py-3">{t("Source")}</th>
                  <th className="px-5 py-3">{t("Record")}</th>
                  <th className="px-5 py-3">{t("Version")}</th>
                  <th className="px-5 py-3">{t("Module")}</th>
                  <th className="px-5 py-3">{t("Generated")}</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3">
                      <div className="font-medium text-fg">{t(docLabel(d.sourceSystem as SourceSystem, d.docType))}</div>
                      <div className="truncate text-xs text-muted">{d.title}</div>
                    </td>
                    <td className="px-5 py-3 text-muted">{SOURCE_LABEL[d.sourceSystem] ? t(SOURCE_LABEL[d.sourceSystem]) : null}</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted">{d.sourceRecordId}</td>
                    <td className="px-5 py-3 text-muted">{d.sourceRecordVersion ?? "—"}</td>
                    <td className="px-5 py-3 text-muted">
                      {d.generatedInModule ?? "—"}
                      {d.moduleVersion ? <span className="ml-1 text-faint">· {d.moduleVersion}</span> : null}
                    </td>
                    <td className="px-5 py-3 text-muted">{formatDate(d.createdAt)}</td>
                    <td className="px-5 py-3 text-right">
                      {d.renderUrl ? (
                        <Link
                          href={d.renderUrl}
                          className="inline-flex items-center gap-1 text-brand hover:underline"
                        >
                          {t("View")} <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
