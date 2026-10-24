import { describe, expect, it } from "vitest";
import { bbox, centroid, isSimplePolygon, pointInPolygon, polygonAreaPt2, polygonPerimeterPt, polylineLengthPt } from "./geometry";

const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
const elbow = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 4 }, { x: 0, y: 4 }];

describe("PDF point geometry", () => {
  it("measures either winding and closes only polygon perimeters", () => {
    expect(polygonAreaPt2(square)).toBe(100);
    expect(polygonAreaPt2([...square].reverse())).toBe(100);
    expect(polygonPerimeterPt(square)).toBe(40);
    expect(polylineLengthPt(square)).toBe(30);
    expect(polygonAreaPt2(elbow)).toBe(7);
  });

  it("finds area-weighted centroids for concave and reversed rings", () => {
    expect(centroid(square)).toEqual({ x: 5, y: 5 });
    expect(centroid([...square].reverse())).toEqual({ x: 5, y: 5 });
    expect(centroid(elbow).x).toBeCloseTo(19 / 14);
    expect(centroid(elbow).y).toBeCloseTo(19 / 14);
    const translated = elbow.map((p) => ({ x: p.x + 100, y: p.y - 50 }));
    expect(centroid(translated).x).toBeCloseTo(100 + 19 / 14);
  });

  it("handles empty, short and zero-length geometry without NaN", () => {
    for (const points of [[], [{ x: 0, y: 0 }], [{ x: 0, y: 0 }, { x: 0, y: 0 }]]) {
      expect(polygonAreaPt2(points)).toBe(0);
      expect(polygonPerimeterPt(points)).toBe(0);
      expect(polylineLengthPt(points)).toBe(0);
      expect(centroid(points)).toEqual({ x: 0, y: 0 });
      expect(isSimplePolygon(points)).toBe(false);
    }
    expect(centroid([{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 3, y: 0 }])).toEqual({ x: 3, y: 0 });
    expect(bbox([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(bbox(elbow)).toEqual({ x: 0, y: 0, width: 4, height: 4 });
  });

  it("includes boundaries and excludes a concave recess", () => {
    expect(pointInPolygon({ x: 0, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 11, y: 5 }, square)).toBe(false);
    expect(pointInPolygon({ x: 2, y: 2 }, elbow)).toBe(false);
    expect(pointInPolygon({ x: 0, y: 0 }, [])).toBe(false);
  });

  it("rejects crossings, nonadjacent touches and adjacent backtracking", () => {
    expect(isSimplePolygon(square)).toBe(true);
    expect(isSimplePolygon([...square, square[0]])).toBe(true);
    expect(isSimplePolygon(elbow)).toBe(true);
    expect(isSimplePolygon([square[0], square[2], square[1], square[3]])).toBe(false);
    expect(isSimplePolygon([...square, { x: 10, y: 0 }])).toBe(false);
    expect(isSimplePolygon([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 10 }])).toBe(false);
  });
});
