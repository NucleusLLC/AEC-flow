"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer, FileDown, Maximize2 } from "lucide-react";
import type { LetterheadLogo } from "@/components/print/document-letterhead";
import {
  DISCIPLINE_LABEL,
  computeCpm,
  addDaysIso,
  diffDaysIso,
  durationDays,
  toScheduleDate,
  type ProjectSchedule,
  type ScheduleTask,
  type Discipline,
} from "@/lib/data/schedule";
import { cn } from "@/lib/utils";

const PAPERS: Record<string, [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
  A2: [420, 594],
  A1: [594, 841],
};
const PAPER_KEYS = ["A4", "A3", "A2", "A1"] as const;
type PaperKey = (typeof PAPER_KEYS)[number];
type Orientation = "landscape" | "portrait";

const MM_TO_PX = 96 / 25.4;
const MARGIN_MM = 10;
const LABEL_W = 200;
const ROW_H = 26;
const HEADER_H = 34;
const BAR_H = 15;

const DISCIPLINE_COLOR: Record<Discipline, string> = {
  ARCHITECTURE: "#2563eb",
  STRUCTURAL: "#7c3aed",
  INTERIOR: "#db2777",
  MEP: "#0891b2",
  PROJECT_MANAGEMENT: "#16a34a",
  CONSTRUCTION: "#ea580c",
};
const DISCIPLINES = Object.keys(DISCIPLINE_COLOR) as Discipline[];

