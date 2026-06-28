"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SiteInstructionStatusBadge, DisciplineBadge, ImpactBadge } from "@/components/construction-admin/badges";
import type { SiteInstruction, SiteInstructionStatus } from "@/lib/ca/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const FILTERS: Array<{ key: "ALL" | SiteInstructionStatus; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "ISSUED", label: "Issued" },
  { key: "ACKNOWLEDGED", label: "Acknowledged" },
  { key: "CLOSED", label: "Closed" },
];

export function SiteInstructionLog({ instructions }: { instructions: SiteInstruction[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | SiteInstructionStatus>("ALL");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return instructions.filter((s) => {
      if (status !== "ALL" && s.status !== status) return false;
      if (!q) return true;
      return [s.instructionNumber, s.title, s.projectName, s.issuedTo ?? ""].join(" ").toLowerCase().includes(q);
    });
  }, [instructions, query, status]);

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
            placeholder="Search instructions…"
            className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 sm:w-64"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-5 py-2.5 font-medium">Instruction</th>
                <th className="px-3 py-2.5 font-medium">Project</th>
                <th className="px-3 py-2.5 font-medium">Discipline</th>
                <th className="px-3 py-2.5 font-medium">Cost impact</th>
                <th className="px-3 py-2.5 font-medium">Issued</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((s) => (
                <tr key={s.id} className="group transition-colors even:bg-surface-2/60 hover:bg-surface-2">
                  <td className="px-5 py-3">
                    <Link href={`/construction-admin/site-instructions/${s.id}`} className="block">
                      <span className="font-mono text-[11px] text-faint">{s.instructionNumber}</span>
                      <span className="mt-0.5 block max-w-xs truncate font-medium text-fg group-hover:text-brand">{s.title}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-muted">{s.projectName}</td>
                  <td className="px-3 py-3"><DisciplineBadge discipline={s.discipline} /></td>
                  <td className="px-3 py-3"><ImpactBadge level={s.costImpact} /></td>
                  <td className="px-3 py-3 text-muted">{formatDate(s.dateIssued)}</td>
                  <td className="px-5 py-3"><SiteInstructionStatusBadge status={s.status} /></td>
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
            <p className="text-sm font-medium text-fg">No site instructions match your filters</p>
          </div>
        ) : null}
      </Card>

      <p className="px-1 text-xs text-faint">Showing {rows.length} of {instructions.length} instructions</p>
    </div>
  );
}
