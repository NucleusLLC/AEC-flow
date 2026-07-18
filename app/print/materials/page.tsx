import type { Metadata } from "next";
import { listMaterialSelections, materialsSummary } from "@/lib/data/materials";
import { MATERIAL_STATUS_LABEL } from "@/lib/materials/types";
import { formatCurrency } from "@/lib/format";
import { CaPrintShell, PrintSection } from "@/components/construction-admin/print-shell";

export const metadata: Metadata = { title: "Material Schedule · Print" };

export default async function MaterialSchedulePrintPage() {
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
      docTitle="Material Schedule"
      refNumber={`${summary.total} selections`}
      statusLabel={money(summary.selectedValue)}
      title="Finish & Product Schedule"
      meta={[
        { label: "Selections", value: String(summary.total) },
        { label: "Approved+", value: String(summary.approved) },
        { label: "Pending", value: String(summary.pending) },
        { label: "Selected value", value: money(summary.selectedValue) },
      ]}
      signatures={[
        { role: "Prepared by", name: "" },
        { role: "Reviewed by", name: "" },
        { role: "Approved by (Client)", name: "" },
      ]}
    >
      {items.length === 0 ? (
        <p className="mt-6 text-[11px] text-gray-500">No selections recorded.</p>
      ) : (
        Array.from(groups.entries()).map(([category, rows]) => (
          <PrintSection key={category} title={category}>
            <table className="w-full border-collapse text-[10.5px]">
              <thead>
                <tr className="border-b border-gray-300 text-left text-gray-500">
                  <th className="py-1 pr-2 font-medium">Tag</th>
                  <th className="py-1 px-2 font-medium">Product</th>
                  <th className="py-1 px-2 font-medium">Manufacturer</th>
                  <th className="py-1 px-2 font-medium">Location</th>
                  <th className="py-1 px-2 font-medium">Finish</th>
                  <th className="py-1 px-2 font-medium">Status</th>
                  <th className="py-1 pl-2 text-right font-medium">Cost</th>
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
                    <td className="py-1 px-2 text-gray-700">{MATERIAL_STATUS_LABEL[m.status]}</td>
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
