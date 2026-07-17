import Link from "next/link";
import { FileOutput, ArrowUpRight } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { listGeneratedDocuments } from "@/lib/documents/registry";
import { SOURCE_LABEL, docLabel, type SourceSystem } from "@/lib/documents/catalog";

export const metadata = { title: "Document Register · AEC-flow" };

export default async function DocumentRegisterPage() {
  const docs = await listGeneratedDocuments();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Document Register</h1>
          <p className="mt-1 text-sm text-muted">
            Documents generated from Estimates and Schedule, each stamped with the exact source
            record and version.
          </p>
        </div>
        <Link
          href="/documents/generate"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-fg transition-opacity hover:opacity-90"
        >
          <FileOutput className="h-4 w-4" /> Generate
        </Link>
      </div>

      {docs.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <p className="text-sm text-muted">No documents recorded yet.</p>
            <p className="mx-auto mt-2 max-w-md text-xs text-faint">
              Generate a document to see it here. If you&apos;ve just added the register, run{" "}
              <span className="font-mono">prisma db push</span> to create the{" "}
              <span className="font-mono">generated_documents</span> table.
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-5 py-3">Document</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Record</th>
                  <th className="px-5 py-3">Version</th>
                  <th className="px-5 py-3">Module</th>
                  <th className="px-5 py-3">Generated</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3">
                      <div className="font-medium text-fg">{docLabel(d.sourceSystem as SourceSystem, d.docType)}</div>
                      <div className="truncate text-xs text-muted">{d.title}</div>
                    </td>
                    <td className="px-5 py-3 text-muted">{SOURCE_LABEL[d.sourceSystem]}</td>
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
                          Open <ArrowUpRight className="h-3.5 w-3.5" />
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
