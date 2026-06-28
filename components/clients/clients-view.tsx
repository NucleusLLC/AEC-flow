"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ClientTypeBadge, ClientStatusBadge } from "@/components/clients/badges";
import {
  CLIENT_TYPE_LABEL,
  type ClientListItem,
  type ClientType,
  type ClientStatus,
} from "@/lib/data/clients.types";
import { formatCurrencyCompact, formatDate } from "@/lib/format";
import { initials, cn } from "@/lib/utils";

type SortKey = "recent" | "name" | "pipeline";

const STATUS_FILTERS: Array<{ key: "ALL" | ClientStatus; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "PROSPECT", label: "Prospects" },
  { key: "INACTIVE", label: "Inactive" },
];

export function ClientsView({ clients }: { clients: ClientListItem[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | ClientStatus>("ALL");
  const [type, setType] = useState<"ALL" | ClientType>("ALL");
  const [sort, setSort] = useState<SortKey>("recent");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = clients.filter((c) => {
      if (status !== "ALL" && c.status !== status) return false;
      if (type !== "ALL" && c.type !== type) return false;
      if (!q) return true;
      const haystack = [c.name, c.companyName, c.contactPerson, c.location, ...c.tags]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
    const sorted = [...filtered];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "pipeline") sorted.sort((a, b) => b.pipelineValue - a.pipelineValue);
    else sorted.sort((a, b) => b.lastActivityDate.localeCompare(a.lastActivityDate));
    return sorted;
  }, [clients, query, status, type, sort]);

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
              placeholder="Search clients…"
              className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 sm:w-56"
            />
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "ALL" | ClientType)}
            className="h-9 rounded-lg border border-border bg-surface px-2.5 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          >
            <option value="ALL">All types</option>
            {(Object.keys(CLIENT_TYPE_LABEL) as ClientType[]).map((t) => (
              <option key={t} value={t}>
                {CLIENT_TYPE_LABEL[t]}
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
              <option value="recent">Recent activity</option>
              <option value="name">Name A–Z</option>
              <option value="pipeline">Pipeline value</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-5 py-2.5 font-medium">Client</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Location</th>
                <th className="px-3 py-2.5 font-medium text-center">Projects</th>
                <th className="px-3 py-2.5 font-medium text-right">Pipeline</th>
                <th className="px-5 py-2.5 font-medium text-right">Last activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((c) => (
                <tr key={c.id} className="group transition-colors hover:bg-surface-2">
                  <td className="px-5 py-3">
                    <Link href={`/clients/${c.id}`} className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-xs font-semibold text-brand">
                        {initials(c.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-fg group-hover:text-brand">
                          {c.name}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {c.companyName ?? c.contactPerson ?? "—"}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <ClientTypeBadge type={c.type} />
                  </td>
                  <td className="px-3 py-3">
                    <ClientStatusBadge status={c.status} />
                  </td>
                  <td className="px-3 py-3 text-muted">{c.location}</td>
                  <td className="px-3 py-3 text-center">
                    <span className="font-medium text-fg">{c.activeProjects}</span>
                    <span className="text-faint"> / {c.projectsCount}</span>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {c.pipelineValue > 0 ? (
                      <span className="font-medium text-fg">{formatCurrencyCompact(c.pipelineValue)}</span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right text-muted">{formatDate(c.lastActivityDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-faint">
              <Building2 className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-fg">No clients match your filters</p>
            <p className="text-xs text-muted">Try a different search term or clear the filters.</p>
          </div>
        ) : null}
      </Card>

      <p className="px-1 text-xs text-faint">
        Showing {rows.length} of {clients.length} clients
      </p>
    </div>
  );
}
