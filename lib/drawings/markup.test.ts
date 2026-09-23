import { describe, expect, it } from "vitest";
import {
  DEFAULT_MARKUP_COLOUR,
  MARKUP_COLOURS,
  MARKUP_KINDS,
  MARKUP_KIND_LABEL,
  arrowHead,
  boundsOf,
  calibrationFrom,
  cloudPath,
  colourForAuthor,
  distancePt,
  formatMeasurement,
  hitTest,
  isValidGeometry,
  normaliseRect,
  pointsToPixels,
  simplifyStroke,
  toPdfPoint,
  toScreenPoint,
  type MarkupGeometry,
  type PageView,
} from "./markup";

/** An A1 landscape sheet drawn at half size in the browser. */
const view: PageView = { widthPx: 1191.97, heightPx: 841.89, widthPt: 2383.94, heightPt: 1683.78 };

describe("screen and page are different coordinate systems", () => {
  it("flips the Y axis — a browser counts down, a PDF counts up", () => {
    const topLeft = toPdfPoint({ x: 0, y: 0 }, view);
    expect(topLeft.x).toBe(0);
    expect(topLeft.y).toBeCloseTo(view.heightPt, 1);

    const bottomLeft = toPdfPoint({ x: 0, y: view.heightPx }, view);
    expect(bottomLeft.y).toBeCloseTo(0, 1);
  });

  it("round-trips a point through both conversions", () => {
    const original = { x: 317.5, y: 214.25 };
    const back = toScreenPoint(toPdfPoint(original, view), view);
    expect(back.x).toBeCloseTo(original.x, 1);
    expect(back.y).toBeCloseTo(original.y, 1);
  });

  it("is zoom-independent: the same page at 4x lands on the same point", () => {
    const zoomed: PageView = { ...view, widthPx: view.widthPx * 4, heightPx: view.heightPx * 4 };
    const atHalf = toPdfPoint({ x: 500, y: 300 }, view);
    const atFour = toPdfPoint({ x: 2000, y: 1200 }, zoomed);
    expect(atFour.x).toBeCloseTo(atHalf.x, 1);
    expect(atFour.y).toBeCloseTo(atHalf.y, 1);
  });

  it("returns the origin rather than NaN for a page with no size", () => {
    expect(toPdfPoint({ x: 10, y: 10 }, { ...view, widthPx: 0, heightPx: 0 })).toEqual({ x: 0, y: 0 });
    expect(toScreenPoint({ x: 10, y: 10 }, { ...view, widthPt: 0, heightPt: 0 })).toEqual({ x: 0, y: 0 });
  });

  it("scales a stroke width with the page", () => {
    expect(pointsToPixels(2, view)).toBeCloseTo(1, 1); // rendered at half size
    expect(pointsToPixels(2, { ...view, widthPx: view.widthPt })).toBe(2);
  });
});

describe("thinning a freehand stroke", () => {
  it("throws away the points that change nothing", () => {
    const straight = Array.from({ length: 200 }, (_, i) => ({ x: i, y: 0 }));
    const thinned = simplifyStroke(straight);
    expect(thinned).toHaveLength(2);
    expect(thinned[0]).toEqual({ x: 0, y: 0 });
    expect(thinned[1]).toEqual({ x: 199, y: 0 });
  });

  it("keeps the corner of an L", () => {
    const corner = [
      ...Array.from({ length: 50 }, (_, i) => ({ x: i, y: 0 })),
      ...Array.from({ length: 50 }, (_, i) => ({ x: 49, y: i })),
    ];
    const thinned = simplifyStroke(corner);
    expect(thinned.length).toBeGreaterThanOrEqual(3);
    expect(thinned.length).toBeLessThan(corner.length / 5);
    expect(thinned).toContainEqual({ x: 49, y: 0 });
  });

  it("leaves a two-point stroke alone", () => {
    const two = [{ x: 0, y: 0 }, { x: 5, y: 5 }];
    expect(simplifyStroke(two)).toEqual(two);
    expect(simplifyStroke([])).toEqual([]);
  });
});

describe("shapes", () => {
  it("normalises a rectangle dragged in any direction", () => {
    const downRight = normaliseRect({ x: 10, y: 10 }, { x: 40, y: 30 });
    const upLeft = normaliseRect({ x: 40, y: 30 }, { x: 10, y: 10 });
    expect(downRight).toEqual({ x: 10, y: 10, width: 30, height: 20 });
    expect(upLeft).toEqual(downRight);
  });

  it("clouds a rectangle with more scallops as it grows, not bigger ones", () => {
    const small = cloudPath({ x: 0, y: 0, width: 60, height: 40 }, 12);
    const large = cloudPath({ x: 0, y: 0, width: 600, height: 400 }, 12);
    const arcsIn = (path: string) => path.split("A").length - 1;
    expect(arcsIn(large)).toBeGreaterThan(arcsIn(small) * 5);
    expect(small.startsWith("M 0 0")).toBe(true);
    expect(small.trim().endsWith("Z")).toBe(true);
  });

  it("draws no cloud around nothing", () => {
    expect(cloudPath({ x: 0, y: 0, width: 0, height: 40 })).toBe("");
  });

  it("puts the arrow head at the far end, pointing away from the near one", () => {
    const [left, right] = arrowHead({ x: 0, y: 0 }, { x: 100, y: 0 }, 10);
    expect(left.x).toBeLessThan(100);
    expect(right.x).toBeLessThan(100);
    // Symmetric about the line: one barb each side, same distance out.
    expect(left.y).toBeCloseTo(-right.y, 6);
    expect(Math.abs(left.y)).toBeGreaterThan(0);
  });
});

