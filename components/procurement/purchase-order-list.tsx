"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ShoppingCart } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { PoStatusBadge } from "@/components/procurement/status-badge";
import {
  PO_STATUSES,
  PO_STATUS_LABEL,
  type PurchaseOrderDTO,
  type PurchaseOrderStatus,
} from "@/lib/procurement/types";

export function PurchaseOrderList({ orders }: { orders: PurchaseOrderDTO[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<PurchaseOrderStatus | "ALL">("ALL");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== "ALL" && o.status !== status) return false;
      if (!needle) return true;
      return (
        o.poNumber.toLowerCase().includes(needle) ||
        o.vendorName.toLowerCase().includes(needle) ||
        (o.projectName ?? "").toLowerCase().includes(needle)
      );
    });
  }, [orders, q, status]);

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <ShoppingCart className="h-8 w-8 text-faint" />
        <p className="mt-3 text-sm font-medium text-fg">No purchase orders yet</p>
        <p className="mt-1 text-sm text-muted">Create your first PO to start tracking supplier orders.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search PO #, vendor, project…"
            className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as PurchaseOrderStatus | "ALL")}
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        >
          <option value="ALL">All statuses</option>
          {PO_STATUSES.map((s) => (
            <option key={s} value={s}>{PO_STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/40 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5 font-medium">PO #</th>
              <th className="px-4 py-2.5 font-medium">Vendor</th>
              <th className="px-4 py-2.5 font-medium">Project</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Expected</th>
              <th className="px-4 py-2.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/30">
                <td className="px-4 py-2.5">
                  <Link href={`/procurement/${o.id}`} className="font-medium text-brand hover:underline">
                    {o.poNumber}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-fg">{o.vendorName}</td>
                <td className="px-4 py-2.5 text-muted">{o.projectName ?? "—"}</td>
                <td className="px-4 py-2.5"><PoStatusBadge status={o.status} /></td>
                <td className="px-4 py-2.5 text-muted">{o.expectedDate ?? "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-fg">
                  {formatCurrency(o.total, o.currency, { maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
                  No purchase orders match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
