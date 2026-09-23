"use client";

/**
 * The redline layer: an SVG sitting exactly over the rendered page, drawing
 * every stored mark and capturing new ones.
 *
 * ─── IT DRAWS IN SCREEN SPACE AND STORES IN PAGE SPACE ──────────────────────
 * Every geometry that arrives is converted from PDF points to pixels for
 * rendering, and every geometry that leaves is converted back. The conversion
 * is one function each way (`lib/drawings/markup.ts`) and it is the only place
 * the two coordinate systems meet. A mark drawn at 400% zoom lands on the same
 * door at 50%, on another monitor, next month.
 *
 * ─── STROKE WIDTHS ARE IN POINTS TOO ────────────────────────────────────────
 * A 2 pt redline is 2 pt of paper at every zoom level, which means it gets
 * thinner on screen as you zoom out — exactly as it would on a plot. A
 * constant-pixel stroke looks right on one screen and like a marker pen when
 * you zoom out to see the whole sheet.
 *
 * ─── WHY POINTER EVENTS, NOT MOUSE EVENTS ───────────────────────────────────
 * Architects review drawings on tablets with a pen. Pointer events give stylus,
 * touch and mouse from one code path, and `setPointerCapture` keeps a stroke
 * attached to the finger that started it when it leaves the SVG.
 */

import { useRef, useState } from "react";
import {
  arrowHead,
  cloudPath,
  distancePt,
  formatMeasurement,
  normaliseRect,
  pointsToPixels,
  simplifyStroke,
  toPdfPoint,
  toScreenPoint,
  type Calibration,
  type MarkupGeometry,
  type MarkupKind,
  type PageView,
  type Point,
} from "@/lib/drawings/markup";
import type { MarkupDTO } from "@/lib/data/drawing-studio";

export type DraftMarkup = {
  kind: MarkupKind;
  geometry: MarkupGeometry;
  colour: string;
  strokeWidth: number;
  text?: string | null;
};

export type MarkupLayerProps = {
  view: PageView;
  markups: MarkupDTO[];
  /** The tool in hand. `null` is the select/pan tool — the layer ignores drags. */
  tool: MarkupKind | null;
  colour: string;
  strokeWidth: number;
  stamp: string;
  calibration: Calibration | null;
  /** Authors whose marks are hidden, so a reviewer can read their own. */
  hiddenAuthors: string[];
  onCreate: (draft: DraftMarkup) => void;
  /** Clicking an existing mark with the select tool. */
  onSelect?: (markup: MarkupDTO | null) => void;
  selectedId?: string | null;
  /** A click that is not a drag, when the comment tool is in hand. */
  onPinComment?: (at: Point) => void;
  commentMode?: boolean;
  /** Where a calibration drag ended, in points, so the studio can ask "how long is that?" */
  onCalibrate?: (lengthPt: number) => void;
  calibrating?: boolean;
};

type Drag = { from: Point; to: Point; points: Point[] } | null;