describe("measuring", () => {
  it("derives millimetres per point from a known dimension", () => {
    // A 8 m grid line that is 200 pt long on the sheet.
    expect(calibrationFrom(200, 8000)).toBe(40);
    expect(calibrationFrom(0, 8000)).toBeNull();
    expect(calibrationFrom(200, 0)).toBeNull();
    expect(calibrationFrom(Number.NaN, 10)).toBeNull();
  });

  it("reads in millimetres under a metre and metres above", () => {
    const cal = { mmPerPoint: 40, reference: "8000 mm grid" };
    expect(formatMeasurement(10, cal)).toBe("400 mm");
    expect(formatMeasurement(200, cal)).toBe("8.00 m");
  });

  it("says 'pt' rather than an unlabelled number when nothing was calibrated", () => {
    expect(formatMeasurement(150, null)).toBe("150 pt");
    expect(formatMeasurement(150, { mmPerPoint: 0, reference: "" })).toBe("150 pt");
  });

  it("measures the distance between two points", () => {
    expect(distancePt({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe("what may be stored", () => {
  it("refuses a stroke of one point, and an enormous one", () => {
    expect(isValidGeometry({ kind: "PEN", points: [{ x: 1, y: 1 }] })).toBe(false);
    expect(isValidGeometry({ kind: "PEN", points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] })).toBe(true);
    const huge = Array.from({ length: 4001 }, (_, i) => ({ x: i, y: i }));
    expect(isValidGeometry({ kind: "PEN", points: huge })).toBe(false);
  });

  it("refuses a zero-length line and a zero-area box", () => {
    expect(isValidGeometry({ kind: "LINE", a: { x: 5, y: 5 }, b: { x: 5, y: 5 } })).toBe(false);
    expect(isValidGeometry({ kind: "RECT", a: { x: 5, y: 5 }, b: { x: 5.5, y: 40 } })).toBe(false);
    expect(isValidGeometry({ kind: "RECT", a: { x: 5, y: 5 }, b: { x: 50, y: 40 } })).toBe(true);
  });

  it("refuses infinities and missing pieces", () => {
    expect(isValidGeometry({ kind: "ARROW", a: { x: 0, y: 0 }, b: { x: Number.POSITIVE_INFINITY, y: 0 } })).toBe(false);
    expect(isValidGeometry(null)).toBe(false);
    expect(isValidGeometry({ kind: "TEXT", at: { x: 1, y: 1 }, size: 0 })).toBe(false);
  });
});

describe("hit-testing", () => {
  const rect: MarkupGeometry = { kind: "RECT", a: { x: 100, y: 100 }, b: { x: 300, y: 200 } };

  it("hits the edge of an open shape but not its empty middle", () => {
    expect(hitTest(rect, { x: 100, y: 150 })).toBe(true);
    expect(hitTest(rect, { x: 200, y: 150 })).toBe(false);
  });

  it("hits anywhere inside a filled one", () => {
    const highlight: MarkupGeometry = { kind: "HIGHLIGHT", a: { x: 100, y: 100 }, b: { x: 300, y: 200 } };
    expect(hitTest(highlight, { x: 200, y: 150 })).toBe(true);
  });

  it("hits along a freehand stroke and misses beside it", () => {
    const pen: MarkupGeometry = { kind: "PEN", points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] };
    expect(hitTest(pen, { x: 50, y: 2 })).toBe(true);
    expect(hitTest(pen, { x: 50, y: 40 })).toBe(false);
  });

  it("misses everything well outside the bounds", () => {
    expect(hitTest(rect, { x: 5000, y: 5000 })).toBe(false);
  });
});

describe("bounds", () => {
  it("wraps a freehand stroke", () => {
    const b = boundsOf({ kind: "PEN", points: [{ x: 10, y: 20 }, { x: 60, y: 5 }, { x: 30, y: 90 }] });
    expect(b).toEqual({ x: 10, y: 5, width: 50, height: 85 });
  });
});

describe("who marked it", () => {
  it("gives the same author the same colour every time", () => {
    expect(colourForAuthor("user-1")).toBe(colourForAuthor("user-1"));
    expect(MARKUP_COLOURS).toContain(colourForAuthor("user-1"));
  });

  it("falls back to redline red for an unknown author", () => {
    expect(colourForAuthor(null)).toBe(DEFAULT_MARKUP_COLOUR);
    expect(colourForAuthor("  ")).toBe(DEFAULT_MARKUP_COLOUR);
  });
});

describe("every tool has something to render", () => {
  it("labels every kind", () => {
    for (const k of MARKUP_KINDS) {
      expect(MARKUP_KIND_LABEL[k], k).toBeTruthy();
      expect(MARKUP_KIND_LABEL[k]).not.toBe(k);
    }
  });
});
