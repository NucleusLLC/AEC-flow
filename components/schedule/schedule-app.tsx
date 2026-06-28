"use client";

import { useMemo, useState } from "react";
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

  if (!sel) return <ProjectPicker title="Schedule" countLabel="Tasks" rows={rows} onSelect={setSel} />;

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
