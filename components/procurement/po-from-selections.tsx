"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackagePlus, AlertTriangle, ShoppingCart } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { materialTotal } from "@/lib/materials/calc";
import type { MaterialSelectionDTO } from "@/lib/materials/types";
import { createPoFromSelectionsAction } from "@/app/(app)/procurement/actions";

export type SupplierGroup = { supplier: string; items: MaterialSelectionDTO[] };

export function PoFromSelections({ groups }: { groups: SupplierGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <ShoppingCart className="h-8 w-8 text-faint" />
        <p className="mt-3 text-sm font-medium text-fg">Nothing to order</p>
        <p className="mt-1 max-w-sm text-sm text-muted">
          Approved material selections that aren&rsquo;t already on a purchase order will appear here,
          grouped by supplier.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((g, i) => (
        <Group key={g.supplier || `nosupplier-${i}`} group={g} />
      ))}
    </div>
  );
}

function Group({ group }: { group: SupplierGroup }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState(group.supplier);
  const [checked, setChecked] = useState<Set<string>>(new Set(group.items.map((i) => i.id)));

  const currency = group.items[0]?.currency ?? "USD";
  const money = (n: number) => formatCurrency(n, currency, { maximumFractionDigits: 2 });

  const selectedTotal = useMemo(
    () =>
      group.items
        .filter((i) => checked.has(i.id))
        .reduce((sum, i) => sum + materialTotal({ quantity: i.quantity, unitCost: i.unitCost }), 0),
    [group.items, checked],
  );

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function create() {
    setError(null);
    const selectionIds = group.items.filter((i) => checked.has(i.id)).map((i) => i.id);
    start(async () => {
      const res = await createPoFromSelectionsAction({ selectionIds, vendorName });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/procurement/${res.id}`);
      router.refresh();
    });
  }

  const selectedCount = checked.size;

  return (
    <Card>
      <CardHeader
        title={group.supplier || "No supplier assigned"}
        subtitle={`${group.items.length} approved selection${group.items.length === 1 ? "" : "s"}`}
      />
      <CardBody className="space-y-4">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/40 text-left text-xs uppercase tracking-wide text-muted">
                <th className="w-8 px-3 py-2" />
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 text-right font-medium">Unit cost</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {group.items.map((i) => (
                <tr key={i.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={checked.has(i.id)}
                      onChange={() => toggle(i.id)}
                      className="h-4 w-4 accent-[var(--brand,#2563eb)]"
                    />
                  </td>
                  <td className="px-3 py-2 text-fg">
                    {i.productName}
                    {i.manufacturer ? <span className="text-muted"> · {i.manufacturer}</span> : null}
                    <span className="ml-1 font-mono text-[11px] text-faint">{i.tag}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted">
                    {i.quantity}
                    {i.unit ? ` ${i.unit}` : ""}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted">{money(i.unitCost)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-fg">
                    {money(materialTotal({ quantity: i.quantity, unitCost: i.unitCost }))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-[220px]">
            <label className="mb-1 block text-xs font-medium text-muted">Supplier / vendor on the PO</label>
            <input
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Supplier name"
              className="h-9 w-64 rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted">
              {selectedCount} selected · <span className="font-semibold text-fg">{money(selectedTotal)}</span>
            </span>
            <button
              type="button"
              onClick={create}
              disabled={pending || selectedCount === 0 || !vendorName.trim()}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-50"
            >
              <PackagePlus className="h-4 w-4" />
              {pending ? "Creating…" : "Create purchase order"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-2.5 text-sm text-rose-700 dark:text-rose-400">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
