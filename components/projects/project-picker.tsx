"use client";

import { useMemo, useState } from "react";
import { Search, ArrowLeft, ChevronUp, ChevronDown, ChevronsUpDown, FolderKanban } from "lucide-react";
import { Card } from "@/components/ui/card";

export type ProjectPickerRow = {
  key: string;
  projectNumber: string;
  projectName: string;
  location: string;
  client: string;
  count: number;
};

type SortKey = "projectNumber" | "projectName" | "location" | "client" | "count";

export function ProjectPicker({
  title,
  countLabel,
  rows,
  onSelect,
}: {
  title: string;
  countLabel: string;
  rows: ProjectPickerRow[];
  onSelect: (key: string) => void;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "projectNumber", dir: 1 });

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = rows.filter(
      (r) => !term || [r.projectNumber, r.projectName, r.location, r.client].some((s) => s.toLowerCase().includes(term)),
    );
    return [...filtered].sort((a, b) => {
      if (sort.key === "count") return (a.count - b.count) * sort.dir;
      return String(a[sort.key]).localeCompare(String(b[sort.key])) * sort.dir;
    });
  }, [rows, q, sort]);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 } : { key, dir: 1 }));

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-2/50 px-4 py-3">
        <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg">
          <FolderKanban className="h-4 w-4 text-brand" /> {title}
          <span className="text-xs font-normal text-faint">· {rows.length} projects</span>
        </div>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number, name, location, client…" className="h-8 w-72 rounded-lg border border-border bg-surface pl-8 pr-3 text-xs text-fg outline-none focus:ring-1 focus:ring-brand/30" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-slate-200">
              <Th label="Project No." k="projectNumber" sort={sort} onSort={toggleSort} />
              <Th label="Project Name" k="projectName" sort={sort} onSort={toggleSort} />
              <Th label="Location" k="location" sort={sort} onSort={toggleSort} />
              <Th label="Client" k="client" sort={sort} onSort={toggleSort} />
              <Th label={countLabel} k="count" sort={sort} onSort={toggleSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.key} onClick={() => onSelect(r.key)} className="cursor-pointer border-b border-border/70 odd:bg-surface even:bg-surface-2 hover:bg-brand/5">
                <td className="px-3 py-2 font-mono text-[11px] text-muted">{r.projectNumber}</td>
                <td className="px-3 py-2 text-xs font-medium text-fg">{r.projectName}</td>
                <td className="px-3 py-2 text-[11px] text-muted">{r.location}</td>
                <td className="px-3 py-2 text-[11px] text-muted">{r.client}</td>
                <td className="px-3 py-2 text-right text-xs tabular-nums text-fg">{r.count}</td>
              </tr>
            ))}
            {!list.length ? (
              <tr><td colSpan={5} className="px-3 py-10 text-center text-sm text-muted">No projects match “{q}”.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-4 py-2 text-[11px] text-faint">Click a project to open its {title.toLowerCase()}. Click a column header to sort.</p>
    </Card>
  );
}

function Th({ label, k, sort, onSort, align }: { label: string; k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void; align?: "right" }) {
  const a = align === "right" ? "text-right" : "text-left";
  const active = sort.key === k;
  return (
    <th className={`cursor-pointer select-none border-b border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 ${a}`} onClick={() => onSort(k)}>
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        {label}
        {active ? (sort.dir === 1 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
      </span>
    </th>
  );
}

export function ProjectCrumb({ row, onBack }: { row: ProjectPickerRow; onBack: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> All projects
      </button>
      <span className="text-sm text-faint">/</span>
      <span className="font-mono text-xs text-faint">{row.projectNumber}</span>
      <span className="text-sm font-semibold text-fg">{row.projectName}</span>
      <span className="text-xs text-muted">· {row.client} · {row.location}</span>
    </div>
  );
}
