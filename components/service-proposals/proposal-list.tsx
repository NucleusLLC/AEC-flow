"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, FileSignature } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { ServiceProposalStatusBadge } from "@/components/service-proposals/status-badge";
import { STATUS_LABEL, type ServiceProposalStatus } from "@/lib/proposals/engine/status";
import type { ServiceProposalListItem } from "@/lib/proposals/dto";

const STATUSES = Object.keys(STATUS_LABEL) as ServiceProposalStatus[];

export function ServiceProposalList({ proposals }: { proposals: ServiceProposalListItem[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ServiceProposalStatus | "ALL">("ALL");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return proposals.filter((p) => {
      if (status !== "ALL" && p.status !== status) return false;
      if (!needle) return true;
      return (
        p.number.toLowerCase().includes(needle) ||
        p.title.toLowerCase().includes(needle) ||
        (p.clientName ?? "").toLowerCase().includes(needle) ||
        (p.projectName ?? "").toLowerCase().includes(needle)
      );
    });
  }, [proposals, q, status]);

  if (proposals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <FileSignature className="h-8 w-8 text-faint" />
        <p className="mt-3 text-sm font-medium text-fg">No service proposals yet</p>
        <p className="mt-1 text-sm text-muted">
          Create your first fee proposal — percentage of construction cost, or a fixed fee.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search number, title, client, project…"
            className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ServiceProposalStatus | "ALL")}
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        >
          <option value="ALL">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/40 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5 font-medium">Number</th>
              <th className="px-4 py-2.5 font-medium">Title</th>
              <th className="px-4 py-2.5 font-medium">Client</th>
              <th className="px-4 py-2.5 font-medium">Basis</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Total fee</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/30">
                <td className="px-4 py-2.5">
                  <Link href={`/design/service-proposals/${p.id}`} className="font-medium text-brand hover:underline">
                    {p.number}
                  </Link>
                  {p.revision > 1 ? <span className="ml-1.5 text-xs text-faint">rev {p.revision}</span> : null}
                </td>
                <td className="px-4 py-2.5 text-fg">{p.title}</td>
                <td className="px-4 py-2.5 text-muted">{p.clientName ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted">{p.feeBasisLabel ?? "Fixed fee"}</td>
                <td className="px-4 py-2.5"><ServiceProposalStatusBadge status={p.status} /></td>
                <td className="px-4 py-2.5 text-right tabular-nums text-fg">
                  {formatCurrency(p.grandTotal, p.currency, { maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">No proposals match your filters.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