export function MarkupLayer({
  view,
  markups,
  tool,
  colour,
  strokeWidth,
  stamp,
  calibration,
  hiddenAuthors,
  onCreate,
  onSelect,
  selectedId,
  onPinComment,
  commentMode,
  onCalibrate,
  calibrating,
}: MarkupLayerProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<Drag>(null);

  const local = (e: React.PointerEvent): Point => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const px = (pt: Point) => toScreenPoint(pt, view);
  const strokePx = Math.max(0.75, pointsToPixels(strokeWidth, view));

  function down(e: React.PointerEvent) {
    const at = local(e);

    if (commentMode) {
      onPinComment?.(toPdfPoint(at, view));
      return;
    }

    if (!tool && !calibrating) {
      // Select: nearest mark whose screen bounds contain the click. Hit-testing
      // happens in screen space so the tolerance is a constant number of
      // pixels — a 4 pt tolerance would be unclickable at 25% zoom.
      const hit = [...markups].reverse().find((m) => withinScreen(m, at, view, 6));
      onSelect?.(hit ?? null);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ from: at, to: at, points: [at] });
  }

  function move(e: React.PointerEvent) {
    if (!drag) return;
    const at = local(e);
    setDrag((d) =>
      d ? { from: d.from, to: at, points: tool === "PEN" ? [...d.points, at] : d.points } : d,
    );
  }

  function up(e: React.PointerEvent) {
    if (!drag) return;
    const at = local(e);
    const from = drag.from;
    setDrag(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Capture is best-effort; a released pointer that was never captured is fine.
    }

    if (calibrating) {
      const lengthPt = distancePt(toPdfPoint(from, view), toPdfPoint(at, view));
      onCalibrate?.(lengthPt);
      return;
    }
    if (!tool) return;

    const a = toPdfPoint(from, view);
    const b = toPdfPoint(at, view);

    // A click, not a drag: the point tools place themselves, the shape tools
    // have nothing to draw and are dropped rather than stored as a dot.
    const isClick = Math.hypot(at.x - from.x, at.y - from.y) < 3;
    const size = 14; // points — a legible annotation on a plotted sheet

    let geometry: MarkupGeometry | null = null;
    switch (tool) {
      case "PEN":
        geometry = {
          kind: "PEN",
          points: simplifyStroke([...drag.points, at].map((p) => toPdfPoint(p, view))),
        };
        break;
      case "TEXT":
        geometry = { kind: "TEXT", at: a, size };
        break;
      case "STAMP":
        geometry = { kind: "STAMP", at: a, size: 20 };
        break;
      case "CALLOUT":
        geometry = isClick ? null : { kind: "CALLOUT", at: b, target: a, size };
        break;
      case "LINE":
      case "ARROW":
      case "MEASURE":
        geometry = isClick ? null : { kind: tool, a, b };
        break;
      case "RECT":
      case "ELLIPSE":
      case "CLOUD":
      case "HIGHLIGHT":
        geometry = isClick ? null : { kind: tool, a, b };
        break;
    }
    if (!geometry) return;

    onCreate({
      kind: tool,
      geometry,
      colour,
      strokeWidth,
      text: tool === "STAMP" ? stamp : null,
    });
  }

  const visible = markups.filter((m) => !hiddenAuthors.includes(m.authorId ?? "unknown"));

  return (
    <svg
      ref={svgRef}
      width={view.widthPx}
      height={view.heightPx}
      viewBox={`0 0 ${view.widthPx} ${view.heightPx}`}
      className="absolute left-0 top-0"
      style={{
        touchAction: tool || calibrating ? "none" : "auto",
        cursor: commentMode ? "crosshair" : tool || calibrating ? "crosshair" : "default",
        pointerEvents: "auto",
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => setDrag(null)}
    >
      {visible.map((m) => (
        <MarkGraphic
          key={m.id}
          geometry={m.geometry}
          colour={m.colour}
          strokeWidthPx={Math.max(0.75, pointsToPixels(m.strokeWidth, view))}
          text={m.text}
          view={view}
          selected={m.id === selectedId}
          calibration={m.mmPerPoint ? { mmPerPoint: m.mmPerPoint, reference: "" } : calibration}
        />
      ))}

      {drag && (tool || calibrating) ? (
        <MarkGraphic
          geometry={previewGeometry(
            calibrating ? "MEASURE" : (tool as MarkupKind),
            drag,
            view,
          )}
          colour={calibrating ? "#0ea5e9" : colour}
          strokeWidthPx={strokePx}
          text={tool === "STAMP" ? stamp : null}
          view={view}
          preview
          calibration={calibration}
        />
      ) : null}
    </svg>
  );

  function previewGeometry(kind: MarkupKind, d: NonNullable<Drag>, v: PageView): MarkupGeometry {
    const a = toPdfPoint(d.from, v);
    const b = toPdfPoint(d.to, v);
    switch (kind) {
      case "PEN":
        return { kind: "PEN", points: d.points.map((p) => toPdfPoint(p, v)) };
      case "TEXT":
        return { kind: "TEXT", at: b, size: 14 };
      case "STAMP":
        return { kind: "STAMP", at: b, size: 20 };
      case "CALLOUT":
        return { kind: "CALLOUT", at: b, target: a, size: 14 };
      default:
        return { kind: kind as "LINE", a, b };
    }
  }

  function withinScreen(m: MarkupDTO, at: Point, v: PageView, tolerance: number): boolean {
    const box = screenBounds(m.geometry, v);
    return (
      at.x >= box.x - tolerance &&
      at.x <= box.x + box.width + tolerance &&
      at.y >= box.y - tolerance &&
      at.y <= box.y + box.height + tolerance
    );
  }

  function screenBounds(g: MarkupGeometry, v: PageView) {
    const pts: Point[] =
      g.kind === "PEN"
        ? g.points
        : g.kind === "TEXT" || g.kind === "STAMP"
          ? [g.at, { x: g.at.x + 100, y: g.at.y - g.size }]
          : g.kind === "CALLOUT"
            ? [g.at, g.target]
            : [g.a, g.b];
    const screen = pts.map((p) => toScreenPoint(p, v));
    const xs = screen.map((p) => p.x);
    const ys = screen.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  }
}

