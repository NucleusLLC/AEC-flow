/**
 * Geometry in PDF user space, independent of rendering and drawing scale.
 * Rings close implicitly; a repeated closing vertex is also accepted.
 */
import { distancePt, type Point } from "../drawings/markup";

function ring(points: Point[]): Point[] {
  const last = points[points.length - 1];
  return points.length > 1 && points[0].x === last.x && points[0].y === last.y
    ? points.slice(0, -1) : points;
}

function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function signedTwiceArea(points: Point[]): number {
  if (points.length < 3) return 0;
  // Translate to the first vertex to avoid cancellation far from the origin.
  let sum = 0;
  for (let i = 1; i < points.length - 1; i++) sum += cross(points[0], points[i], points[i + 1]);
  return sum;
}

export function polygonAreaPt2(points: Point[]): number {
  return Math.abs(signedTwiceArea(points)) / 2;
}

export function polylineLengthPt(points: Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += distancePt(points[i - 1], points[i]);
  return length;
}

export function polygonPerimeterPt(points: Point[]): number {
  if (points.length < 3) return 0;
  return polylineLengthPt(points) + distancePt(points[points.length - 1], points[0]);
}

/** Empty rings return the origin; zero-area rings return their vertex mean. */
export function centroid(vertices: Point[]): Point {
  const points = ring(vertices);
  if (!points.length) return { x: 0, y: 0 };
  const area2 = signedTwiceArea(points);
  if (area2 === 0) return {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  };
  const origin = points[0];
  let x = 0;
  let y = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const weight = cross(origin, points[i], points[i + 1]);
    x += (points[i].x - origin.x + points[i + 1].x - origin.x) * weight;
    y += (points[i].y - origin.y + points[i + 1].y - origin.y) * weight;
  }
  return { x: origin.x + x / (3 * area2), y: origin.y + y / (3 * area2) };
}

function onSegment(p: Point, a: Point, b: Point): boolean {
  return cross(a, b, p) === 0 && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x)
    && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y);
}

/** Boundary points are inside; rings with fewer than three vertices are empty. */
export function pointInPolygon(point: Point, points: Point[]): boolean {
  if (points.length < 3) return false;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j];
    const b = points[i];
    if (onSegment(point, a, b)) return true;
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function intersects(a: Point, b: Point, c: Point, d: Point): boolean {
  return (Math.sign(cross(a, b, c)) * Math.sign(cross(a, b, d)) < 0
    && Math.sign(cross(c, d, a)) * Math.sign(cross(c, d, b)) < 0)
    || onSegment(c, a, b) || onSegment(d, a, b) || onSegment(a, c, d) || onSegment(b, c, d);
}

/** Rejects degenerate rings, touching nonadjacent edges, and overlapping edges. */
export function isSimplePolygon(vertices: Point[]): boolean {
  const points = ring(vertices);
  const n = points.length;
  if (n < 3 || polygonAreaPt2(points) === 0) return false;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const c = points[(i + 2) % n];
    if (distancePt(a, b) === 0 || onSegment(c, a, b) || onSegment(a, b, c)) return false;
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (intersects(a, b, points[j], points[(j + 1) % n])) return false;
    }
  }
  return true;
}

/** Empty input has a zero box at the origin. */
export function bbox(points: Point[]): { x: number; y: number; width: number; height: number } {
  if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
