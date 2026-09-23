"use client";

/**
 * One project's sheets, grouped by discipline.
 *
 * WHY GROUPED AND NOT FILTERED. On a job you do not ask "show me the
 * structural drawings" — you look down the set and expect architectural, then
 * structural, then MEP, the way a printed set is bound. A filter makes you name
 * what you want before you can see what there is.
 *
 * SUPERSEDED SHEETS ARE HIDDEN BY DEFAULT, not deleted. A superseded revision
 * is the answer to "what did we issue in March", which comes up in exactly the
 * conversations where it matters.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileStack, PenLine } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DrawingStatusBadge, FileTypeChip } from "@/components/drawings/badges";
import { DISCIPLINE_LABEL, type Drawing, type Discipline } from "@/lib/data/drawings.types";
import { SHEET_TYPE_LABEL, type SheetType } from "@/lib/drawings/sheet-type";
import { formatDate } from "@/lib/format";

/** The order a printed set is bound in, not alphabetical. */
const ORDER: Discipline[] = [
  "GENERAL",
  "ARCHITECTURE",
  "INTERIOR",
  "STRUCTURAL",
  "MEP",
  "CIVIL",
  "LANDSCAPE",
  "CONSTRUCTION",
  "PROJECT_MANAGEMENT",
];

export function ProjectDrawingSet({ drawings }: { drawings: Drawing[] }) {
  const [showSuperseded, setShowSuperseded] = useState(false);

  const supersededCount = drawings.filter((d) => d.status === "SUPERSEDED").length;
  const visible = useMemo(
    () => (showSuperseded ? drawings : drawings.filter((d) => d.status !== "SUPERSEDED")),
    [drawings, showSuperseded],
  );

  const groups = useMemo(() => {
    const byDiscipline = new Map<Discipline, Drawing[]>();
    for (const d of visible) {
      const list = byDiscipline.get(d.discipline) ?? [];
      list.push(d);
      byDiscipline.set(d.discipline, list);
    }
    const known = ORDER.filter((k) => byDiscipline.has(k)).map((k) => [k, byDiscipline.get(k)!] as const);
    const rest = [...byDiscipline.entries()].filter(([k]) => !ORDER.includes(k));
    return [...known, ...rest];
  }, [visible]);

  const openTotal = visible.reduce((sum, d) => sum + d.openComments, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted">
          {visible.length} sheet{visible.length === 1 ? "" : "s"}
        </span>
        {openTotal > 0 ? <Badge tone="amber">{openTotal} comments open</Badge> : null}
        {supersededCount > 0 ? (
          <label className="ml-auto flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={showSuperseded}
              onChange={(e) => setShowSuperseded(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Show {supersededCount} superseded
          </label>
        ) : null}
      </div>

      {groups.map(([discipline, sheets]) => (
        <Card key={discipline} className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <h4 className="text-sm font-semibold text-fg">{DISCIPLINE_LABEL[discipline]}</h4>
            <span className="text-xs text-faint">{sheets.length}</span>
          </div>
          <ul className="divide-y divide-border">
            {sheets.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <FileStack className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-faint">{d.code}</span>
                    <Link href={`/drawings/${d.id}`} className="truncate font-medium text-fg hover:text-brand">
                      {d.title}
                    </Link>
                    {d.openComments > 0 ? <Badge tone="amber">{d.openComments} open</Badge> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-faint">
                    {d.sheetType ? <span>{SHEET_TYPE_LABEL[d.sheetType as SheetType] ?? d.sheetType}</span> : null}
                    {d.paperSize ? <span>· {d.paperSize}</span> : null}
                    {d.pageCount && d.pageCount > 1 ? <span>· {d.pageCount} pages</span> : null}
                    <span>· {formatDate(d.uploadedAt)}</span>
                    <span>· {d.uploadedBy}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">Rev {d.revision}</Badge>
                  <DrawingStatusBadge status={d.status} />
                  <FileTypeChip type={d.fileType} />
                  <Link
                    href={`/drawings/${d.id}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-fg transition-colors hover:bg-surface-2"
                  >
                    <PenLine className="h-3.5 w-3.5" /> Review
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
