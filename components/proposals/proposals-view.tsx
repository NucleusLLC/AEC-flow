"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, FileText, CalendarClock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ProposalStatusBadge } from "@/components/proposals/badges";
import { ProposalPreviewButton } from "@/components/proposals/proposal-preview";
import {
  PROPOSAL_STATUS_LABEL,
  type ProposalRecord,
  type ProposalStatus,
} from "@/lib/data/proposals.types";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type SortKey = "recent" | "value" | "followup";

const STATUS_FILTERS: Array<{ key: "ALL" | ProposalStatus; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "SENT", label: "Sent" },
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "ON_HOLD", label: "On hold" },
  { key: "REJECTED", label: "Rejected" },
];

export function ProposalsView({ proposals }: { proposals: ProposalRecord[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | ProposalStatus>("ALL");
  const [sort, setSort] = useState<SortKey>("recent");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = proposals.filter((p) => {
      if (status !== "ALL" && p.status !== status) return false;
      if (!q) return true;
      const haystack = [p.refNumber, p.title, p.clientName, p.owner]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
    const sorted = [...filtered];
    if (sort === "value") sorted.sort((a, b) => b.totalFee - a.totalFee);
    else if (sort === "followup")
      sorted.sort((a, b) => (a.followUpDate ?? "9999").localeCompare(b.followUpDate ?? "9999"));
    else sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sorted;
  }, [proposals, query, status, sort]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatus(f.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition-colors",
                status === f.key
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
              placeholder="Search proposals…"
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
              <option value="followup">Follow-up date</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/50 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                <th className="px-5 py-2.5">Proposal</th>
                <th className="px-3 py-2.5">Client</th>
                <th className="px-3 py-2.5">Owner</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Fee</th>
                <th className="px-3 py-2.5">Follow-up</th>
                <th className="px-5 py-2.5 text-right">Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((p) => (
                <tr key={p.id} className="group transition-colors hover:bg-surface-2/70">
                  <td className="px-5 py-2.5">
                    <Link href={`/proposals/${p.id}`} className="block">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-faint">{p.refNumber}</span>
                        {p.revision > 1 ? (
                          <span className="text-[10px] text-faint">rev {p.revision}</span>
                        ) : null}
                      </div>
                      <span className="mt-0.5 block max-w-xs truncate font-semibold text-fg group-hover:text-brand">
                        {p.title}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-muted">{p.clientName}</td>
                  <td className="px-3 py-2.5 text-muted">{p.owner}</td>
                  <td className="px-3 py-2.5">
                    <ProposalStatusBadge status={p.status} />
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-fg">
                    {formatCurrency(p.totalFee, p.currency)}
                  </td>
                  <td className="px-3 py-2.5">
                    {p.followUpDate ? (
                      <span className="inline-flex items-center gap-1 text-muted">
                        <CalendarClock className="h-3.5 w-3.5 text-faint" />
                        {formatDate(p.followUpDate)}
                      </span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="flex justify-end">
                      <ProposalPreviewButton
                        proposal={p}
                        printHref={`/print/proposals/${p.id}`}
                        variant="ghost"
                        iconOnly
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-faint">
              <FileText className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-fg">No proposals match your filters</p>
            <p className="text-xs text-muted">Try a different search term or clear the filters.</p>
          </div>
        ) : null}
      </Card>

      <p className="px-1 text-xs text-faint">
        Showing {rows.length} of {proposals.length} proposals
        {status !== "ALL" ? ` · ${PROPOSAL_STATUS_LABEL[status]}` : ""}
      </p>
    </div>
  );
}
