"use client";

/**
 * The drawings area on a discipline register, grouped by project.
 *
 * ─── WHY THIS SITS BESIDE THE DELIVERABLES AND DOES NOT REPLACE THEM ────────
 * A deliverable is what the discipline PROMISED to produce; a drawing is what
 * actually landed, revision by revision. `DesignDeliverable` is unique on its
 * number and so cannot hold two revisions of a sheet — which is why the
 * `Drawing` table exists at all (docs/drawings-intake/02-STORAGE.md). Showing
 * them in one list would merge a schedule with a register and lose both.
 *
 * Grouped by project because an architect asks "what have we got on Kamay 33",
 * never "show me every floor plan in the practice".
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, FileStack, PenLine } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DrawingStatusBadge } from "@/components/drawings/badges";
import { SHEET_TYPE_LABEL, type SheetType } from "@/lib/drawings/sheet-type";
import { formatDate } from "@/lib/format";
import type { Drawing } from "@/lib/data/drawings.types";

export function DisciplineDrawings({ drawings }: { drawings: Drawing[] }) {
  const [collapsed, setCollapsed] = useState<string[]>([]);

  const projects = useMemo(() => {
    const byProject = new Map<string, { id: string; number: string; name: string; sheets: Drawing[] }>();
    for (const d of drawings) {
      if (d.status === "SUPERSEDED") continue;
      const entry =
        byProject.get(d.projectId) ??
        { id: d.projectId, number: d.projectNumber, name: d.projectName, sheets: [] };
      entry.sheets.push(d);
      byProject.set(d.projectId, entry);
    }
    return [...byProject.values()].sort((a, b) => a.number.localeCompare(b.number));
  }, [drawings]);

  if (projects.length === 0) {
    return (
      <Card className="px-5 py-10 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-faint">
          <FileStack className="h-5 w-5" />
        </div>
        <p className="mt-3 text-sm font-medium text-fg">No drawings in this discipline yet.</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Sheets appear here as they are added to a project&apos;s drawing set — this is what has
          landed, as opposed to what the deliverables above say was promised.
        </p>
        <Link
          href="/drawings/intake"
          className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg hover:bg-surface-2"
        >
          Add drawings
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {projects.map((p) => {
        const shut = collapsed.includes(p.id);
        const open = p.sheets.reduce((sum, d) => sum + d.openComments, 0);
        return (
          <Card key={p.id} className="overflow-hidden">
            <button
              type="button"
              onClick={() =>
                setCollapsed((prev) => (shut ? prev.filter((x) => x !== p.id) : [...prev, p.id]))
              }
              className="flex w-full items-center gap-2 border-b border-border px-4 py-2 text-left hover:bg-surface-2"
            >
              {shut ? (
                <ChevronRight className="h-4 w-4 text-faint" />
              ) : (
                <ChevronDown className="h-4 w-4 text-faint" />
              )}
              <span className="font-mono text-[11px] text-faint">{p.number}</span>
              <span className="truncate text-sm font-semibold text-fg">{p.name}</span>
              <span className="ml-auto flex items-center gap-2 text-xs text-faint">
                {open > 0 ? <Badge tone="amber">{open} open</Badge> : null}
                {p.sheets.length} sheet{p.sheets.length === 1 ? "" : "s"}
              </span>
            </button>

            {shut ? null : (
              <ul className="divide-y divide-border">
                {p.sheets.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-2 hover:bg-surface-2">
                    <span className="font-mono text-[11px] text-faint">{d.code}</span>
                    <Link href={`/drawings/${d.id}`} className="min-w-0 flex-1 truncate text-sm text-fg hover:text-brand">
                      {d.title}
                    </Link>
                    {d.sheetType ? (
                      <span className="text-[11px] text-faint">
                        {SHEET_TYPE_LABEL[d.sheetType as SheetType] ?? d.sheetType}
                      </span>
                    ) : null}
                    {d.paperSize ? <span className="text-[11px] text-faint">{d.paperSize}</span> : null}
                    <span className="text-[11px] text-faint">{formatDate(d.uploadedAt)}</span>
                    <Badge tone="neutral">Rev {d.revision}</Badge>
                    <DrawingStatusBadge status={d.status} />
                    <Link
                      href={`/drawings/${d.id}`}
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-border px-2 text-[11px] text-muted hover:bg-surface-2 hover:text-fg"
                    >
                      <PenLine className="h-3 w-3" /> Review
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
