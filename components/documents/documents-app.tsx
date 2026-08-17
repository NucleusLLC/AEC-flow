"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileStack, Wand2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
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

  // A project picker with nothing in it is a dead end — the same reasoning as
  // `drawings-app.tsx`, which already guards this. Documents are not created by
  // creating a project, though, so the way out is the generator rather than a
  // creatable picker: there is no upload path implemented to point at.
  if (rows.length === 0) {
    return (
      <Card>
        <CardBody className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-faint">
            <FileStack className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium text-fg">No documents yet</p>
            <p className="mt-0.5 text-xs text-muted">
              Generate one from an estimate or a schedule and it is filed here against its project.
            </p>
          </div>
          <Link
            href="/documents/generate"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
          >
            <Wand2 className="h-4 w-4" aria-hidden="true" />
            Generate a document
          </Link>
        </CardBody>
      </Card>
    );
  }

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
