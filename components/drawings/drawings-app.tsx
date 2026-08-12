"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileStack, Upload } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { ProjectPicker, ProjectCrumb, type ProjectPickerRow } from "@/components/projects/project-picker";
import { DrawingsView } from "./drawings-view";
import type { Drawing } from "@/lib/data/drawings.types";

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

  // An empty register used to be impossible — the page was fed invented rows.
  // It is now the ordinary first state, and a project picker with nothing in it
  // is a dead end, so say what to do rather than showing an empty table.
  if (rows.length === 0) {
    return (
      <Card>
        <CardBody className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-faint">
            <FileStack className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium text-fg">No drawings yet</p>
            <p className="mt-0.5 text-xs text-muted">
              Drop a sheet set and the register fills itself in — you confirm what was read.
            </p>
          </div>
          <Link
            href="/drawings/intake"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
          >
            <Upload className="h-4 w-4" />
            Add drawings
          </Link>
        </CardBody>
      </Card>
    );
  }

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
