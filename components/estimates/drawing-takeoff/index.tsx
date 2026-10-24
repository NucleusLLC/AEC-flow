"use client";

/**
 * Measurements stay in PDF space so zoom never changes their quantities.
 * The workspace caches each drawing's bytes once because signed URLs expire
 * during a measuring session. Finished geometry rides the estimate budget's
 * existing autosave path, alongside the Quantity Take-Off sheet it feeds.
 */

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";
import { PdfPageCanvas } from "@/components/drawings/studio/pdf-page";
import { bbox, rollupByCondition, toTakeoffRows, type TakeoffMeasurement } from "@/lib/takeoff";
import { calibrationKey, type DrawingTakeoffState } from "@/lib/takeoff/state";
import type { Calibration, PageView } from "@/lib/drawings/markup";
import type { TakeoffRow } from "@/lib/data/estimates.types";
import type { NormSetTask } from "@/lib/data/estimate-presets";
import { Conditions, control } from "./conditions";
import { CalibrationControls } from "./calibration";
import { MeasurementOverlay } from "./overlay";
import { useDrawingSource } from "./use-drawing-source";
import { useMeasureTool, type Tool } from "./use-measure-tool";

type PendingCalibration = {
  drawingId: string;
  page: number;
  value: Calibration;
};

type DrawingTakeoffProps = {
  bytesCache: Map<string, Promise<ArrayBuffer>>;
  projectId: string | null;
  state: DrawingTakeoffState;
  onChange: (state: DrawingTakeoffState) => void;
  onSend: (rows: TakeoffRow[]) => void;
  normSet: NormSetTask[];
  locked: boolean;
};

