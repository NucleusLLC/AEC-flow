"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { SaveControl } from "@/components/development/save-control";
import { PermitStatusBadge, RiskBadge } from "@/components/development/badges";
import { PERMIT_TASK_STATUS_LABEL, type PermitTask, type PermitTaskStatus } from "@/lib/data/development.types";
import { formatDate } from "@/lib/format";
import { useDateLocale, useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";

const DONE: PermitTaskStatus[] = ["APPROVED", "DONE"];

export function PermitTracker({ projectId, permits }: { projectId: string; permits: PermitTask[] }) {
  const t = useT();
  const locale = useDateLocale();
  const [tasks, setTasks] = useState(permits);
  const setStatus = (id: string, status: PermitTaskStatus) => setTasks((p) => p.map((x) => (x.id === id ? { ...x, status } : x)));

  const done = tasks.filter((x) => DONE.includes(x.status)).length;
  const progress = tasks.length ? (done / tasks.length) * 100 : 0;
  const today = "2026-06-21";
  const overdue = useMemo(
    () => tasks.filter((x) => !DONE.includes(x.status) && x.dueDate && x.dueDate < today),
    [tasks],
  );

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">{t("Permit / entitlement progress")}</span>
              <span className="font-semibold text-fg">{fmt(t("{done}/{total} approved"), { done, total: tasks.length })}</span>
            </div>
            <ProgressBar value={progress} className="mt-2 w-64" />
          </div>
          <div className="flex items-center gap-3">
            {overdue.length > 0 ? (
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">{fmt(t("{count} overdue"), { count: overdue.length })}</span>
            ) : (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">{t("On track")}</span>
            )}
            <SaveControl url={`/api/development/${projectId}/permits`} build={() => ({ permits: tasks })} label={t("Save")} />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-3 py-2.5 font-medium">{t("Task")}</th>
                <th className="px-3 py-2.5 font-medium">{t("Responsible")}</th>
                <th className="px-3 py-2.5 font-medium">{t("Due")}</th>
                <th className="px-3 py-2.5 font-medium">{t("Risk")}</th>
                <th className="px-3 py-2.5 font-medium">{t("Status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tasks.map((task, i) => {
                const isOverdue = !DONE.includes(task.status) && task.dueDate && task.dueDate < today;
                return (
                  <tr key={task.id} className="even:bg-surface-2/40">
                    <td className="px-4 py-2.5 text-faint">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-fg">{task.name}</div>
                      {task.dependency ? <div className="text-[11px] text-faint">{fmt(t("depends on: {name}"), { name: task.dependency })}</div> : null}
                    </td>
                    <td className="px-3 py-2.5 text-muted">{task.responsible ?? "—"}</td>
                    <td className={`px-3 py-2.5 ${isOverdue ? "font-medium text-red-600" : "text-muted"}`}>{formatDate(task.dueDate, locale)}</td>
                    <td className="px-3 py-2.5"><RiskBadge level={task.riskLevel} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <PermitStatusBadge status={task.status} />
                        <select className="h-7 rounded border border-border bg-surface px-1 text-xs text-muted" value={task.status} onChange={(e) => setStatus(task.id, e.target.value as PermitTaskStatus)}>
                          {(Object.keys(PERMIT_TASK_STATUS_LABEL) as PermitTaskStatus[]).map((s) => <option key={s} value={s}>{t(PERMIT_TASK_STATUS_LABEL[s])}</option>)}
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
