"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { ProjectPicker, ProjectCrumb, type ProjectPickerRow } from "@/components/projects/project-picker";
import { EmailButton } from "@/components/email/email-button";
import { ScheduleGantt } from "./schedule-gantt";
import type { ProjectSchedule } from "@/lib/data/schedule";

export function ScheduleApp({
  schedules,
  directory,
}: {
  schedules: ProjectSchedule[];
  directory: Record<string, { location: string; client: string }>;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const rows: ProjectPickerRow[] = useMemo(
    () =>
      schedules.map((s) => ({
        key: s.projectId,
        projectNumber: s.projectNumber,
        projectName: s.projectName,
        location: directory[s.projectNumber]?.location ?? "—",
        client: s.client || directory[s.projectNumber]?.client || "—",
        count: s.tasks.length,
      })),
    [schedules, directory],
  );

  if (!sel)
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <div className="relative">
            <button
              type="button"
              onClick={() => setNewOpen((v) => !v)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
            >
              <Plus className="h-4 w-4" /> New Schedule
            </button>
            {newOpen ? (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setNewOpen(false)} aria-hidden />
                <div className="absolute right-0 z-30 mt-2 max-h-80 w-80 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-lg">
                  <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-faint">
                    Choose a project to schedule
                  </div>
                  {rows.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-muted">No projects available.</div>
                  ) : (
                    rows.map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => { setSel(r.key); setNewOpen(false); }}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-fg transition-colors hover:bg-surface-2"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{r.projectName}</span>
                          <span className="block truncate text-xs text-muted">{r.projectNumber} · {r.client}</span>
                        </span>
                        <span className="shrink-0 text-[11px] text-faint">{r.count} tasks</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
        <ProjectPicker title="Schedule" countLabel="Tasks" rows={rows} onSelect={setSel} />
      </div>
    );

  const selected = schedules.find((s) => s.projectId === sel);
  const row = rows.find((r) => r.key === sel);
  if (!selected || !row) return <ProjectPicker title="Schedule" countLabel="Tasks" rows={rows} onSelect={setSel} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProjectCrumb row={row} onBack={() => setSel(null)} />
        <EmailButton subject={`Programme — ${row.projectName}`} attachment={`${row.projectName} — Schedule.pdf`} />
      </div>
      <ScheduleGantt schedules={[selected]} />
    </div>
  );
}
