import type { Metadata } from "next";
import { listMaterialSelections, materialsSummary } from "@/lib/data/materials";
import { MATERIAL_STATUS_LABEL } from "@/lib/materials/types";
import { formatCurrency } from "@/lib/format";
import { CaPrintShell, PrintSection } from "@/components/construction-admin/print-shell";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Material Schedule")} · ${t("Print")}` };
}

export default async function MaterialSchedulePrintPage() {
  const t = await getServerT();
  const [items, summary] = await Promise.all([listMaterialSelections(), materialsSummary()]);
  const money = (n: number) => formatCurrency(n, summary.currency, { maximumFractionDigits: 2 });

  // Group by category (list is already ordered category → newest).
  const groups = new Map<string, typeof items>();
  for (const m of items) {
    const g = groups.get(m.category) ?? [];
    g.push(m);
    groups.set(m.category, g);
  }

  return (
    <CaPrintShell
      backHref="/materials"
      docTitle={t("Material Schedule")}
      refNumber={
        summary.total === 1
          ? t("1 selection")
          : fmt(t("{count} selections"), { count: summary.total })
      }
      statusLabel={money(summary.selectedValue)}
      title={t("Finish & Product Schedule")}
      meta={[
        { label: t("Selections"), value: String(summary.total) },
        { label: t("Approved+"), value: String(summary.approved) },
        { label: t("Pending"), value: String(summary.pending) },
        { label: t("Selected value"), value: money(summary.selectedValue) },
      ]}
      signatures={[
        { role: t("Prepared by"), name: "" },
        { role: t("Reviewed by"), name: "" },
        { role: t("Approved by (Client)"), name: "" },
      ]}
    >
      {items.length === 0 ? (
        <p className="mt-6 text-[11px] text-gray-500">{t("No selections recorded.")}</p>
      ) : (
        Array.from(groups.entries()).map(([category, rows]) => (
          <PrintSection key={category} title={t(category)}>
            <table className="w-full border-collapse text-[10.5px]">
              <thead>
                <tr className="border-b border-gray-300 text-left text-gray-500">
                  <th className="py-1 pr-2 font-medium">{t("Tag")}</th>
                  <th className="py-1 px-2 font-medium">{t("Product")}</th>
                  <th className="py-1 px-2 font-medium">{t("Manufacturer")}</th>
                  <th className="py-1 px-2 font-medium">{t("Location")}</th>
                  <th className="py-1 px-2 font-medium">{t("Finish")}</th>
                  <th className="py-1 px-2 font-medium">{t("Status")}</th>
                  <th className="py-1 pl-2 text-right font-medium">{t("Cost")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="border-b border-gray-200 align-top">
                    <td className="py-1 pr-2 font-mono text-gray-700">{m.tag}</td>
                    <td className="py-1 px-2 text-gray-900">
                      {m.productName}
                      {m.modelNumber ? <span className="text-gray-500"> · {m.modelNumber}</span> : null}
                    </td>
                    <td className="py-1 px-2 text-gray-700">{m.manufacturer ?? "—"}</td>
                    <td className="py-1 px-2 text-gray-700">{m.location ?? "—"}</td>
                    <td className="py-1 px-2 text-gray-700">{m.finish ?? "—"}</td>
                    <td className="py-1 px-2 text-gray-700">{t(MATERIAL_STATUS_LABEL[m.status])}</td>
                    <td className="py-1 pl-2 text-right tabular-nums text-gray-900">{money(m.totalCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PrintSection>
        ))
      )}
    </CaPrintShell>
  );
}
