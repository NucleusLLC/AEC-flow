"use client";

import { useMemo, useState } from "react";
import { ProjectPicker, ProjectCrumb, type ProjectPickerRow } from "@/components/projects/project-picker";
import { DocumentsView } from "./documents-view";
import type { DocumentItem } from "@/lib/data/documents";

export function DocumentsApp({
  documents,
  directory,
}: {
  documents: DocumentItem[];
  directory: Record<string, { location: string; client: string }>;
}) {
  const [sel, setSel] = useState<string | null>(null);

  const rows: ProjectPickerRow[] = useMemo(() => {
    const acc: Record<string, ProjectPickerRow> = {};
    for (const d of documents) {
      const pid = d.projectId ?? "—unassigned—";
      const existing = acc[pid];
      if (existing) acc[pid] = { ...existing, count: existing.count + 1 };
      else
        acc[pid] = {
          key: pid,
          projectNumber: d.projectId ?? "—",
          projectName: d.projectName ?? "Unassigned",
          location: d.projectId ? directory[d.projectId]?.location ?? "—" : "—",
          client: d.projectId ? directory[d.projectId]?.client ?? "—" : "—",
          count: 1,
        };
    }
    return Object.values(acc);
  }, [documents, directory]);

  if (!sel) return <ProjectPicker title="Documents" countLabel="Files" rows={rows} onSelect={setSel} />;

  const row = rows.find((r) => r.key === sel);
  const filtered = documents.filter((d) => (d.projectId ?? "—unassigned—") === sel);
  if (!row) return <ProjectPicker title="Documents" countLabel="Files" rows={rows} onSelect={setSel} />;

  return (
    <div className="space-y-4">
      <ProjectCrumb row={row} onBack={() => setSel(null)} />
      <DocumentsView documents={filtered} />
    </div>
  );
}
