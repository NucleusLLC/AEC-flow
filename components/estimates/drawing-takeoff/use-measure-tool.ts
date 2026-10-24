"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/components/i18n/language-provider";
import { isSimplePolygon, pointInPolygon, type TakeoffShape } from "@/lib/takeoff";
import type { Calibration, Point } from "@/lib/drawings/markup";
import type { DrawingTakeoffState } from "@/lib/takeoff/state";

export type Tool = "select" | "AREA" | "hole" | "LINEAR" | "COUNT" | "calibrate";

type MeasureToolOptions = {
  state: DrawingTakeoffState;
  onChange: (state: DrawingTakeoffState) => void;
  drawingId: string;
  page: number;
  calibration: Calibration | null;
  ready: boolean;
  locked: boolean;
};

/** Drafts stay local; only finished geometry enters the estimate's budget. */
export function useMeasureTool({
  state,
  onChange,
  drawingId,
  page,
  calibration,
  ready,
  locked,
}: MeasureToolOptions) {
  const t = useT();
  const [tool, setTool] = useState<Tool>("select");
  const [active, setActive] = useState(state.conditions[0]?.id ?? "");
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState<Point[]>([]);
  const condition = state.conditions.find(c => c.id === active);
  const pageMeasurements = state.measurements.filter(m => m.drawingId === drawingId && m.page === page);

  function remove(id: string) {
    if (locked) return;
    onChange({
      ...state,
      measurements: state.measurements.filter(m => m.id !== id),
    });
    if (id === selected) setSelected("");
  }

  function add(shape: TakeoffShape) {
    if (!condition || locked) return;
    const measurement = {
      id: crypto.randomUUID(),
      conditionId: condition.id,
      drawingId,
      page,
      shape,
      calibration: calibration ? { ...calibration } : null,
      createdAt: new Date().toISOString(),
    };
    onChange({ ...state, measurements: [...state.measurements, measurement] });
    setSelected(measurement.id);
    setDraft([]);
  }

  // Validate a completed ring before persisting it or attaching it as a hole.
  function finish() {
    if (locked || !condition || !ready) return;
    if (tool === "AREA" || tool === "hole") {
      if (!isSimplePolygon(draft)) {
        toast.error(t("Use a simple polygon with at least three vertices."));
        return;
      }
      if (tool === "AREA") {
        add({ kind: "AREA", outer: draft, holes: [] });
      } else {
        const target = pageMeasurements.find(m => m.id === selected);
        const outer = target?.shape.kind === "AREA" ? target.shape.outer : null;
        if (!target || target.shape.kind !== "AREA" || !outer || !draft.every(p => pointInPolygon(p, outer))) {
          toast.error(t("Cut-out vertices must lie inside the selected area."));
          return;
        }
        const shape = { ...target.shape, holes: [...target.shape.holes, draft] };
        onChange({
          ...state,
          measurements: state.measurements.map(m => m.id === target.id ? { ...m, shape } : m),
        });
        setDraft([]);
      }
    } else if (tool === "LINEAR" && draft.length >= 2) {
      add({ kind: "LINEAR", path: draft });
    }
  }

  function point(p: Point) {
    if (locked || !ready || tool === "select") return;
    if (tool === "calibrate") {
      setDraft(points => points.length >= 2 ? [p] : [...points, p]);
      return;
    }
    if (!condition) {
      toast.error(t("Add or select a condition first."));
      return;
    }
    if (tool === "COUNT" && condition.kind === "COUNT") {
      // One count measurement accumulates clicks for this condition and page.
      const existing = pageMeasurements.find(m => m.conditionId === active && m.shape.kind === "COUNT");
      if (existing && existing.shape.kind === "COUNT") {
        const shape: TakeoffShape = { kind: "COUNT", points: [...existing.shape.points, p] };
        onChange({
          ...state,
          measurements: state.measurements.map(m => m.id === existing.id ? { ...m, shape } : m),
        });
        setSelected(existing.id);
      } else {
        add({ kind: "COUNT", points: [p] });
      }
    } else {
      setDraft(points => [...points, p]);
    }
  }

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const editing = event.target instanceof HTMLElement
        && event.target.closest("input,textarea,select,[contenteditable=true]") !== null;
      if (locked || editing) return;
      if (event.key === "Escape") {
        setDraft([]);
        return;
      }
      if (event.key === "Enter" && draft.length) {
        event.preventDefault();
        finish();
      }
      if (event.key === "Backspace" && draft.length) {
        event.preventDefault();
        setDraft(points => points.slice(0, -1));
      }
      if (event.key === "Delete" && selected) {
        event.preventDefault();
        remove(selected);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  });

  return {
    tool,
    setTool,
    active,
    setActive,
    selected,
    setSelected,
    draft,
    setDraft,
    condition,
    pageMeasurements,
    point,
    finish,
    remove,
  };
}
