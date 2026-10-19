"use client";

import {
  centroid,
  measurementQuantity,
  polylineLengthPt,
  type TakeoffCondition,
  type TakeoffMeasurement,
} from "@/lib/takeoff";
import { distancePt, toPdfPoint, toScreenPoint, type PageView, type Point } from "@/lib/drawings/markup";
import { useT } from "@/components/i18n/language-provider";

/** Midpoint by distance along the measured path, including bent polylines. */
function midpoint(path: Point[]): Point {
  let remaining = polylineLengthPt(path) / 2;
  for (let i = 1; i < path.length; i++) {
    const length = distancePt(path[i - 1], path[i]);
    if (remaining <= length && length > 0) {
      const fraction = remaining / length;
      return {
        x: path[i - 1].x + fraction * (path[i].x - path[i - 1].x),
        y: path[i - 1].y + fraction * (path[i].y - path[i - 1].y),
      };
    }
    remaining -= length;
  }
  return path[0];
}

type MeasurementOverlayProps = {
  view: PageView;
  measurements: TakeoffMeasurement[];
  conditions: TakeoffCondition[];
  selected: string;
  draft: Point[];
  colour: string;
  selecting: boolean;
  onPoint: (point: Point) => void;
  onFinish: () => void;
  onSelect: (measurement: TakeoffMeasurement) => void;
};

export function MeasurementOverlay({
  view,
  measurements,
  conditions,
  selected,
  draft,
  colour,
  selecting,
  onPoint,
  onFinish,
  onSelect,
}: MeasurementOverlayProps) {
  const t = useT();
  const screen = (point: Point) => toScreenPoint(point, view);
  const coords = (points: Point[]) => points.map(point => {
    const converted = screen(point);
    return `${converted.x},${converted.y}`;
  }).join(" ");
  const ring = (points: Point[]) => `M ${coords(points)} Z`;

  return (
    <svg
      className="absolute left-0 top-0"
      width={view.widthPx}
      height={view.heightPx}
      onClick={event => {
        if (event.detail > 1) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        onPoint(toPdfPoint(point, view));
      }}
      onDoubleClick={event => {
        event.preventDefault();
        onFinish();
      }}
    >
      {measurements.map(measurement => {
        const condition = conditions.find(c => c.id === measurement.conditionId)!;
        const quantity = measurementQuantity(measurement, condition);
        const shape = measurement.shape;
        const labelPoint = shape.kind === "AREA"
          ? centroid(shape.outer)
          : shape.kind === "LINEAR" ? midpoint(shape.path) : shape.points[0];
        const anchor = screen(labelPoint);
        const label = quantity.qty === null
          ? t("Not to scale")
          : `${quantity.qty.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${quantity.unit}`;

        return (
          <g
            key={measurement.id}
            style={{ cursor: selecting ? "pointer" : "crosshair" }}
            onClick={event => {
              if (selecting) {
                event.stopPropagation();
                onSelect(measurement);
              }
            }}
            stroke={condition.colour}
            strokeWidth={measurement.id === selected ? 4 : 2}
          >
            {shape.kind === "AREA" ? (
              <path
                d={[ring(shape.outer), ...shape.holes.map(ring)].join(" ")}
                fill={condition.colour}
                fillOpacity={0.2}
                fillRule="evenodd"
              />
            ) : shape.kind === "LINEAR" ? (
              <polyline points={coords(shape.path)} fill="none" pointerEvents="stroke" />
            ) : shape.points.map((point, i) => {
              const converted = screen(point);
              return (
                <g key={i}>
                  <circle cx={converted.x} cy={converted.y} r={10} fill={condition.colour} />
                  <text
                    x={converted.x}
                    y={converted.y + 4}
                    textAnchor="middle"
                    fill="white"
                    stroke="none"
                    fontSize={11}
                  >
                    {i + 1}
                  </text>
                </g>
              );
            })}
            {shape.kind !== "COUNT" && (
              <g transform={`translate(${anchor.x},${anchor.y})`} stroke="none">
                <rect x={-65} y={-12} width={130} height={24} rx={4} fill="white" />
                <text textAnchor="middle" y={4} fill={condition.colour} fontSize={12}>{label}</text>
              </g>
            )}
          </g>
        );
      })}
      {draft.length > 0 && (
        <g pointerEvents="none" stroke={colour} strokeWidth={2}>
          <polyline points={coords(draft)} fill="none" strokeDasharray="5 3" />
          {draft.map((point, i) => {
            const converted = screen(point);
            return <circle key={i} cx={converted.x} cy={converted.y} r={4} fill={colour} />;
          })}
        </g>
      )}
    </svg>
  );
}
