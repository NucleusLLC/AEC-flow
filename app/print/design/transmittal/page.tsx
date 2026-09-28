import type { Metadata } from "next";
import { listDeliverables } from "@/lib/data/design";
import {
  DISCIPLINE_LABEL,
  DELIVERABLE_TYPE_LABEL,
  DELIVERABLE_STATUS_LABEL,
  disciplineFromSlug,
} from "@/lib/design/types";
import { CaPrintShell, PrintSection } from "@/components/construction-admin/print-shell";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

export const metadata: Metadata = { title: "Drawing Transmittal · Print" };

export default async function TransmittalPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ discipline?: string }>;
}) {
  const t = await getServerT();
  const { discipline: slug } = await searchParams;
  const discipline = slug ? disciplineFromSlug(slug) ?? undefined : undefined;
  const items = await listDeliverables(discipline ? { discipline } : {});
  const scope = discipline ? t(DISCIPLINE_LABEL[discipline]) : t("All disciplines");
  const backHref = discipline && slug ? `/design/${slug}` : "/design";

  return (
    <CaPrintShell
      backHref={backHref}
      docTitle={t("Drawing Transmittal")}
      refNumber={items.length === 1 ? t("1 item") : fmt(t("{count} items"), { count: items.length })}
      statusLabel={scope}
      title={t("Drawing / Document Transmittal")}
      meta={[
        { label: t("Discipline"), value: scope },
        { label: t("Items"), value: String(items.length) },
        { label: t("To"), value: "" },
        { label: t("Date"), value: "" },
      ]}
      signatures={[
        { role: t("Issued by"), name: "" },
        { role: t("Received by"), name: "" },
      ]}
    >
      {items.length === 0 ? (
        <p className="mt-6 text-[11px] text-gray-500">{t("No deliverables to transmit.")}</p>
      ) : (
        <PrintSection title={t("Deliverables")}>
          <table className="w-full border-collapse text-[10.5px]">
            <thead>
              <tr className="border-b border-gray-300 text-left text-gray-500">
                <th className="py-1 pr-2 font-medium">{t("Number")}</th>
                <th className="py-1 px-2 text-center font-medium">{t("Rev")}</th>
                <th className="py-1 px-2 font-medium">{t("Title")}</th>
                <th className="py-1 px-2 font-medium">{t("Type")}</th>
                <th className="py-1 px-2 font-medium">{t("Status")}</th>
                <th className="py-1 pl-2 font-medium">{t("Issued")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id} className="border-b border-gray-200">
                  <td className="py-1 pr-2 font-mono text-gray-900">{d.number}</td>
                  <td className="py-1 px-2 text-center font-mono text-gray-700">{d.revision}</td>
                  <td className="py-1 px-2 text-gray-900">{d.title}</td>
                  <td className="py-1 px-2 text-gray-700">{t(DELIVERABLE_TYPE_LABEL[d.type])}</td>
                  <td className="py-1 px-2 text-gray-700">{t(DELIVERABLE_STATUS_LABEL[d.status])}</td>
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
