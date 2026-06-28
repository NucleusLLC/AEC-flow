"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ListChecks } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PriorityBadge } from "@/components/ui/badge";
import { PunchStatusBadge } from "@/components/construction-admin/badges";
import type { PunchListItem, PunchStatus } from "@/lib/ca/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const FILTERS: Array<{ key: "ALL" | "OPEN_ANY" | PunchStatus; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "OPEN_ANY", label: "Outstanding" },
  { key: "OPEN", label: "Open" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "COMPLETED", label: "Completed" },
  { key: "VERIFIED", label: "Verified" },
];

/** Open + in-progress are the items still requiring action ("outstanding"). */
const OUTSTANDING: PunchStatus[] = ["OPEN", "IN_PROGRESS"];

const SUMMARY_STATUSES: PunchStatus[] = ["OPEN", "IN_PROGRESS", "COMPLETED", "VERIFIED", "REJECTED"];

export function PunchListView({ items }: { items: PunchListItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | "OPEN_ANY" | PunchStatus>("ALL");
  const [project, setProject] = useState<string>("ALL");

  // Distinct projects present in the data, for the project filter.
  const projects = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of items) map.set(p.projectId, p.projectName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  // Items in the selected project (drives both the summary counts and the table).
  const scoped = useMemo(
    () => (project === "ALL" ? items : items.filter((p) => p.projectId === project)),
    [items, project],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.filter((p) => {
      if (filter === "OPEN_ANY" && !OUTSTANDING.includes(p.status)) return false;
      if (filter !== "ALL" && filter !== "OPEN_ANY" && p.status !== filter) return false;
      if (!q) return true;
      return [p.itemNumber, p.description, p.projectName, p.location ?? "", p.trade ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [scoped, query, filter]);

  const outstanding = scoped.filter((p) => OUTSTANDING.includes(p.status)).length;
  const statusCounts = useMemo(() => {
    const counts = { OPEN: 0, IN_PROGRESS: 0, COMPLETED: 0, VERIFIED: 0, REJECTED: 0 } as Record<PunchStatus, number>;
    for (const p of scoped) counts[p.status] += 1;
    return counts;
  }, [scoped]);

  return (
    <div className="space-y-4">
      {/* Status summary — at-a-glance counts for the current project scope */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <button
          type="button"
          onClick={() => setFilter("OPEN_ANY")}
          className="rounded-lg border border-border bg-surface p-3 text-left transition-colors hover:border-brand/40 hover:bg-surface-2"
        >
          <div className="text-xs text-muted">Outstanding</div>
          <div className="mt-0.5 text-lg font-semibold tabular-nums text-fg">{outstanding}</div>
        </button>
        {SUMMARY_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className="rounded-lg border border-border bg-surface p-3 text-left transition-colors hover:border-brand/40 hover:bg-surface-2"
          >
            <div className="flex items-center gap-1.5"><PunchStatusBadge status={s} /></div>
            <div className="mt-1.5 text-lg font-semibold tabular-nums text-fg">{statusCounts[s]}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors",
                filter === f.key ? "bg-brand text-brand-fg ring-brand" : "bg-surface text-muted ring-border hover:text-fg",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={project}
            onChange={(e) => setProject(e.target.value)}
            className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            aria-label="Filter by project"
          >
            <option value="ALL">All projects</option>
            {projects.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
              placeholder="Search punch items…"
              className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 sm:w-56"
            />
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-5 py-2.5 font-medium">Item</th>
                <th className="px-3 py-2.5 font-medium">Project</th>
                <th className="px-3 py-2.5 font-medium">Location</th>
                <th className="px-3 py-2.5 font-medium">Trade</th>
                <th className="px-3 py-2.5 font-medium">Priority</th>
                <th className="px-3 py-2.5 font-medium">Due</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((p) => (
                <tr key={p.id} className="group transition-colors even:bg-surface-2/60 hover:bg-surface-2">
                  <td className="px-5 py-3">
                    <Link href={`/construction-admin/punch-list/${p.id}`} className="block">
                      <span className="font-mono text-[11px] text-faint">{p.itemNumber}</span>
                      <span className="mt-0.5 block max-w-sm truncate font-medium text-fg group-hover:text-brand">{p.description}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-muted">{p.projectName}</td>
                  <td className="px-3 py-3 text-muted">{p.location ?? "—"}</td>
                  <td className="px-3 py-3 text-muted">{p.trade ?? "—"}</td>
                  <td className="px-3 py-3"><PriorityBadge priority={p.priority} /></td>
                  <td className="px-3 py-3 text-muted">{formatDate(p.dueDate)}</td>
                  <td className="px-5 py-3"><PunchStatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-faint">
              <ListChecks className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-fg">No punch items match your filters</p>
          </div>
        ) : null}
      </Card>

      <p className="px-1 text-xs text-faint">
        Showing {rows.length} of {scoped.length} items
        {project === "ALL" ? "" : " in this project"} · {outstanding} outstanding
      </p>
    </div>
  );
}
