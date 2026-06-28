import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaPrintShell, PrintSection } from "@/components/construction-admin/print-shell";
import { getChangeOrder } from "@/lib/data/ca/change-orders";
import { changeOrderBreakdown } from "@/lib/ca/calc";
import { CHANGE_ORDER_STATUS_LABEL } from "@/lib/ca/labels";
import { formatCurrency, formatDate } from "@/lib/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const co = await getChangeOrder(id);
  return { title: co ? `${co.changeOrderNumber} — Change Order` : "Change Order" };
}

export default async function ChangeOrderPrintPage({ params }: PageProps) {
  const { id } = await params;
  const co = await getChangeOrder(id);
  if (!co) notFound();
  const b = changeOrderBreakdown(co);
  const money = (v: number) => formatCurrency(v, co.currency);

  const rows: [string, number][] = [
    ["Labor", co.costLabor],
    ["Material", co.costMaterial],
    ["Equipment", co.costEquipment],
    ["Subcontractor", co.costSubcontractor],
    ["Subtotal", b.subtotal],
    [`Overhead (${co.overheadPercentage}%)`, b.overhead],
    [`Profit (${co.profitPercentage}%)`, b.profit],
    [`Contingency (${co.contingencyPercentage}%)`, b.contingency],
    [`VAT (${co.vatPercentage}%)`, b.vat],
  ];

  return (
    <CaPrintShell
      backHref={`/construction-admin/change-orders/${co.id}`}
      docTitle="Change Order"
      refNumber={co.changeOrderNumber}
      statusLabel={CHANGE_ORDER_STATUS_LABEL[co.status]}
      title={co.title}
      meta={[
        { label: "Project", value: co.projectName },
        { label: "Contractor", value: co.contractor ?? "—" },
        { label: "Requested", value: formatDate(co.dateRequested) },
        { label: "Approved", value: formatDate(co.dateApproved) },
      ]}
      signatures={[
        { role: "Contractor", name: co.contractor ?? "" },
        { role: "Consultant", name: co.architect ?? "" },
        { role: "Owner", name: co.owner ?? "" },
      ]}
    >
      {co.reason ? (
        <PrintSection title="Reason">
          <p className="text-gray-800">{co.reason}</p>
        </PrintSection>
      ) : null}
      {co.description ? (
        <PrintSection title="Scope of Work">
          <p className="whitespace-pre-wrap text-gray-800">{co.description}</p>
        </PrintSection>
      ) : null}

      <PrintSection title="Cost Breakdown">
        <table className="w-full border-collapse text-[11.5px]">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-b border-gray-100">
                <td className="py-1.5 pr-3 text-gray-700">{label}</td>
                <td className="py-1.5 text-right tabular-nums text-gray-900">{money(value)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-gray-900">
              <td className="py-2 pr-3 font-semibold text-gray-900">Total Cost</td>
              <td className="py-2 text-right font-bold tabular-nums text-gray-900">{money(b.total)}</td>
            </tr>
          </tbody>
        </table>
      </PrintSection>

      <PrintSection title="Contract Impact">
        <table className="w-full border-collapse text-[11.5px]">
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-1.5 pr-3 text-gray-700">Original contract value</td>
              <td className="py-1.5 text-right tabular-nums text-gray-900">{money(co.originalContractValue)}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-1.5 pr-3 text-gray-700">Approved change orders to date</td>
              <td className="py-1.5 text-right tabular-nums text-gray-900">{money(co.approvedChangeOrdersToDate)}</td>
            </tr>
            <tr className="border-t-2 border-gray-900">
              <td className="py-2 pr-3 font-semibold text-gray-900">Revised contract value</td>
              <td className="py-2 text-right font-bold tabular-nums text-gray-900">{money(co.revisedContractValue)}</td>
            </tr>
            <tr>
              <td className="py-1.5 pr-3 text-gray-700">Schedule impact</td>
              <td className="py-1.5 text-right text-gray-900">
                {co.scheduleImpactDays === 0 ? "None" : `${co.scheduleImpactDays > 0 ? "+" : ""}${co.scheduleImpactDays} days`}
              </td>
            </tr>
          </tbody>
        </table>
      </PrintSection>
    </CaPrintShell>
  );
}
