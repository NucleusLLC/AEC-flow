import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPurchaseOrder } from "@/lib/data/procurement";
import { lineAmount } from "@/lib/procurement/calc";
import { PO_STATUS_LABEL } from "@/lib/procurement/types";
import { formatCurrency } from "@/lib/format";
import { CaPrintShell, PrintSection } from "@/components/construction-admin/print-shell";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Purchase Order")} · ${t("Print")}` };
}

export default async function PurchaseOrderPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const po = await getPurchaseOrder(id);
  if (!po) notFound();
  const t = await getServerT();

  const money = (n: number) => formatCurrency(n, po.currency, { maximumFractionDigits: 2 });

  return (
    <CaPrintShell
      backHref={`/procurement/${po.id}`}
      docTitle={t("Purchase Order")}
      refNumber={po.poNumber}
      statusLabel={t(PO_STATUS_LABEL[po.status])}
      title={fmt(t("Supplier: {name}"), { name: po.vendorName })}
      meta={[
        { label: t("Project"), value: po.projectName ?? "—" },
        { label: t("Order date"), value: po.orderDate ?? "—" },
        { label: t("Expected"), value: po.expectedDate ?? "—" },
        { label: t("Terms"), value: po.terms ?? "—" },
      ]}
      signatures={[
        { role: t("Prepared by"), name: po.createdByName ?? "" },
        { role: t("Authorized by"), name: "" },
        { role: t("Received by"), name: "" },
      ]}
    >
      <PrintSection title={t("Supplier")}>
        <div className="grid grid-cols-3 gap-3 text-[11px]">
          <div>
            <div className="text-gray-400">{t("Vendor")}</div>
            <div className="font-medium text-gray-900">{po.vendorName}</div>
          </div>
          <div>
            <div className="text-gray-400">{t("Contact")}</div>
            <div className="font-medium text-gray-900">{po.vendorContact ?? "—"}</div>
          </div>
          <div>
            <div className="text-gray-400">{t("Email")}</div>
            <div className="font-medium text-gray-900">{po.vendorEmail ?? "—"}</div>
          </div>
        </div>
      </PrintSection>

      <PrintSection title={t("Line items")}>
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-gray-300 text-left text-gray-500">
              <th className="py-1.5 pr-2 font-medium">{t("Description")}</th>
              <th className="py-1.5 px-2 text-right font-medium">{t("Qty")}</th>
              <th className="py-1.5 px-2 font-medium">{t("Unit")}</th>
              <th className="py-1.5 px-2 text-right font-medium">{t("Unit price")}</th>
              <th className="py-1.5 pl-2 text-right font-medium">{t("Amount")}</th>
            </tr>
          </thead>
          <tbody>
            {po.lineItems.map((l, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="py-1.5 pr-2 text-gray-900">{l.description || "—"}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-gray-700">{l.quantity}</td>
                <td className="py-1.5 px-2 text-gray-700">{l.unit || "—"}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-gray-700">{money(l.unitPrice)}</td>
                <td className="py-1.5 pl-2 text-right tabular-nums text-gray-900">{money(lineAmount(l))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex justify-end">
          <table className="text-[11px]">
            <tbody>
              <tr>
                <td className="py-0.5 pr-6 text-gray-500">{t("Subtotal")}</td>
                <td className="py-0.5 text-right tabular-nums text-gray-900">{money(po.subtotal)}</td>
              </tr>
              <tr>
                <td className="py-0.5 pr-6 text-gray-500">{fmt(t("Tax ({percent}%)"), { percent: po.taxPercentage })}</td>
                <td className="py-0.5 text-right tabular-nums text-gray-900">{money(po.subtotal * (po.taxPercentage / 100))}</td>
              </tr>
              <tr>
                <td className="py-0.5 pr-6 text-gray-500">{t("Shipping")}</td>
                <td className="py-0.5 text-right tabular-nums text-gray-900">{money(po.shipping)}</td>
              </tr>
              <tr className="border-t border-gray-300">
                <td className="py-1 pr-6 font-semibold text-gray-900">{t("Total")}</td>
                <td className="py-1 text-right font-semibold tabular-nums text-gray-900">{money(po.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </PrintSection>

      {po.notes ? (
        <PrintSection title={t("Notes")}>
          <p className="whitespace-pre-wrap text-[11px] text-gray-700">{po.notes}</p>
        </PrintSection>
      ) : null}
    </CaPrintShell>
  );
}
