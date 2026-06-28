"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, CalendarDays, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LeaveTypeBadge, LeaveStatusBadge } from "@/components/leave/badges";
import { type LeaveRequest, type LeaveStatus } from "@/lib/data/leave.types";
import { formatDate } from "@/lib/format";
import { initials, cn } from "@/lib/utils";

const STATUS_FILTERS: Array<{ key: "ALL" | LeaveStatus; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

export function LeaveView({ requests }: { requests: LeaveRequest[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | LeaveStatus>("ALL");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((r) => {
      if (status !== "ALL" && r.status !== status) return false;
      if (!q) return true;
      return [r.userName, r.reason ?? ""].join(" ").toLowerCase().includes(q);
    });
  }, [requests, query, status]);

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

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            placeholder="Search by name…"
            className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 sm:w-56"
          />
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-5 py-2.5 font-medium">Member</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 font-medium">Dates</th>
                <th className="px-3 py-2.5 font-medium text-center">Days</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 font-medium">Approver</th>
                <th className="px-3 py-2.5 font-medium text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="transition-colors even:bg-surface-2/60 hover:bg-surface-2">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                        {initials(r.userName)}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-fg">{r.userName}</div>
                        {r.reason ? (
                          <div className="truncate text-xs text-muted">{r.reason}</div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <LeaveTypeBadge type={r.type} />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-xs text-muted">
                    {formatDate(r.startDate)} → {formatDate(r.endDate)}
                  </td>
                  <td className="px-3 py-3 text-center font-medium text-fg">{r.days}</td>
                  <td className="px-3 py-3">
                    <LeaveStatusBadge status={r.status} />
                  </td>
                  <td className="px-5 py-3 text-muted">{r.approvedBy ?? "—"}</td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      href={`/leave/${r.id}/edit`}
                      aria-label={`Edit ${r.userName}'s leave request`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-faint">
              <CalendarDays className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-fg">No leave requests match your filters</p>
          </div>
        ) : null}
      </Card>

      <p className="px-1 text-xs text-faint">
        Showing {rows.length} of {requests.length} requests
      </p>
    </div>
  );
}
