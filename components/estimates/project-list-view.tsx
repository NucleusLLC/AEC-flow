"use client";

import { useMemo, useState } from "react";
import { Search, Plus, ChevronUp, ChevronDown, ChevronsUpDown, FileSpreadsheet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { EstimateProject } from "@/lib/data/estimates";

type SortKey = "projectNumber" | "projectName" | "address" | "client" | "date" | "amount";
const nf0 = (n: number) => Math.round(n).toLocaleString("en-US");

const statusTone: Record<EstimateProject["status"], "slate" | "amber" | "green"> = {
  draft: "slate",
  in_review: "amber",
  approved: "green",
};

export function ProjectListView({ projects, onSelect }: { projects: EstimateProject[]; onSelect: (p: EstimateProject) => void }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: -1 });
  const [newOpen, setNewOpen] = useState(false);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = projects.filter(
      (p) => !term || [p.projectNumber, p.projectName, p.address, p.client].some((s) => s.toLowerCase().includes(term)),
    );
    return [...filtered].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sort.dir;
      return String(av).localeCompare(String(bv)) * sort.dir;
    });
  }, [projects, q, sort]);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 } : { key, dir: 1 }));

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-2/50 px-4 py-3">
        <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg">
          <FileSpreadsheet className="h-4 w-4 text-brand" /> Estimates
          <span className="text-xs font-normal text-faint">· {projects.length} projects</span>
        </div>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number, name, address, client…" className="h-8 w-72 rounded-lg border border-border bg-surface pl-8 pr-3 text-xs text-fg outline-none focus:ring-1 focus:ring-brand/30" />
        </div>
        <div className="relative">
          <button type="button" onClick={() => setNewOpen((v) => !v)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-brand-fg hover:bg-brand/90">
            <Plus className="h-4 w-4" /> New estimate
          </button>
          {newOpen ? (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setNewOpen(false)} aria-hidden />
              <div className="absolute right-0 z-30 mt-2 max-h-80 w-80 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-lg">
                <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-faint">
                  Choose a project to estimate
                </div>
                {projects.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-muted">No projects available.</div>
                ) : (
                  projects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { onSelect(p); setNewOpen(false); }}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-fg transition-colors hover:bg-surface-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.projectName}</span>
                        <span className="block truncate text-xs text-muted">{p.projectNumber} · {p.client}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-faint">
              <Th label="Project No." k="projectNumber" sort={sort} onSort={toggleSort} />
              <Th label="Project Name" k="projectName" sort={sort} onSort={toggleSort} />
              <Th label="Address" k="address" sort={sort} onSort={toggleSort} />
              <Th label="Client" k="client" sort={sort} onSort={toggleSort} />
              <Th label="Version" sort={sort} onSort={toggleSort} />
              <Th label="Date" k="date" sort={sort} onSort={toggleSort} align="center" />
              <Th label="Status" sort={sort} onSort={toggleSort} align="center" />
              <Th label="Amount" k="amount" sort={sort} onSort={toggleSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} onClick={() => onSelect(p)} className="cursor-pointer border-b border-border hover:bg-surface-2">
                <td className="px-3 py-2 font-mono text-[11px] text-muted">{p.projectNumber}</td>
                <td className="px-3 py-2 text-xs font-medium text-fg">{p.projectName}</td>
                <td className="px-3 py-2 text-[11px] text-muted">{p.address}</td>
                <td className="px-3 py-2 text-[11px] text-muted">{p.client}</td>
                <td className="px-3 py-2 text-[11px] text-muted">{p.version}</td>
                <td className="px-3 py-2 text-center text-[11px] tabular-nums text-muted">{p.date}</td>
                <td className="px-3 py-2 text-center"><Badge tone={statusTone[p.status]}>{p.status.replace("_", " ")}</Badge></td>
                <td className="px-3 py-2 text-right text-xs font-medium tabular-nums text-fg">{p.currency} {nf0(p.amount)}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted">No projects match “{q}”.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-4 py-2 text-[11px] text-faint">Click a project to open its estimate sheet. Click a column header to sort.</p>
    </Card>
  );
}

function Th({ label, k, sort, onSort, align }: { label: string; k?: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void; align?: "center" | "right" }) {
  const a = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const active = k && sort.key === k;
  return (
    <th className={`border-b border-border px-3 py-2 font-medium text-faint ${a} ${k ? "cursor-pointer select-none hover:text-fg" : ""}`} onClick={k ? () => onSort(k) : undefined}>
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""}`}>
        {label}
        {k ? (active ? (sort.dir === 1 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-40" />) : null}
      </span>
    </th>
  );
}
