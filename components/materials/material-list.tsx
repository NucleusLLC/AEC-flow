"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Boxes } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { MaterialStatusBadge } from "@/components/materials/status-badge";
import {
  MATERIAL_STATUSES,
  MATERIAL_STATUS_LABEL,
  type MaterialSelectionDTO,
  type MaterialSelectionStatus,
} from "@/lib/materials/types";

export function MaterialList({ items }: { items: MaterialSelectionDTO[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<MaterialSelectionStatus | "ALL">("ALL");
  const [category, setCategory] = useState<string>("ALL");

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category))).sort(),
    [items],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((m) => {
      if (status !== "ALL" && m.status !== status) return false;
      if (category !== "ALL" && m.category !== category) return false;
      if (!needle) return true;
      return (
        m.tag.toLowerCase().includes(needle) ||
        m.productName.toLowerCase().includes(needle) ||
        (m.manufacturer ?? "").toLowerCase().includes(needle) ||
        (m.location ?? "").toLowerCase().includes(needle) ||
        (m.projectName ?? "").toLowerCase().includes(needle)
      );
    });
  }, [items, q, status, category]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <Boxes className="h-8 w-8 text-faint" />
        <p className="mt-3 text-sm font-medium text-fg">No selections yet</p>
        <p className="mt-1 text-sm text-muted">Add a material or finish selection to start the schedule.</p>
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
            placeholder="Search tag, product, manufacturer, location…"
            className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        >
          <option value="ALL">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as MaterialSelectionStatus | "ALL")}
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        >
          <option value="ALL">All statuses</option>
          {MATERIAL_STATUSES.map((s) => (
            <option key={s} value={s}>{MATERIAL_STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/40 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5 font-medium">Tag</th>
              <th className="px-4 py-2.5 font-medium">Category</th>
              <th className="px-4 py-2.5 font-medium">Product</th>
              <th className="px-4 py-2.5 font-medium">Location</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/30">
                <td className="px-4 py-2.5">
                  <Link href={`/materials/${m.id}`} className="font-mono text-xs font-medium text-brand hover:underline">
                    {m.tag}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-muted">{m.category}</td>
                <td className="px-4 py-2.5 text-fg">
                  {m.productName}
                  {m.manufacturer ? <span className="text-muted"> · {m.manufacturer}</span> : null}
                </td>
                <td className="px-4 py-2.5 text-muted">{m.location ?? "—"}</td>
                <td className="px-4 py-2.5"><MaterialStatusBadge status={m.status} /></td>
                <td className="px-4 py-2.5 text-right tabular-nums text-fg">
                  {formatCurrency(m.totalCost, m.currency, { maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
                  No selections match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
