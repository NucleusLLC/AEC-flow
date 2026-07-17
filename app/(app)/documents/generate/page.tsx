import { DocumentGenerator } from "@/components/documents/document-generator";
import { getEstimateSummaries } from "@/lib/integrations/estimates/adapter";
import { getScheduleSummaries } from "@/lib/integrations/schedule/adapter";
import { isSourceSystem } from "@/lib/documents/catalog";

export const metadata = { title: "Document Generator · AEC-flow" };

export default async function GenerateDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; recordId?: string }>;
}) {
  const sp = await searchParams;
  const [estimates, schedules] = await Promise.all([
    getEstimateSummaries(),
    getScheduleSummaries(),
  ]);

  const estRecords = estimates.map((e) => ({
    id: e.estimateId,
    label: `${e.projectName} · ${e.version}`,
    sublabel: e.projectNumber,
    version: e.version,
  }));
  const schRecords = schedules.map((s) => ({
    id: s.projectId,
    label: `${s.projectName} · ${s.taskCount} activities`,
    sublabel: s.projectId,
    version: null as string | null,
  }));

  return (
    <DocumentGenerator
      estimateRecords={estRecords}
      scheduleRecords={schRecords}
      initialSource={isSourceSystem(sp.source) ? sp.source : "estimates"}
      initialRecordId={sp.recordId ?? ""}
    />
  );
}
