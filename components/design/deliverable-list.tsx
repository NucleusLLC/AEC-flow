"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, FileStack } from "lucide-react";
import { DeliverableStatusBadge } from "@/components/design/status-badge";
import {
  DELIVERABLE_STATUSES,
  DELIVERABLE_STATUS_LABEL,
  DELIVERABLE_TYPE_LABEL,
  type DesignDeliverableDTO,
  type DeliverableStatus,
} from "@/lib/design/types";

export function DeliverableList({ items }: { items: DesignDeliverableDTO[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<DeliverableStatus | "ALL">("ALL");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((d) => {
      if (status !== "ALL" && d.status !== status) return false;
      if (!needle) return true;
      return (
        d.number.toLowerCase().includes(needle) ||
        d.title.toLowerCase().includes(needle) ||
        (d.projectName ?? "").toLowerCase().includes(needle)
      );
    });
  }, [items, q, status]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <FileStack className="h-8 w-8 text-faint" />
        <p className="mt-3 text-sm font-medium text-fg">No deliverables yet</p>
        <p className="mt-1 text-sm text-muted">Add a drawing or design document to start the register.</p>
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
            placeholder="Search number, title, project…"
            className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as DeliverableStatus | "ALL")}
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        >
          <option value="ALL">All statuses</option>
          {DELIVERABLE_STATUSES.map((s) => (
            <option key={s} value={s}>{DELIVERABLE_STATUS_LABEL[s]}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/40 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5 font-medium">Number</th>
              <th className="px-4 py-2.5 font-medium">Title</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 text-center font-medium">Rev</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Issued</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/30">
                <td className="px-4 py-2.5">
                  <Link href={`/design/deliverable/${d.id}`} className="font-mono text-xs font-medium text-brand hover:underline">
                    {d.number}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-fg">{d.title}</td>
                <td className="px-4 py-2.5 text-muted">{DELIVERABLE_TYPE_LABEL[d.type]}</td>
                <td className="px-4 py-2.5 text-center font-mono text-xs text-muted">{d.revision}</td>
                <td className="px-4 py-2.5"><DeliverableStatusBadge status={d.status} /></td>
                <td className="px-4 py-2.5 text-muted">{d.issuedDate ?? "—"}</td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
                  No deliverables match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
