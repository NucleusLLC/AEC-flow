"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, ClipboardList, Link2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/orders/badges";
import {
  ORDER_STATUS_LABEL,
  type OrderListItem,
  type OrderStatus,
} from "@/lib/data/orders.types";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortKey = "recent" | "value" | "start";

const STATUS_FILTERS: Array<{ key: "ALL" | OrderStatus; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
];

export function OrdersView({ orders }: { orders: OrderListItem[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | OrderStatus>("ALL");
  const [sort, setSort] = useState<SortKey>("recent");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = orders.filter((o) => {
      if (status !== "ALL" && o.status !== status) return false;
      if (!q) return true;
      const haystack = [o.orderNumber, o.title, o.clientName, o.serviceType]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
    const sorted = [...filtered];
    if (sort === "value") sorted.sort((a, b) => b.fee - a.fee);
    else if (sort === "start")
      sorted.sort((a, b) => (a.expectedStartDate ?? "9999").localeCompare(b.expectedStartDate ?? "9999"));
    else sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sorted;
  }, [orders, query, status, sort]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatus(f.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors",
                status === f.key
                  ? "bg-brand text-brand-fg ring-brand"
                  : "bg-surface text-muted ring-border hover:text-fg",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
              placeholder="Search orders…"
              className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 sm:w-56"
            />
          </div>
          <div className="relative">
            <SlidersHorizontal className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-9 rounded-lg border border-border bg-surface pl-7 pr-2.5 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            >
              <option value="recent">Most recent</option>
              <option value="value">Fee value</option>
              <option value="start">Start date</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-5 py-2.5 font-medium">Order</th>
                <th className="px-3 py-2.5 font-medium">Client</th>
                <th className="px-3 py-2.5 font-medium">Service</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium text-right">Fee</th>
                <th className="px-5 py-2.5 font-medium">Timeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((o) => (
                <tr key={o.id} className="group transition-colors even:bg-surface-2/60 hover:bg-surface-2">
                  <td className="px-5 py-3">
                    <Link href={`/orders/${o.id}`} className="block">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-faint">{o.orderNumber}</span>
                        {o.proposalRef ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-faint">
                            <Link2 className="h-3 w-3" />
                            {o.proposalRef}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block max-w-xs truncate font-medium text-fg group-hover:text-brand">
                        {o.title}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-muted">{o.clientName}</td>
                  <td className="px-3 py-3 text-muted">{o.serviceType}</td>
                  <td className="px-3 py-3">
                    <OrderStatusBadge status={o.status} />
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-fg">
                    {formatCurrency(o.fee, o.currency)}
                  </td>
                  <td className="px-5 py-3 text-muted">
                    {o.expectedStartDate ? (
                      <span className="whitespace-nowrap text-xs">
                        {formatDate(o.expectedStartDate)} → {formatDate(o.expectedEndDate)}
                      </span>
                    ) : (
                      <span className="text-faint">Not scheduled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-faint">
              <ClipboardList className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-fg">No orders match your filters</p>
            <p className="text-xs text-muted">Try a different search term or clear the filters.</p>
          </div>
        ) : null}
      </Card>

      <p className="px-1 text-xs text-faint">
        Showing {rows.length} of {orders.length} orders
        {status !== "ALL" ? ` · ${ORDER_STATUS_LABEL[status]}` : ""}
      </p>
    </div>
  );
}
