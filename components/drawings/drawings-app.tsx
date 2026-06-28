"use client";

import { useMemo, useState } from "react";
import { ProjectPicker, ProjectCrumb, type ProjectPickerRow } from "@/components/projects/project-picker";
import { DrawingsView } from "./drawings-view";
import type { Drawing } from "@/lib/data/drawings";

export function DrawingsApp({
  drawings,
  directory,
}: {
  drawings: Drawing[];
  directory: Record<string, { location: string; client: string }>;
}) {
  const [sel, setSel] = useState<string | null>(null);

  const rows: ProjectPickerRow[] = useMemo(() => {
    const acc: Record<string, ProjectPickerRow> = {};
    for (const d of drawings) {
      const existing = acc[d.projectId];
      if (existing) acc[d.projectId] = { ...existing, count: existing.count + 1 };
      else
        acc[d.projectId] = {
          key: d.projectId,
          projectNumber: d.projectNumber,
          projectName: d.projectName,
          location: directory[d.projectNumber]?.location ?? "—",
          client: directory[d.projectNumber]?.client ?? "—",
          count: 1,
        };
    }
    return Object.values(acc);
  }, [drawings, directory]);

  if (!sel) return <ProjectPicker title="Drawings" countLabel="Sheets" rows={rows} onSelect={setSel} />;

  const row = rows.find((r) => r.key === sel);
  const filtered = drawings.filter((d) => d.projectId === sel);
  if (!row) return <ProjectPicker title="Drawings" countLabel="Sheets" rows={rows} onSelect={setSel} />;

  return (
    <div className="space-y-4">
      <ProjectCrumb row={row} onBack={() => setSel(null)} />
      <DrawingsView drawings={filtered} />
    </div>
  );
}
