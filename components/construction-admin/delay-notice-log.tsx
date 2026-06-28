"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, TimerOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DelayStatusBadge } from "@/components/construction-admin/badges";
import type { DelayNotice, DelayStatus } from "@/lib/ca/types";
import { cn } from "@/lib/utils";

const FILTERS: Array<{ key: "ALL" | DelayStatus; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "UNDER_REVIEW", label: "Under review" },
  { key: "ACCEPTED", label: "Accepted" },
  { key: "REJECTED", label: "Rejected" },
  { key: "CLOSED", label: "Closed" },
];

export function DelayNoticeLog({ notices }: { notices: DelayNotice[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | DelayStatus>("ALL");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notices.filter((d) => {
      if (status !== "ALL" && d.status !== status) return false;
      if (!q) return true;
      return [d.delayNoticeNumber, d.title, d.projectName, d.responsibleParty ?? ""].join(" ").toLowerCase().includes(q);
    });
  }, [notices, query, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatus(f.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors",
                status === f.key ? "bg-brand text-brand-fg ring-brand" : "bg-surface text-muted ring-border hover:text-fg",
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
            placeholder="Search delay notices…"
            className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 sm:w-64"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-5 py-2.5 font-medium">Delay notice</th>
                <th className="px-3 py-2.5 font-medium">Project</th>
                <th className="px-3 py-2.5 font-medium">Responsible</th>
                <th className="px-3 py-2.5 text-right font-medium">Claimed</th>
                <th className="px-3 py-2.5 text-right font-medium">Approved</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((d) => (
                <tr key={d.id} className="group transition-colors even:bg-surface-2/60 hover:bg-surface-2">
                  <td className="px-5 py-3">
                    <Link href={`/construction-admin/delay-notices/${d.id}`} className="block">
                      <span className="font-mono text-[11px] text-faint">{d.delayNoticeNumber}</span>
                      <span className="mt-0.5 block max-w-xs truncate font-medium text-fg group-hover:text-brand">{d.title}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-muted">{d.projectName}</td>
                  <td className="px-3 py-3 text-muted">{d.responsibleParty ?? "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-muted">{d.claimedDays} d</td>
                  <td className="px-3 py-3 text-right tabular-nums text-fg">{d.approvedDays} d</td>
                  <td className="px-5 py-3"><DelayStatusBadge status={d.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-faint">
              <TimerOff className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-fg">No delay notices match your filters</p>
          </div>
        ) : null}
      </Card>

      <p className="px-1 text-xs text-faint">Showing {rows.length} of {notices.length} delay notices</p>
    </div>
  );
}
