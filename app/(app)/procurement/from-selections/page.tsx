import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listMaterialSelections } from "@/lib/data/materials";
import { PoFromSelections, type SupplierGroup } from "@/components/procurement/po-from-selections";

export const metadata: Metadata = { title: "Create PO from selections · AEC-flow" };

export default async function FromSelectionsPage() {
  const orderable = (await listMaterialSelections()).filter(
    (m) => m.status === "APPROVED" && !m.purchaseOrderId,
  );

  // Group by supplier; unassigned supplier sorts last.
  const map = new Map<string, SupplierGroup>();
  for (const m of orderable) {
    const key = m.supplier ?? "";
    const g = map.get(key) ?? { supplier: key, items: [] };
    g.items.push(m);
    map.set(key, g);
  }
  const groups = Array.from(map.values()).sort((a, b) => {
    if (!a.supplier) return 1;
    if (!b.supplier) return -1;
    return a.supplier.localeCompare(b.supplier);
  });

  return (
    <div className="w-full max-w-4xl space-y-6">
      <Link href="/procurement" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        Procurement
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">Create PO from approved selections</h2>
        <p className="text-sm text-muted">
          Approved material selections not yet on a purchase order, grouped by supplier. Pick the
          items and issue a draft PO — the selections are linked and marked ordered.
        </p>
      </div>
      <PoFromSelections groups={groups} />
    </div>
  );
}