export function SchedulePrint({
  schedule,
  generatedAt,
  logo,
}: {
  schedule: ProjectSchedule;
  generatedAt: string;
  logo?: LetterheadLogo;
}) {
  const [paper, setPaper] = useState<PaperKey>("A3");
  const [orient, setOrient] = useState<Orientation>("landscape");
  const [zoom, setZoom] = useState(0.7);
  const previewRef = useRef<HTMLDivElement>(null);

  const [shortMm, longMm] = PAPERS[paper];
  const pageWmm = orient === "landscape" ? longMm : shortMm;
  const pageHmm = orient === "landscape" ? shortMm : longMm;
  const contentWpx = Math.round((pageWmm - MARGIN_MM * 2) * MM_TO_PX);
  const contentHpx = Math.round((pageHmm - MARGIN_MM * 2) * MM_TO_PX);

  function fitWidth() {
    const w = previewRef.current?.clientWidth ?? 0;
    if (w > 0) setZoom(Math.min(1, Math.max(0.2, (w - 56) / contentWpx)));
  }

  // Hierarchy order (parents then children).
  const ordered = useMemo(() => {
    const tops = schedule.tasks.filter(
      (t) => !t.parentId || !schedule.tasks.some((p) => p.id === t.parentId),
    );
    const out: Array<{ task: ScheduleTask; depth: number }> = [];
    for (const t of tops) {
      out.push({ task: t, depth: 0 });
      for (const c of schedule.tasks.filter((x) => x.parentId === t.id))
        out.push({ task: c, depth: 1 });
    }
    return out;
  }, [schedule.tasks]);

  const indexOf = useMemo(() => {
    const m = new Map<string, number>();
    ordered.forEach((o, i) => m.set(o.task.id, i));
    return m;
  }, [ordered]);

  const cpm = useMemo(() => computeCpm(schedule.tasks), [schedule.tasks]);

  const windowStart = addDaysIso(
    schedule.tasks.map((t) => t.start).sort()[0] ?? schedule.start,
    -3,
  );
  const windowEnd = addDaysIso(
    schedule.tasks.map((t) => t.end).sort().slice(-1)[0] ?? schedule.end,
    3,
  );
  const totalDays = Math.max(1, diffDaysIso(windowStart, windowEnd) + 1);

  const timelineW = Math.max(200, contentWpx - LABEL_W);
  const pxPerDay = timelineW / totalDays;
  const x = (iso: string) => diffDaysIso(windowStart, iso) * pxPerDay;
  const rowCenter = (i: number) => i * ROW_H + ROW_H / 2;
  const rowsHeight = ordered.length * ROW_H;

  // Month header bands (plain compute — React Compiler memoizes automatically).
  const months = (() => {
    const ws = toScheduleDate(windowStart);
    const we = toScheduleDate(windowEnd);
    const out: Array<{ label: string; left: number; width: number }> = [];
    let c = new Date(ws.getFullYear(), ws.getMonth(), 1);
    while (c <= we) {
      const next = new Date(c.getFullYear(), c.getMonth() + 1, 1);
      const segStart = c < ws ? ws : c;
      const segEnd = new Date(Math.min(next.getTime() - 86_400_000, we.getTime()));
      const sIso = segStart.toISOString().slice(0, 10);
      const eIso = segEnd.toISOString().slice(0, 10);
      out.push({
        label: c.toLocaleDateString("en-AE", { month: "short", year: "2-digit" }),
        left: diffDaysIso(windowStart, sIso) * pxPerDay,
        width: (diffDaysIso(sIso, eIso) + 1) * pxPerDay,
      });
      c = next;
    }
    return out;
  })();

  const pageStyle = `@page { size: ${pageWmm}mm ${pageHmm}mm; margin: ${MARGIN_MM}mm; }
@media print {
  .no-print { display: none !important; }
  html, body { background: #fff !important; }
  .print-sheet { box-shadow: none !important; margin: 0 !important; zoom: 1 !important; }
  .page-break-guide { display: none !important; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}`;

  // Approx rendered sheet height → estimate page count for the chosen format.
  const approxSheetPx = 96 + HEADER_H + rowsHeight + 52; // title + chart + legend
  const pageCount = Math.max(1, Math.ceil(approxSheetPx / contentHpx));

  return (
    <div className="min-h-screen bg-slate-100">
      <style>{pageStyle}</style>

      {/* Controls (screen only) */}
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-3 shadow-sm">
        <Link
          href={`/schedule`}
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to schedule
        </Link>

        <div className="mx-2 h-5 w-px bg-border" />

        <span className="text-xs font-medium text-muted">Paper</span>
        <div className="inline-flex overflow-hidden rounded-lg border border-border">
          {PAPER_KEYS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPaper(p)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                paper === p ? "bg-brand text-brand-fg" : "bg-surface text-muted hover:text-fg",
              )}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="inline-flex overflow-hidden rounded-lg border border-border">
          {(["landscape", "portrait"] as Orientation[]).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOrient(o)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                orient === o ? "bg-brand text-brand-fg" : "bg-surface text-muted hover:text-fg",
              )}
            >
              {o}
            </button>
          ))}
        </div>

        {/* Preview zoom */}
        <div className="mx-2 h-5 w-px bg-border" />
        <span className="text-xs font-medium text-muted">Zoom</span>
        <div className="inline-flex items-center overflow-hidden rounded-lg border border-border">
          <button
            type="button"
            onClick={fitWidth}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-muted hover:text-fg"
            title="Fit to width"
          >
            <Maximize2 className="h-3.5 w-3.5" /> Fit
          </button>
          {[0.5, 0.75, 1].map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              className={cn(
                "border-l border-border px-2.5 py-1.5 text-xs font-medium transition-colors",
                Math.abs(zoom - z) < 0.001 ? "bg-brand text-brand-fg" : "bg-surface text-muted hover:text-fg",
              )}
            >
              {Math.round(z * 100)}%
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <FileDown className="h-4 w-4" />
          Save as PDF
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
      </div>

      <p className="no-print px-4 pt-3 text-center text-xs text-muted">
        Previewing <strong>{paper} · {orient}</strong> ({pageWmm} × {pageHmm} mm) ·{" "}
        <strong>{pageCount}</strong> page{pageCount === 1 ? "" : "s"} · in the print dialog choose{" "}
        <strong>Save as PDF</strong> (size is preset).
      </p>

      {/* The sheet */}
      <div ref={previewRef} className="flex justify-center overflow-auto p-6 print:p-0">
        <div
          className="print-sheet relative bg-white shadow-lg print:shadow-none"
          style={{ width: contentWpx, padding: 0, zoom }}
        >
          {/* Page-break guides (screen only) */}
          {Array.from({ length: pageCount - 1 }, (_, k) => (
            <div
              key={k}
              className="page-break-guide pointer-events-none absolute left-0 right-0 z-20"
              style={{ top: (k + 1) * contentHpx }}
            >
              <div className="border-t-2 border-dashed border-rose-400/70" />
              <span className="absolute right-0 -top-4 rounded bg-rose-500 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                Page {k + 2}
              </span>
            </div>
          ))}
          {/* Title block */}
          <div className="mb-3 flex items-start justify-between gap-4 border-b border-slate-300 pb-3">
            <div>
              {logo?.dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL, print context
                <img src={logo.dataUrl} alt="" style={{ height: Math.min(logo.size ?? 28, 44) }} className="max-w-[240px] object-contain" />
              ) : (
                <div className="flex h-7 items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-[#1d4ed8] text-xs font-bold text-white">
                    Z
                  </span>
                  <span className="text-sm font-semibold text-slate-900">ZenArch</span>
                </div>
              )}
              <h1 className="mt-2 text-lg font-bold text-slate-900">{schedule.projectName}</h1>
              <p className="text-xs text-slate-500">
                {schedule.projectNumber} · {schedule.client} · PM: {schedule.manager}
              </p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <div className="font-semibold text-slate-700">Project Programme — Gantt</div>
              <div>Generated {generatedAt}</div>
              <div>
                {schedule.tasks.length} tasks · critical path {cpm.projectDays} days
              </div>
            </div>
          </div>

          {/* Gantt */}
          <div className="flex" style={{ width: contentWpx }}>
            {/* Labels */}
            <div className="shrink-0" style={{ width: LABEL_W }}>
              <div
                className="flex items-end border-b border-r border-slate-300 px-2 pb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400"
                style={{ height: HEADER_H }}
              >
                Task
              </div>
              {ordered.map(({ task, depth }, i) => (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-center border-b border-r border-slate-200 px-2",
                    i % 2 === 1 && "bg-slate-50",
                  )}
                  style={{ height: ROW_H, paddingLeft: 8 + depth * 12 }}
                >
                  <span className="flex items-center gap-1 truncate text-[10px] font-medium text-slate-800">
                    {cpm.critical.has(task.id) ? (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                    ) : null}
                    {task.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div className="relative" style={{ width: timelineW, height: HEADER_H + rowsHeight }}>
              {/* Header */}
              <div className="absolute left-0 top-0" style={{ width: timelineW, height: HEADER_H }}>
                {months.map((m, i) => (
                  <div
                    key={i}
                    className="absolute top-0 flex h-full items-center border-l border-slate-300 bg-slate-50 px-1 text-[9px] font-semibold text-slate-600"
                    style={{ left: m.left, width: m.width }}
                  >
                    {m.width > 24 ? m.label : ""}
                  </div>
                ))}
              </div>

              {/* Zebra rows */}
              {ordered.map((_, i) => (
                <div
                  key={`r${i}`}
                  className={cn("absolute border-b border-slate-200", i % 2 === 1 && "bg-slate-50")}
                  style={{ left: 0, top: HEADER_H + i * ROW_H, width: timelineW, height: ROW_H }}
                />
              ))}

              {/* Month gridlines */}
              {months.map((m, i) => (
                <div
                  key={`g${i}`}
                  className="absolute border-l border-slate-200"
                  style={{ left: m.left, top: HEADER_H, height: rowsHeight }}
                />
              ))}

              {/* Dependency arrows */}
              <svg
                className="absolute"
                style={{ left: 0, top: HEADER_H, width: timelineW, height: rowsHeight }}
              >
                <defs>
                  <marker id="pah" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
                    <path d="M0,0 L5,3 L0,6 Z" fill="#94a3b8" />
                  </marker>
                  <marker id="pahc" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
                    <path d="M0,0 L5,3 L0,6 Z" fill="#ef4444" />
                  </marker>
                </defs>
                {schedule.tasks.flatMap((t) =>
                  t.dependsOn.map((depId) => {
                    const pred = schedule.tasks.find((p) => p.id === depId);
                    const ti = indexOf.get(t.id);
                    const pi = indexOf.get(depId);
                    if (!pred || ti === undefined || pi === undefined) return null;
                    const sx = x(pred.start) + durationDays(pred) * pxPerDay;
                    const sy = rowCenter(pi);
                    const tx = x(t.start);
                    const ty = rowCenter(ti);
                    const crit = cpm.critical.has(t.id) && cpm.critical.has(depId);
                    const midX = Math.max(sx + 6, tx - 6);
                    return (
                      <path
                        key={`${depId}-${t.id}`}
                        d={`M${sx},${sy} L${midX},${sy} L${midX},${ty} L${tx - 1},${ty}`}
                        fill="none"
                        stroke={crit ? "#ef4444" : "#94a3b8"}
                        strokeWidth={crit ? 1.4 : 1}
                        markerEnd={`url(#${crit ? "pahc" : "pah"})`}
                      />
                    );
                  }),
                )}
              </svg>

              {/* Bars */}
              {ordered.map(({ task }, i) => {
                const left = x(task.start);
                const width = Math.max(4, durationDays(task) * pxPerDay);
                const color = DISCIPLINE_COLOR[task.discipline];
                const notStarted = task.status === "NOT_STARTED";
                const crit = cpm.critical.has(task.id);
                return (
                  <div
                    key={task.id}
                    className="absolute flex items-center overflow-hidden rounded-sm"
                    style={{
                      left,
                      width,
                      top: HEADER_H + i * ROW_H + (ROW_H - BAR_H) / 2,
                      height: BAR_H,
                      background: notStarted ? "transparent" : `${color}33`,
                      border: crit
                        ? "1.5px solid #ef4444"
                        : notStarted
                          ? `1px dashed ${color}`
                          : `1px solid ${color}77`,
                    }}
                  >
                    {!notStarted ? (
                      <div
                        className="h-full"
                        style={{ width: `${task.progressPct}%`, background: color }}
                      />
                    ) : null}
                    <span
                      className="absolute inset-0 flex items-center justify-center text-[8px] font-semibold"
                      style={{ color: task.progressPct > 45 && !notStarted ? "#fff" : "#334155" }}
                    >
                      {width > 26 ? `${task.progressPct}%` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-300 pt-2 text-[9px] text-slate-500">
            {DISCIPLINES.map((d) => (
              <span key={d} className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: DISCIPLINE_COLOR[d] }} />
                {DISCIPLINE_LABEL[d]}
              </span>
            ))}
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm border border-red-500" /> critical path
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
