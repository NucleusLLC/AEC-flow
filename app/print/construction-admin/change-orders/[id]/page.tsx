import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaPrintShell, PrintSection } from "@/components/construction-admin/print-shell";
import { getChangeOrder } from "@/lib/data/ca/change-orders";
import { changeOrderBreakdown } from "@/lib/ca/calc";
import { CHANGE_ORDER_STATUS_LABEL, tCa } from "@/lib/ca/labels";
import { formatCurrency, formatDate } from "@/lib/format";
import { getServerLocale, getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const co = await getChangeOrder(id);
  return { title: co ? `${co.changeOrderNumber} — Change Order` : "Change Order" };
}

export default async function ChangeOrderPrintPage({ params }: PageProps) {
  const t = await getServerT();
  const locale = await getServerLocale();
  const { id } = await params;
  const co = await getChangeOrder(id);
  if (!co) notFound();
  const b = changeOrderBreakdown(co);
  const money = (v: number) => formatCurrency(v, co.currency);

  const rows: [string, number][] = [
    [t("Labor"), co.costLabor],
    [t("Material"), co.costMaterial],
    [t("Equipment"), co.costEquipment],
    [t("Subcontractor"), co.costSubcontractor],
    [t("Subtotal"), b.subtotal],
    [fmt(t("Overhead ({pct}%)"), { pct: co.overheadPercentage }), b.overhead],
    [fmt(t("Profit ({pct}%)"), { pct: co.profitPercentage }), b.profit],
    [fmt(t("Contingency ({pct}%)"), { pct: co.contingencyPercentage }), b.contingency],
    [fmt(t("VAT ({pct}%)"), { pct: co.vatPercentage }), b.vat],
  ];

  return (
    <CaPrintShell
      backHref={`/construction-admin/change-orders/${co.id}`}
      docTitle={t("Change Order")}
      refNumber={co.changeOrderNumber}
      statusLabel={tCa(t, CHANGE_ORDER_STATUS_LABEL[co.status])}
      title={co.title}
      meta={[
        { label: t("Project"), value: co.projectName },
        { label: t("Contractor"), value: co.contractor ?? "—" },
        { label: t("Requested"), value: formatDate(co.dateRequested, locale) },
        { label: t("Approved"), value: formatDate(co.dateApproved, locale) },
      ]}
      signatures={[
        { role: t("Contractor"), name: co.contractor ?? "" },
        { role: t("Consultant"), name: co.architect ?? "" },
        { role: t("Owner"), name: co.owner ?? "" },
      ]}
    >
      {co.reason ? (
        <PrintSection title={t("Reason")}>
          <p className="text-gray-800">{co.reason}</p>
        </PrintSection>
      ) : null}
      {co.description ? (
        <PrintSection title={t("Scope of Work")}>
          <p className="whitespace-pre-wrap text-gray-800">{co.description}</p>
        </PrintSection>
      ) : null}

      <PrintSection title={t("Cost Breakdown")}>
        <table className="w-full border-collapse text-[11.5px]">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-b border-gray-100">
                <td className="py-1.5 pr-3 text-gray-700">{label}</td>
                <td className="py-1.5 text-right tabular-nums text-gray-900">{money(value)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-gray-900">
              <td className="py-2 pr-3 font-semibold text-gray-900">{t("Total Cost")}</td>
              <td className="py-2 text-right font-bold tabular-nums text-gray-900">{money(b.total)}</td>
            </tr>
          </tbody>
        </table>
      </PrintSection>

      <PrintSection title={t("Contract Impact")}>
        <table className="w-full border-collapse text-[11.5px]">
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-1.5 pr-3 text-gray-700">{t("Original contract value")}</td>
              <td className="py-1.5 text-right tabular-nums text-gray-900">{money(co.originalContractValue)}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-1.5 pr-3 text-gray-700">{t("Approved change orders to date")}</td>
              <td className="py-1.5 text-right tabular-nums text-gray-900">{money(co.approvedChangeOrdersToDate)}</td>
            </tr>
            <tr className="border-t-2 border-gray-900">
              <td className="py-2 pr-3 font-semibold text-gray-900">{t("Revised contract value")}</td>
              <td className="py-2 text-right font-bold tabular-nums text-gray-900">{money(co.revisedContractValue)}</td>
            </tr>
            <tr>
              <td className="py-1.5 pr-3 text-gray-700">{t("Schedule impact")}</td>
              <td className="py-1.5 text-right text-gray-900">
                {co.scheduleImpactDays === 0 ? t("None") : fmt(t("{days} days"), { days: `${co.scheduleImpactDays > 0 ? "+" : ""}${co.scheduleImpactDays}` })}
              </td>
            </tr>
          </tbody>
        </table>
      </PrintSection>
    </CaPrintShell>
  );
}
