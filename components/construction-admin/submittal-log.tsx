"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, FileCheck2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SubmittalStatusBadge, DisciplineBadge } from "@/components/construction-admin/badges";
import type { Submittal, SubmittalStatus } from "@/lib/ca/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const FILTERS: Array<{ key: "ALL" | SubmittalStatus; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "REQUIRED", label: "Required" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "APPROVED", label: "Approved" },
  { key: "REVISE_AND_RESUBMIT", label: "Revise" },
  { key: "REJECTED", label: "Rejected" },
];

export function SubmittalLog({ submittals }: { submittals: Submittal[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | SubmittalStatus>("ALL");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return submittals.filter((s) => {
      if (status !== "ALL" && s.status !== status) return false;
      if (!q) return true;
      return [s.submittalNumber, s.title, s.projectName, s.submittedBy ?? ""].join(" ").toLowerCase().includes(q);
    });
  }, [submittals, query, status]);

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
            placeholder="Search submittals…"
            className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 sm:w-64"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-5 py-2.5 font-medium">Submittal</th>
                <th className="px-3 py-2.5 font-medium">Project</th>
                <th className="px-3 py-2.5 font-medium">Discipline</th>
                <th className="px-3 py-2.5 font-medium">Required</th>
                <th className="px-3 py-2.5 font-medium">Submitted</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((s) => (
                <tr key={s.id} className="group transition-colors even:bg-surface-2/60 hover:bg-surface-2">
                  <td className="px-5 py-3">
                    <Link href={`/construction-admin/submittals/${s.id}`} className="block">
                      <span className="font-mono text-[11px] text-faint">{s.submittalNumber}</span>
                      <span className="mt-0.5 block max-w-xs truncate font-medium text-fg group-hover:text-brand">{s.title}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-muted">{s.projectName}</td>
                  <td className="px-3 py-3"><DisciplineBadge discipline={s.discipline} /></td>
                  <td className="px-3 py-3 text-muted">{formatDate(s.dateRequired)}</td>
                  <td className="px-3 py-3 text-muted">{formatDate(s.dateSubmitted)}</td>
                  <td className="px-5 py-3"><SubmittalStatusBadge status={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-faint">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-fg">No submittals match your filters</p>
          </div>
        ) : null}
      </Card>

      <p className="px-1 text-xs text-faint">Showing {rows.length} of {submittals.length} submittals</p>
    </div>
  );
}
