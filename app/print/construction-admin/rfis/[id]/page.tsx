import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaPrintShell, PrintSection } from "@/components/construction-admin/print-shell";
import { getRfi } from "@/lib/data/ca/rfis";
import { RFI_STATUS_LABEL, RFI_PRIORITY_LABEL, DISCIPLINE_LABEL, tCa } from "@/lib/ca/labels";
import { formatDate } from "@/lib/format";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const rfi = await getRfi(id);
  return { title: rfi ? `${rfi.rfiNumber} — RFI` : "RFI" };
}

export default async function RfiPrintPage({ params }: PageProps) {
  const t = await getServerT();
  const { id } = await params;
  const rfi = await getRfi(id);
  if (!rfi) notFound();

  return (
    <CaPrintShell
      backHref={`/construction-admin/rfis/${rfi.id}`}
      docTitle={t("Request for Information")}
      refNumber={rfi.rfiNumber}
      statusLabel={tCa(t, RFI_STATUS_LABEL[rfi.status])}
      title={rfi.subject}
      meta={[
        { label: t("Project"), value: rfi.projectName },
        { label: t("Discipline"), value: t(DISCIPLINE_LABEL[rfi.discipline]) },
        { label: t("Priority"), value: t(RFI_PRIORITY_LABEL[rfi.priority]) },
        { label: t("Required by"), value: formatDate(rfi.dateRequired) },
      ]}
      signatures={[
        { role: t("Submitted by"), name: rfi.submittedBy ?? "" },
        { role: t("Responded by"), name: rfi.responseBy ?? "" },
        { role: t("Reviewed by"), name: "" },
      ]}
    >
      <PrintSection title={t("Question")}>
        <p className="whitespace-pre-wrap text-gray-800">{rfi.question ?? "—"}</p>
      </PrintSection>

      <PrintSection title={t("Response")}>
        {rfi.response ? (
          <>
            <p className="whitespace-pre-wrap text-gray-800">{rfi.response}</p>
            {rfi.responseBy ? (
              <p className="mt-2 text-[11px] text-gray-500">
                {fmt(t("Responded by {name}"), { name: rfi.responseBy })}
                {rfi.dateResponded ? ` · ${formatDate(rfi.dateResponded)}` : ""}
              </p>
            ) : null}
          </>
        ) : (
          <p className="italic text-gray-400">{t("Awaiting response.")}</p>
        )}
      </PrintSection>

      <PrintSection title={t("Details")}>
        <table className="w-full border-collapse text-[11.5px]">
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-1.5 pr-3 text-gray-700">{t("Submitted by")}</td>
              <td className="py-1.5 text-right text-gray-900">{rfi.submittedBy ?? "—"}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-1.5 pr-3 text-gray-700">{t("Assigned to")}</td>
              <td className="py-1.5 text-right text-gray-900">{rfi.assignedTo ?? "—"}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-1.5 pr-3 text-gray-700">{t("Date submitted")}</td>
              <td className="py-1.5 text-right text-gray-900">{formatDate(rfi.dateSubmitted)}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-1.5 pr-3 text-gray-700">{t("Date required")}</td>
              <td className="py-1.5 text-right text-gray-900">{formatDate(rfi.dateRequired)}</td>
            </tr>
            <tr className={rfi.linkedChangeOrderId ? "border-b border-gray-100" : ""}>
              <td className="py-1.5 pr-3 text-gray-700">{t("Date responded")}</td>
              <td className="py-1.5 text-right text-gray-900">{formatDate(rfi.dateResponded)}</td>
            </tr>
            {rfi.linkedChangeOrderId ? (
              <tr>
                <td className="py-1.5 pr-3 text-gray-700">{t("Linked change order")}</td>
                <td className="py-1.5 text-right font-mono text-gray-900">{rfi.linkedChangeOrderId}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </PrintSection>
    </CaPrintShell>
  );
}