/** One mark, drawn. Pure rendering — it decides nothing. */
function MarkGraphic({
  geometry,
  colour,
  strokeWidthPx,
  text,
  view,
  selected,
  preview,
  calibration,
}: {
  geometry: MarkupGeometry;
  colour: string;
  strokeWidthPx: number;
  text?: string | null;
  view: PageView;
  selected?: boolean;
  preview?: boolean;
  calibration: Calibration | null;
}) {
  const px = (p: Point) => toScreenPoint(p, view);
  const common = {
    stroke: colour,
    strokeWidth: strokeWidthPx,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    opacity: preview ? 0.8 : 1,
  };
  const halo = selected ? { filter: "drop-shadow(0 0 3px rgba(37,99,235,0.9))" } : undefined;

  switch (geometry.kind) {
    case "PEN": {
      const d = geometry.points
        .map((p, i) => {
          const s = px(p);
          return `${i === 0 ? "M" : "L"} ${s.x} ${s.y}`;
        })
        .join(" ");
      return <path d={d} {...common} style={halo} />;
    }
    case "LINE": {
      const a = px(geometry.a);
      const b = px(geometry.b);
      return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...common} style={halo} />;
    }
    case "ARROW": {
      const a = px(geometry.a);
      const b = px(geometry.b);
      const [h1, h2] = arrowHead(a, b, Math.max(8, strokeWidthPx * 4));
      return (
        <g style={halo}>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...common} />
          <polyline points={`${h1.x},${h1.y} ${b.x},${b.y} ${h2.x},${h2.y}`} {...common} />
        </g>
      );
    }
    case "RECT": {
      const r = normaliseRect(px(geometry.a), px(geometry.b));
      return <rect x={r.x} y={r.y} width={r.width} height={r.height} {...common} style={halo} />;
    }
    case "HIGHLIGHT": {
      const r = normaliseRect(px(geometry.a), px(geometry.b));
      // Multiply keeps the drawing readable underneath, the way a real
      // highlighter does. A flat fill hides what it is drawing attention to.
      return (
        <rect
          x={r.x}
          y={r.y}
          width={r.width}
          height={r.height}
          fill={colour}
          opacity={0.25}
          style={{ mixBlendMode: "multiply", ...(halo ?? {}) }}
        />
      );
    }
    case "ELLIPSE": {
      const r = normaliseRect(px(geometry.a), px(geometry.b));
      return (
        <ellipse
          cx={r.x + r.width / 2}
          cy={r.y + r.height / 2}
          rx={r.width / 2}
          ry={r.height / 2}
          {...common}
          style={halo}
        />
      );
    }
    case "CLOUD": {
      const r = normaliseRect(px(geometry.a), px(geometry.b));
      return <path d={cloudPath(r, Math.max(10, strokeWidthPx * 6))} {...common} style={halo} />;
    }
    case "MEASURE": {
      const a = px(geometry.a);
      const b = px(geometry.b);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const label = formatMeasurement(distancePt(geometry.a, geometry.b), calibration);
      return (
        <g style={halo}>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...common} strokeDasharray="6 4" />
          <circle cx={a.x} cy={a.y} r={strokeWidthPx * 1.5} fill={colour} />
          <circle cx={b.x} cy={b.y} r={strokeWidthPx * 1.5} fill={colour} />
          <rect
            x={mid.x - 34}
            y={mid.y - 20}
            width={68}
            height={18}
            rx={4}
            fill="#ffffff"
            stroke={colour}
            strokeWidth={1}
          />
          <text x={mid.x} y={mid.y - 7} textAnchor="middle" fontSize={11} fill={colour}>
            {label}
          </text>
        </g>
      );
    }
    case "TEXT": {
      const at = px(geometry.at);
      const size = Math.max(10, pointsToPixels(geometry.size, view));
      return (
        <text x={at.x} y={at.y} fontSize={size} fill={colour} style={halo}>
          {text ?? ""}
        </text>
      );
    }
    case "CALLOUT": {
      const at = px(geometry.at);
      const target = px(geometry.target);
      const size = Math.max(10, pointsToPixels(geometry.size, view));
      const width = Math.max(60, (text?.length ?? 8) * size * 0.55);
      return (
        <g style={halo}>
          <line x1={at.x} y1={at.y} x2={target.x} y2={target.y} {...common} />
          <circle cx={target.x} cy={target.y} r={Math.max(2, strokeWidthPx)} fill={colour} />
          <rect
            x={at.x}
            y={at.y - size * 1.4}
            width={width}
            height={size * 1.8}
            rx={4}
            fill="#ffffff"
            stroke={colour}
            strokeWidth={strokeWidthPx}
          />
          <text x={at.x + 6} y={at.y + size * 0.15} fontSize={size} fill={colour}>
            {text ?? ""}
          </text>
        </g>
      );
    }
    case "STAMP": {
      const at = px(geometry.at);
      const size = Math.max(12, pointsToPixels(geometry.size, view));
      const label = (text ?? "FOR REVIEW").toUpperCase();
      const width = label.length * size * 0.66 + size;
      return (
        <g style={halo}>
          <rect
            x={at.x}
            y={at.y - size * 1.6}
            width={width}
            height={size * 2}
            rx={3}
            fill="none"
            stroke={colour}
            strokeWidth={Math.max(1.5, strokeWidthPx)}
          />
          <text
            x={at.x + size * 0.5}
            y={at.y}
            fontSize={size}
            fill={colour}
            letterSpacing={size * 0.06}
            fontWeight={700}
          >
            {label}
          </text>
        </g>
      );
    }
  }
}
