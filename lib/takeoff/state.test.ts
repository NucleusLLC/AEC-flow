import { describe, expect, it } from "vitest";
import { calibrationKey, mergeTakeoffRows, sanitiseDrawingTakeoff } from "./state";
import type { TakeoffRow } from "../data/estimates.types";

const condition = { id: "c", name: "Floor", kind: "AREA", colour: "#123456", wastePct: 0 };
const measurement = {
  id: "m",
  conditionId: "c",
  drawingId: "d",
  page: 1,
  createdAt: "2026-10-16T00:00:00Z",
  calibration: null,
  shape: {
    kind: "AREA",
    outer: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
    holes: [],
  },
};

describe("drawing take-off budget state", () => {
  it("accepts valid state and page identities", () => {
    const state = {
      conditions: [condition],
      measurements: [measurement],
      calibrations: { "d:1": { mmPerPoint: 2, reference: "test" } },
    };
    expect(sanitiseDrawingTakeoff(state)).toEqual(state);
    expect(calibrationKey("drawing:revision", 2)).toBe("drawing:revision:2");
  });

  it("tolerates absent or corrupt budget JSON", () => {
    for (const value of [null, undefined, [], 42, { conditions: {}, measurements: "bad", calibrations: [] }]) {
      expect(sanitiseDrawingTakeoff(value)).toEqual({ conditions: [], measurements: [], calibrations: {} });
    }
  });

  it("drops bad conditions, duplicates and their orphaned measurements", () => {
    const conditions = [
      condition,
      condition,
      { ...condition, id: "bad", wastePct: NaN },
      { ...condition, id: "b", kind: "other" },
      { ...condition, id: "h", heightMm: -1 },
      { ...condition, id: "z", depthMm: Infinity },
    ];
    const measurements = [measurement, { ...measurement, id: "x", conditionId: "bad" }];
    expect(sanitiseDrawingTakeoff({ conditions, measurements }).conditions).toEqual([condition]);
    expect(sanitiseDrawingTakeoff({ conditions, measurements }).measurements).toEqual([measurement]);
  });

  it("drops invalid shapes, scales, pages, timestamps and mismatched kinds", () => {
    const invalid = [
      { page: 0 },
      { page: 1.5 },
      { calibration: { mmPerPoint: Infinity, reference: "bad" } },
      { createdAt: "bad" },
      { shape: { ...measurement.shape, outer: [{ x: NaN, y: 0 }] } },
      { shape: { kind: "COUNT", points: [{ x: 0, y: 0 }] } },
      { shape: { kind: "unknown" } },
    ];
    const result = sanitiseDrawingTakeoff({
      conditions: [condition],
      measurements: [
        measurement,
        measurement,
        ...invalid.map((patch, i) => ({ ...measurement, ...patch, id: String(i) })),
      ],
      calibrations: {
        "d:1": { mmPerPoint: -1, reference: "bad" },
        "d:0": { mmPerPoint: 1, reference: "bad" },
      },
    });
    expect(result.measurements).toEqual([measurement]);
    expect(result.calibrations).toEqual({});
  });

  it("replaces drawing rows, retains manual order and does not mutate inputs", () => {
    const row = (id: string) => ({ id } as TakeoffRow);
    const existing = [row("manual-b"), row("to-tk-old"), row("manual-a")];
    const incoming = [row("to-tk-new")];
    expect(mergeTakeoffRows(existing, incoming).map(r => r.id)).toEqual(["manual-b", "manual-a", "to-tk-new"]);
    expect(existing).toHaveLength(3);
    expect(mergeTakeoffRows(existing, [])).toHaveLength(2);
  });
});
