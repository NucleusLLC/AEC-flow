"use client";

import { useState } from "react";
import { Plus, Trash2, ListChecks } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSharedState, uid } from "@/components/projects/dashboard/hooks";
import { cn } from "@/lib/utils";

type PunchStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "VERIFIED";
type Priority = "LOW" | "MEDIUM" | "HIGH";
type PunchItem = {
  id: string;
  location: string;
  description: string;
  trade: string;
  priority: Priority;
  status: PunchStatus;
};

const STATUS_LABEL: Record<PunchStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  VERIFIED: "Verified",
};
const PRIORITY_TONE: Record<Priority, "slate" | "amber" | "red"> = { LOW: "slate", MEDIUM: "amber", HIGH: "red" };

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

const FILTERS: Array<{ key: "ALL" | PunchStatus; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "COMPLETED", label: "Completed" },
  { key: "VERIFIED", label: "Verified" },
];

export function PunchBoard({ projectId }: { projectId: string }) {
  const [items, setItems] = useSharedState<PunchItem[]>(`aec.proj.${projectId}.punch`, []);
  const [filter, setFilter] = useState<"ALL" | PunchStatus>("ALL");
  const [form, setForm] = useState({ description: "", location: "", trade: "", priority: "MEDIUM" as Priority });

  const add = () => {
    if (!form.description.trim()) return;
    setItems((p) => [
      ...p,
      { id: uid("punch"), description: form.description.trim(), location: form.location.trim(), trade: form.trade.trim(), priority: form.priority, status: "OPEN" },
    ]);
    setForm({ description: "", location: "", trade: "", priority: "MEDIUM" });
  };

  const rows = items.filter((i) => filter === "ALL" || i.status === filter);
  const counts = (s: PunchStatus) => items.filter((i) => i.status === s).length;

  return (
    <div className="space-y-4">
      {/* Add form */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
          <input className={`${inputCls} sm:col-span-5`} placeholder="Defect / item description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} onKeyDown={(e) => e.key === "Enter" && add()} />
          <input className={`${inputCls} sm:col-span-3`} placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          <input className={`${inputCls} sm:col-span-2`} placeholder="Trade" value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} />
          <select className={`${inputCls} sm:col-span-1`} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Med</option>
            <option value="HIGH">High</option>
          </select>
          <button type="button" onClick={add} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg hover:bg-brand/90 sm:col-span-1">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors",
              filter === f.key ? "bg-brand text-brand-fg ring-brand" : "bg-surface text-muted ring-border hover:text-fg",
            )}
          >
            {f.label}
            {f.key !== "ALL" ? <span className="ml-1 text-[10px] opacity-70">{counts(f.key as PunchStatus)}</span> : null}
          </button>
        ))}
      </div>

      {/* List */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-5 py-2.5 font-medium">Item</th>
                <th className="px-3 py-2.5 font-medium">Location</th>
                <th className="px-3 py-2.5 font-medium">Trade</th>
                <th className="px-3 py-2.5 font-medium">Priority</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((it) => (
                <tr key={it.id} className="even:bg-surface-2/60">
                  <td className="px-5 py-2.5 text-fg">{it.description}</td>
                  <td className="px-3 py-2.5 text-muted">{it.location || "—"}</td>
                  <td className="px-3 py-2.5 text-muted">{it.trade || "—"}</td>
                  <td className="px-3 py-2.5"><Badge tone={PRIORITY_TONE[it.priority]}>{it.priority.toLowerCase()}</Badge></td>
                  <td className="px-3 py-2.5">
                    <select
                      value={it.status}
                      onChange={(e) => setItems((p) => p.map((x) => (x.id === it.id ? { ...x, status: e.target.value as PunchStatus } : x)))}
                      className="h-7 rounded-lg border border-border bg-surface px-2 text-xs text-fg focus:border-brand focus:outline-none"
                    >
                      {(Object.keys(STATUS_LABEL) as PunchStatus[]).map((s) => (
                        <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <button type="button" onClick={() => setItems((p) => p.filter((x) => x.id !== it.id))} className="text-faint hover:text-red-600" aria-label="Delete item">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-faint">
              <ListChecks className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-fg">{items.length === 0 ? "No punch items yet" : "Nothing in this filter"}</p>
            <p className="text-xs text-muted">Add defects and snags above; status updates save automatically.</p>
          </div>
        ) : null}
      </Card>

      <div className="flex flex-wrap gap-4 px-1 text-xs text-faint">
        <span>Open {counts("OPEN")}</span>
        <span>In progress {counts("IN_PROGRESS")}</span>
        <span>Completed {counts("COMPLETED")}</span>
        <span>Verified {counts("VERIFIED")}</span>
        <span>· {items.length} total</span>
      </div>
    </div>
  );
}
