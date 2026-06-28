"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, NotebookPen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MeetingTypeBadge } from "@/components/meetings/badges";
import {
  MEETING_TYPE_LABEL,
  type MeetingListItem,
  type MeetingType,
} from "@/lib/data/meetings.types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPE_FILTERS: Array<{ key: "ALL" | MeetingType; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "CLIENT", label: "Client" },
  { key: "INTERNAL", label: "Internal" },
  { key: "SITE", label: "Site" },
  { key: "AUTHORITY", label: "Authority" },
  { key: "VIRTUAL", label: "Virtual" },
];

export function MeetingsView({ meetings }: { meetings: MeetingListItem[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"ALL" | MeetingType>("ALL");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = meetings.filter((m) => {
      if (type !== "ALL" && m.type !== type) return false;
      if (!q) return true;
      const haystack = [m.title, m.projectName, m.author]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
    return [...filtered].sort((a, b) => b.meetingDate.localeCompare(a.meetingDate));
  }, [meetings, query, type]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setType(f.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition-colors",
                type === f.key
                  ? "bg-slate-800 text-white ring-slate-800"
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
              placeholder="Search minutes…"
              className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 sm:w-56"
            />
          </div>
          <div className="hidden items-center gap-1.5 text-xs text-faint sm:flex">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Newest first
          </div>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/50 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                <th className="px-5 py-2.5">Date</th>
                <th className="px-3 py-2.5">Title</th>
                <th className="px-3 py-2.5">Project</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3 py-2.5">Author</th>
                <th className="px-5 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr
                  key={m.id}
                  className="group border-b border-border transition-colors even:bg-surface-2/60 hover:bg-surface-2/80"
                >
                  <td className="whitespace-nowrap px-5 py-2.5 text-muted">
                    {formatDate(m.meetingDate)}
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/meetings/${m.id}`} className="block">
                      <span className="block max-w-xs truncate font-semibold text-fg group-hover:text-brand">
                        {m.title}
                      </span>
                      {m.location ? (
                        <span className="mt-0.5 block text-[11px] text-faint">{m.location}</span>
                      ) : null}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-muted">{m.projectName}</td>
                  <td className="px-3 py-2.5">
                    <MeetingTypeBadge type={m.type} />
                  </td>
                  <td className="px-3 py-2.5 text-muted">{m.author}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-muted">
                    {m.actionItemsCount > 0 ? (
                      <span>
                        {m.actionItemsCount}
                        {m.openActionsCount > 0 ? (
                          <span className="text-amber-600"> · {m.openActionsCount} open</span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-faint">—</span>
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
              <NotebookPen className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-fg">No minutes match your filters</p>
            <p className="text-xs text-muted">Try a different search term or clear the filters.</p>
          </div>
        ) : null}
      </Card>

      <p className="px-1 text-xs text-faint">
        Showing {rows.length} of {meetings.length} meetings
        {type !== "ALL" ? ` · ${MEETING_TYPE_LABEL[type]}` : ""}
      </p>
    </div>
  );
}
