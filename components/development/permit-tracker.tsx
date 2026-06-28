"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { SaveControl } from "@/components/development/save-control";
import { PermitStatusBadge, RiskBadge } from "@/components/development/badges";
import { PERMIT_TASK_STATUS_LABEL, type PermitTask, type PermitTaskStatus } from "@/lib/data/development.types";
import { formatDate } from "@/lib/format";

const DONE: PermitTaskStatus[] = ["APPROVED", "DONE"];

export function PermitTracker({ projectId, permits }: { projectId: string; permits: PermitTask[] }) {
  const [tasks, setTasks] = useState(permits);
  const setStatus = (id: string, status: PermitTaskStatus) => setTasks((p) => p.map((t) => (t.id === id ? { ...t, status } : t)));

  const done = tasks.filter((t) => DONE.includes(t.status)).length;
  const progress = tasks.length ? (done / tasks.length) * 100 : 0;
  const today = "2026-06-21";
  const overdue = useMemo(
    () => tasks.filter((t) => !DONE.includes(t.status) && t.dueDate && t.dueDate < today),
    [tasks],
  );

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">Permit / entitlement progress</span>
              <span className="font-semibold text-fg">{done}/{tasks.length} approved</span>
            </div>
            <ProgressBar value={progress} className="mt-2 w-64" />
          </div>
          <div className="flex items-center gap-3">
            {overdue.length > 0 ? (
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">{overdue.length} overdue</span>
            ) : (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">On track</span>
            )}
            <SaveControl url={`/api/development/${projectId}/permits`} build={() => ({ permits: tasks })} label="Save" />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-3 py-2.5 font-medium">Task</th>
                <th className="px-3 py-2.5 font-medium">Responsible</th>
                <th className="px-3 py-2.5 font-medium">Due</th>
                <th className="px-3 py-2.5 font-medium">Risk</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tasks.map((t, i) => {
                const isOverdue = !DONE.includes(t.status) && t.dueDate && t.dueDate < today;
                return (
                  <tr key={t.id} className="even:bg-surface-2/40">
                    <td className="px-4 py-2.5 text-faint">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-fg">{t.name}</div>
                      {t.dependency ? <div className="text-[11px] text-faint">depends on: {t.dependency}</div> : null}
                    </td>
                    <td className="px-3 py-2.5 text-muted">{t.responsible ?? "—"}</td>
                    <td className={`px-3 py-2.5 ${isOverdue ? "font-medium text-red-600" : "text-muted"}`}>{formatDate(t.dueDate)}</td>
                    <td className="px-3 py-2.5"><RiskBadge level={t.riskLevel} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <PermitStatusBadge status={t.status} />
                        <select className="h-7 rounded border border-border bg-surface px-1 text-xs text-muted" value={t.status} onChange={(e) => setStatus(t.id, e.target.value as PermitTaskStatus)}>
                          {(Object.keys(PERMIT_TASK_STATUS_LABEL) as PermitTaskStatus[]).map((s) => <option key={s} value={s}>{PERMIT_TASK_STATUS_LABEL[s]}</option>)}
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
