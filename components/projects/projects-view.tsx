"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, FolderKanban, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge, PriorityBadge, Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import {
  DISCIPLINE_LABEL,
  type ProjectListItem,
  type ProjectStatus,
  type Priority,
} from "@/lib/data/projects.types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortKey = "status" | "name" | "progress" | "deadline";

const STATUS_FILTERS: Array<{ key: "ALL" | ProjectStatus; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "ON_HOLD", label: "On hold" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
];

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function ProjectsView({ projects }: { projects: ProjectListItem[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | ProjectStatus>("ALL");
  const [priority, setPriority] = useState<"ALL" | Priority>("ALL");
  const [sort, setSort] = useState<SortKey>("status");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = projects.filter((p) => {
      if (status !== "ALL" && p.status !== status) return false;
      if (priority !== "ALL" && p.priority !== priority) return false;
      if (!q) return true;
      const haystack = [p.name, p.projectNumber, p.clientName, p.manager]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
    const sorted = [...filtered];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "progress") sorted.sort((a, b) => b.progressPct - a.progressPct);
    else if (sort === "deadline")
      sorted.sort((a, b) => (a.targetEndDate ?? "").localeCompare(b.targetEndDate ?? ""));
    return sorted;
  }, [projects, query, status, priority, sort]);

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
              placeholder="Search projects…"
              className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 sm:w-56"
            />
          </div>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as "ALL" | Priority)}
            className="h-9 rounded-lg border border-border bg-surface px-2.5 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          >
            <option value="ALL">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0) + p.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <div className="relative">
            <SlidersHorizontal className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-9 rounded-lg border border-border bg-surface pl-7 pr-2.5 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            >
              <option value="status">Status</option>
              <option value="name">Name A–Z</option>
              <option value="progress">Progress</option>
              <option value="deadline">Deadline</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-5 py-2.5 font-medium">Project</th>
                <th className="px-3 py-2.5 font-medium">Client</th>
                <th className="px-3 py-2.5 font-medium">Manager</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Priority</th>
                <th className="px-3 py-2.5 font-medium">Progress</th>
                <th className="px-5 py-2.5 font-medium text-right">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((p) => (
                <tr key={p.id} className="group transition-colors even:bg-surface-2/60 hover:bg-surface-2">
                  <td className="px-5 py-3">
                    <Link href={`/projects/${p.id}`} className="block">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-faint">{p.projectNumber}</span>
                        {p.disciplines.slice(0, 2).map((d) => (
                          <Badge key={d} tone="slate">
                            {DISCIPLINE_LABEL[d]}
                          </Badge>
                        ))}
                        {p.disciplines.length > 2 ? (
                          <span className="text-[11px] text-faint">+{p.disciplines.length - 2}</span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate font-medium text-fg group-hover:text-brand">
                        {p.name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-muted">{p.clientName}</td>
                  <td className="px-3 py-3 text-muted">{p.manager}</td>
                  <td className="px-3 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-3 py-3">
                    <PriorityBadge priority={p.priority} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={p.progressPct} className="w-24" />
                      <span className="w-8 text-xs text-muted">{p.progressPct}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1",
                        p.isOverdue ? "font-medium text-red-600" : "text-muted",
                      )}
                    >
                      {p.isOverdue ? <AlertTriangle className="h-3.5 w-3.5" /> : null}
                      {formatDate(p.targetEndDate)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-faint">
              <FolderKanban className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-fg">No projects match your filters</p>
            <p className="text-xs text-muted">Try a different search term or clear the filters.</p>
          </div>
        ) : null}
      </Card>

      <p className="px-1 text-xs text-faint">
        Showing {rows.length} of {projects.length} projects
      </p>
    </div>
  );
}
