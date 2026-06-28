"use client";

import { useMemo, useState } from "react";
import { Search, ArrowLeft, ChevronUp, ChevronDown, ChevronsUpDown, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ProposalsView } from "./proposals-view";
import type { ProposalRecord, ProposalStatus } from "@/lib/data/proposals.types";
import { formatCurrencyCompact } from "@/lib/format";

const OPEN: ProposalStatus[] = ["DRAFT", "SENT", "PENDING", "ON_HOLD"];

type ClientRow = { client: string; count: number; open: number; won: number; currency: string; latest: string };
type SortKey = keyof Pick<ClientRow, "client" | "count" | "open" | "won" | "latest">;

export function ProposalsApp({ proposals }: { proposals: ProposalRecord[] }) {
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "open", dir: -1 });

  const clients = useMemo(() => {
    const acc: Record<string, ClientRow> = {};
    for (const p of proposals) {
      const d = p.sentAt ?? p.createdAt;
      const prev = acc[p.clientName];
      const openAdd = OPEN.includes(p.status) ? p.totalFee : 0;
      const wonAdd = p.status === "APPROVED" ? p.totalFee : 0;
      acc[p.clientName] = prev
        ? { ...prev, count: prev.count + 1, open: prev.open + openAdd, won: prev.won + wonAdd, latest: d > prev.latest ? d : prev.latest }
        : { client: p.clientName, count: 1, open: openAdd, won: wonAdd, currency: p.currency, latest: d };
    }
    return Object.values(acc);
  }, [proposals]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = clients.filter((c) => !term || c.client.toLowerCase().includes(term));
    return [...filtered].sort((a, b) => {
      if (sort.key === "client" || sort.key === "latest") return String(a[sort.key]).localeCompare(String(b[sort.key])) * sort.dir;
      return ((a[sort.key] as number) - (b[sort.key] as number)) * sort.dir;
    });
  }, [clients, q, sort]);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 } : { key, dir: 1 }));

  if (sel) {
    const filtered = proposals.filter((p) => p.clientName === sel);
    const c = clients.find((x) => x.client === sel);
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setSel(null)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg">
            <ArrowLeft className="h-4 w-4" /> All clients
          </button>
          <span className="text-sm text-faint">/</span>
          <span className="text-sm font-semibold text-fg">{sel}</span>
          {c ? <span className="text-xs text-muted">· {c.count} proposals · {formatCurrencyCompact(c.open)} open</span> : null}
        </div>
        <ProposalsView proposals={filtered} />
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-2/50 px-4 py-3">
        <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg">
          <Users className="h-4 w-4 text-brand" /> Proposals by client
          <span className="text-xs font-normal text-faint">· {clients.length} clients</span>
        </div>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client…" className="h-8 w-64 rounded-lg border border-border bg-surface pl-8 pr-3 text-xs text-fg outline-none focus:ring-1 focus:ring-brand/30" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-slate-200">
              <Th label="Client" k="client" sort={sort} onSort={toggleSort} />
              <Th label="Proposals" k="count" sort={sort} onSort={toggleSort} align="right" />
              <Th label="Open Pipeline" k="open" sort={sort} onSort={toggleSort} align="right" />
              <Th label="Won" k="won" sort={sort} onSort={toggleSort} align="right" />
              <Th label="Latest" k="latest" sort={sort} onSort={toggleSort} align="center" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.client} onClick={() => setSel(c.client)} className="cursor-pointer border-b border-border/70 odd:bg-white even:bg-slate-50 hover:bg-brand/5">
                <td className="px-3 py-2 text-xs font-medium text-fg">{c.client}</td>
                <td className="px-3 py-2 text-right text-xs tabular-nums text-muted">{c.count}</td>
                <td className="px-3 py-2 text-right text-xs font-medium tabular-nums text-fg">{c.open > 0 ? formatCurrencyCompact(c.open) : "—"}</td>
                <td className="px-3 py-2 text-right text-xs tabular-nums text-emerald-700">{c.won > 0 ? formatCurrencyCompact(c.won) : "—"}</td>
                <td className="px-3 py-2 text-center text-[11px] tabular-nums text-muted">{c.latest || "—"}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr><td colSpan={5} className="px-3 py-10 text-center text-sm text-muted">No clients match “{q}”.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-4 py-2 text-[11px] text-faint">Click a client to see their proposals. Click a column header to sort.</p>
    </Card>
  );
}

function Th({ label, k, sort, onSort, align }: { label: string; k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void; align?: "right" | "center" }) {
  const a = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const active = sort.key === k;
  return (
    <th className={`cursor-pointer select-none border-b border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 ${a}`} onClick={() => onSort(k)}>
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""}`}>
        {label}
        {active ? (sort.dir === 1 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
      </span>
    </th>
  );
}
