"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, UsersRound, Mail, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TeamStatusBadge, RoleBadge } from "@/components/team/badges";
import {
  DISCIPLINE_LABEL,
  DEPARTMENT_LABEL,
  type TeamMember,
  type Department,
} from "@/lib/data/team.types";
import { initials, cn } from "@/lib/utils";

type SortKey = "role" | "name" | "utilisation";

const DEPT_FILTERS: Array<{ key: "ALL" | Department; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "DESIGN", label: "Design" },
  { key: "ENGINEERING", label: "Engineering" },
  { key: "MANAGEMENT", label: "Management" },
  { key: "ADMIN", label: "Admin" },
  { key: "FINANCE", label: "Finance" },
];

function utilTone(util: number): string {
  if (util > 100) return "bg-red-500";
  if (util > 85) return "bg-amber-500";
  return "bg-emerald-500";
}

const roleOrder = { DIRECTOR: 0, MANAGER: 1, ADMIN: 2, STAFF: 3, VIEWER: 4 } as const;

export function TeamView({ members }: { members: TeamMember[] }) {
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState<"ALL" | Department>("ALL");
  const [sort, setSort] = useState<SortKey>("role");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = members.filter((m) => {
      if (dept !== "ALL" && m.department !== dept) return false;
      if (!q) return true;
      const haystack = [m.name, m.email, m.role, m.discipline ?? ""]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
    const sorted = [...filtered];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "utilisation") sorted.sort((a, b) => b.utilisation - a.utilisation);
    else
      sorted.sort((a, b) =>
        roleOrder[a.role] !== roleOrder[b.role]
          ? roleOrder[a.role] - roleOrder[b.role]
          : a.name.localeCompare(b.name),
      );
    return sorted;
  }, [members, query, dept, sort]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {DEPT_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setDept(f.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors",
                dept === f.key
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
              placeholder="Search team…"
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
              <option value="role">Role</option>
              <option value="name">Name A–Z</option>
              <option value="utilisation">Utilisation</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cards grid */}
      {rows.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((m) => (
            <Card key={m.id} className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
                  {initials(m.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/team/${m.id}`}
                      className="truncate font-medium text-fg hover:text-brand"
                    >
                      {m.name}
                    </Link>
                    <TeamStatusBadge status={m.status} />
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {m.discipline ? DISCIPLINE_LABEL[m.discipline] : DEPARTMENT_LABEL[m.department]}
                    {m.officeLocation ? ` · ${m.officeLocation}` : ""}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <RoleBadge role={m.role} />
                    <span className="text-[11px] text-faint">
                      {m.activeProjects} active project{m.activeProjects === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Utilisation */}
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="text-muted">Utilisation</span>
                  <span className={cn("font-medium", m.utilisation > 100 ? "text-red-600" : "text-fg")}>
                    {m.utilisation}%{m.utilisation > 100 ? " · over-allocated" : ""}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={cn("h-full rounded-full", utilTone(m.utilisation))}
                    style={{ width: `${Math.min(100, m.utilisation)}%` }}
                  />
                </div>
              </div>

              {/* Contact */}
              <div className="mt-4 flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted">
                <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1.5 hover:text-brand">
                  <Mail className="h-3.5 w-3.5 text-faint" />
                  <span className="truncate">{m.email}</span>
                </a>
                {m.phone ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-faint" />
                    {m.phone}
                  </span>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-faint">
            <UsersRound className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-fg">No team members match your filters</p>
          <p className="text-xs text-muted">Try a different search term or department.</p>
        </Card>
      )}

      <p className="px-1 text-xs text-faint">
        Showing {rows.length} of {members.length} team members
      </p>
    </div>
  );
}