export function DrawingTakeoff({
  projectId,
  state,
  onChange,
  onSend,
  normSet,
  locked,
  bytesCache,
}: DrawingTakeoffProps) {
  const t = useT();
  const source = useDrawingSource(projectId, bytesCache);
  const { drawingId, page, data, pdfError } = source;
  const [zoom, setZoom] = useState(1);
  const [view, setView] = useState<PageView | null>(null);
  const [pending, setPending] = useState<PendingCalibration | null>(null);
  const [focus, setFocus] = useState<TakeoffMeasurement | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const calibration = state.calibrations[calibrationKey(drawingId, page)] ?? null;
  const totals = rollupByCondition(state.measurements, state.conditions);
  const measure = useMeasureTool({
    state,
    onChange,
    drawingId,
    page,
    calibration,
    ready: !!data && !!view && !pdfError,
    locked,
  });
  const { tool, active, selected, draft, condition, pageMeasurements } = measure;

  function changePage(nextDrawing: string, nextPage: number) {
    source.changePage(nextDrawing, nextPage);
    setView(null);
    measure.setDraft([]);
    measure.setSelected("");
  }

  function select(measurement: TakeoffMeasurement) {
    if (measurement.drawingId !== drawingId || measurement.page !== page) {
      changePage(measurement.drawingId, measurement.page);
    }
    measure.setSelected(measurement.id);
    measure.setActive(measurement.conditionId);
    measure.setTool("select");
    measure.setDraft([]);
    setFocus(measurement);
    const shape = measurement.shape;
    const points = shape.kind === "AREA" ? shape.outer : shape.kind === "LINEAR" ? shape.path : shape.points;
    const box = bbox(points);
    const container = scroller.current;
    if (container) {
      const fitWidth = (container.clientWidth - 80) / Math.max(100, box.width);
      const fitHeight = 500 / Math.max(100, box.height);
      setZoom(Math.min(4, Math.max(0.2, Math.min(fitWidth, fitHeight))));
    }
  }

  function onView(next: PageView) {
    setView(next);
    if (focus && focus.drawingId === drawingId && focus.page === page) {
      const shape = focus.shape;
      const points = shape.kind === "AREA" ? shape.outer : shape.kind === "LINEAR" ? shape.path : shape.points;
      const box = bbox(points);
      const container = scroller.current;
      container?.scrollTo({
        left: (box.x + box.width / 2) * next.widthPx / next.widthPt - container.clientWidth / 2,
        top: (next.heightPt - box.y - box.height / 2) * next.heightPx / next.heightPt - 250,
        behavior: "smooth",
      });
      setFocus(null);
    }
  }

  function fit() {
    if (!view || !scroller.current) return;
    const fitWidth = (scroller.current.clientWidth - 24) / view.widthPt;
    setZoom(Math.max(0.1, Math.min(fitWidth, 560 / view.heightPt)));
  }

  function calibrate(value: Calibration) {
    if (locked) return;
    const key = calibrationKey(drawingId, page);
    onChange({ ...state, calibrations: { ...state.calibrations, [key]: value } });
    measure.setDraft([]);
    // New measurements use this scale immediately; existing snapshots need consent.
    setPending(pageMeasurements.length ? { drawingId, page, value } : null);
  }

  function reapplyCalibration() {
    if (locked || !pending) return;
    // Use the page captured by the prompt, even if the user has since navigated.
    onChange({
      ...state,
      measurements: state.measurements.map(measurement => (
        measurement.drawingId === pending.drawingId && measurement.page === pending.page
          ? { ...measurement, calibration: { ...pending.value } }
          : measurement
      )),
    });
    setPending(null);
  }

  function sendToSheet() {
    const rows = toTakeoffRows(totals, state.conditions);
    onSend(rows);
    toast.success(fmt(t("Updated {count} drawing rows."), { count: rows.length }));
    const skipped = totals
      .filter(total => total.qty === null)
      .map(total => state.conditions.find(c => c.id === total.conditionId)?.name ?? total.conditionId);
    if (skipped.length) {
      toast.warning(fmt(t("Not to scale: {names}"), { names: skipped.join(", ") }));
    }
  }

  if (!projectId) {
    return (
      <p className="p-4 text-sm text-muted">
        {t("Link this estimate to a project to measure on its drawings.")}
      </p>
    );
  }
  if (!source.loaded) return <p role="status">{t("Loading drawings...")}</p>;
  if (source.listError) return <p role="alert">{t("Could not load the project drawings.")}</p>;
  if (!source.drawings.length) {
    return (
      <p className="p-4 text-sm">
        {t("No PDF drawings in this project.")}{" "}
        <Link className="text-brand underline" href={`/projects/${projectId}/drawings`}>
          {t("Open project drawings")}
        </Link>
      </p>
    );
  }

  const tools: [Tool, string][] = [
    ["select", t("Select")],
    ["AREA", t("Area")],
    ["hole", t("Cut-out")],
    ["LINEAR", t("Length")],
    ["COUNT", t("Count")],
    ["calibrate", t("Calibrate")],
  ];
  const selectedArea = pageMeasurements.some(m => m.id === selected && m.shape.kind === "AREA");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs">
          {t("Drawing")}{" "}
          <select className={control} value={drawingId} onChange={e => changePage(e.target.value, 1)}>
            {source.drawings.map(drawing => (
              <option key={drawing.id} value={drawing.id}>
                {drawing.sheetNumber} · {drawing.title} · {drawing.revision}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          {t("Page")}{" "}
          <select className={control} value={page} onChange={e => changePage(drawingId, Number(e.target.value))}>
            {Array.from({ length: source.pageCount }, (_, i) => (
              <option key={i} value={i + 1}>{i + 1}</option>
            ))}
          </select>
        </label>
        <button className={control} aria-label={t("Zoom out")} onClick={() => setZoom(z => Math.max(0.1, z / 1.25))}>
          −
        </button>
        <span className="text-xs">{Math.round(zoom * 100)}%</span>
        <button className={control} aria-label={t("Zoom in")} onClick={() => setZoom(z => Math.min(5, z * 1.25))}>
          +
        </button>
        <button className={control} disabled={!view} onClick={fit}>{t("Fit")}</button>
        <button className={`${control} ml-auto`} disabled={locked} onClick={sendToSheet}>
          {t("Send to sheet")}
        </button>
      </div>
      {!calibration && (
        <p role="status" className="rounded border border-amber-400 bg-amber-50 p-2 text-sm text-amber-900">
          {t("This page is not calibrated. Area and length quantities are not to scale.")}
        </p>
      )}
      {pending && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded border border-border p-2 text-sm">
          {t("Apply the new calibration to existing measurements on this page?")}
          <button className={control} disabled={locked} onClick={reapplyCalibration}>{t("Apply")}</button>
          <button className={control} onClick={() => setPending(null)}>{t("Keep existing scales")}</button>
        </div>
      )}
      <div className="flex flex-col gap-3 lg:flex-row">
        <Conditions
          conditions={state.conditions}
          measurements={state.measurements}
          totals={totals}
          normSet={normSet}
          active={active}
          selected={selected}
          locked={locked}
          onActivate={c => {
            measure.setActive(c.id);
            measure.setTool(c.kind);
            measure.setDraft([]);
          }}
          onChange={c => {
            if (locked) return;
            onChange({
              ...state,
              conditions: state.conditions.some(x => x.id === c.id)
                ? state.conditions.map(x => x.id === c.id ? c : x)
                : [...state.conditions, c],
            });
            measure.setActive(c.id);
            measure.setTool(c.kind);
            measure.setDraft([]);
          }}
          onDelete={id => {
            if (locked) return;
            onChange({
              ...state,
              conditions: state.conditions.filter(c => c.id !== id),
              measurements: state.measurements.filter(m => m.conditionId !== id),
            });
            measure.setDraft([]);
            measure.setSelected("");
          }}
          onSelect={select}
          onRemove={measure.remove}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-1">
            {tools.map(([id, label]) => (
              <button
                key={id}
                className={`${control} ${tool === id ? "ring-2 ring-brand" : ""}`}
                disabled={locked || (id === "hole" && !selectedArea)
                  || (["AREA", "LINEAR", "COUNT"].includes(id) && condition?.kind !== id)}
                onClick={() => {
                  measure.setTool(id);
                  measure.setDraft([]);
                }}
              >
                {label}
              </button>
            ))}
            <button
              className={control}
              disabled={locked || draft.length < 2 || tool === "calibrate"}
              onClick={measure.finish}
            >
              {t("Finish")}
            </button>
            <button className={control} disabled={!draft.length} onClick={() => measure.setDraft([])}>
              {t("Cancel")}
            </button>
          </div>
          <p className="text-xs text-muted">
            {t("Click to measure. Enter or double-click finishes; Esc cancels; Backspace undoes a vertex.")}
          </p>
          <CalibrationControls
            value={calibration}
            points={tool === "calibrate" ? draft : []}
            locked={locked}
            onCalibrate={calibrate}
          />
          <div ref={scroller} className="h-[600px] overflow-auto rounded border border-border bg-muted/10 p-2">
            {pdfError ? (
              <div role="alert" className="space-y-2 p-4 text-sm">
                <p>{t("Could not open this drawing.")}</p>
                <button
                  className={control}
                  onClick={() => {
                    setView(null);
                    source.retry();
                  }}
                >
                  {t("Retry")}
                </button>
              </div>
            ) : (
              <div className="relative w-fit">
                <PdfPageCanvas
                  key={`${drawingId}:${source.attempt}`}
                  data={data}
                  page={page}
                  zoom={zoom}
                  onDocument={info => source.setPageCount(info.pageCount)}
                  onView={onView}
                  onError={source.onPdfError}
                />
                {view && data && (
                  <MeasurementOverlay
                    view={view}
                    measurements={pageMeasurements}
                    conditions={state.conditions}
                    selected={selected}
                    draft={draft}
                    colour={condition?.colour ?? "#2563eb"}
                    selecting={tool === "select"}
                    onPoint={measure.point}
                    onFinish={measure.finish}
                    onSelect={measurement => {
                      measure.setSelected(measurement.id);
                      measure.setActive(measurement.conditionId);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
