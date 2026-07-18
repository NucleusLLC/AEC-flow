import type { Metadata } from "next";
import { listDeliverables } from "@/lib/data/design";
import {
  DISCIPLINE_LABEL,
  DELIVERABLE_TYPE_LABEL,
  DELIVERABLE_STATUS_LABEL,
  disciplineFromSlug,
} from "@/lib/design/types";
import { CaPrintShell, PrintSection } from "@/components/construction-admin/print-shell";

export const metadata: Metadata = { title: "Drawing Transmittal · Print" };

export default async function TransmittalPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ discipline?: string }>;
}) {
  const { discipline: slug } = await searchParams;
  const discipline = slug ? disciplineFromSlug(slug) ?? undefined : undefined;
  const items = await listDeliverables(discipline ? { discipline } : {});
  const scope = discipline ? DISCIPLINE_LABEL[discipline] : "All disciplines";
  const backHref = discipline && slug ? `/design/${slug}` : "/design";

  return (
    <CaPrintShell
      backHref={backHref}
      docTitle="Drawing Transmittal"
      refNumber={`${items.length} items`}
      statusLabel={scope}
      title="Drawing / Document Transmittal"
      meta={[
        { label: "Discipline", value: scope },
        { label: "Items", value: String(items.length) },
        { label: "To", value: "" },
        { label: "Date", value: "" },
      ]}
      signatures={[
        { role: "Issued by", name: "" },
        { role: "Received by", name: "" },
      ]}
    >
      {items.length === 0 ? (
        <p className="mt-6 text-[11px] text-gray-500">No deliverables to transmit.</p>
      ) : (
        <PrintSection title="Deliverables">
          <table className="w-full border-collapse text-[10.5px]">
            <thead>
              <tr className="border-b border-gray-300 text-left text-gray-500">
                <th className="py-1 pr-2 font-medium">Number</th>
                <th className="py-1 px-2 text-center font-medium">Rev</th>
                <th className="py-1 px-2 font-medium">Title</th>
                <th className="py-1 px-2 font-medium">Type</th>
                <th className="py-1 px-2 font-medium">Status</th>
                <th className="py-1 pl-2 font-medium">Issued</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id} className="border-b border-gray-200">
                  <td className="py-1 pr-2 font-mono text-gray-900">{d.number}</td>
                  <td className="py-1 px-2 text-center font-mono text-gray-700">{d.revision}</td>
                  <td className="py-1 px-2 text-gray-900">{d.title}</td>
                  <td className="py-1 px-2 text-gray-700">{DELIVERABLE_TYPE_LABEL[d.type]}</td>
                  <td className="py-1 px-2 text-gray-700">{DELIVERABLE_STATUS_LABEL[d.status]}</td>
                  <td className="py-1 pl-2 text-gray-700">{d.issuedDate ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PrintSection>
      )}
    </CaPrintShell>
  );
}
