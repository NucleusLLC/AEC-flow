/**
 * Redline geometry. PURE — no React, no canvas, no DOM, no I/O.
 *
 * ─── EVERYTHING IS STORED IN PDF USER SPACE ─────────────────────────────────
 * Points, origin BOTTOM-LEFT, exactly as the PDF itself measures. Never screen
 * pixels. A markup saved at one zoom level on a 4K monitor and reopened on a
 * laptop has to land on the same door, and screen coordinates are a function of
 * zoom, device pixel ratio and window size — none of which the next reader
 * shares. The conversion happens once, at the edge, in `toPdfPoint` /
 * `toScreenPoint`, and every stored number is in points.
 *
 * ─── THE SOURCE PDF IS NEVER TOUCHED ────────────────────────────────────────
 * A markup is a row that points at a drawing, not a change to the drawing. The
 * practice has to be able to produce the file it was sent, unaltered, months
 * later. Flattening (DS-4) writes a NEW object and leaves the original alone.
 *
 * ─── WHY A REVISION CLOUD IS A FIRST-CLASS SHAPE ────────────────────────────
 * Because that is what the industry marks changes with. A rectangle means "look
 * here"; a cloud means "this changed" and everyone on a site reads it that way
 * without being told. Drawing it as a path of arcs, from the same geometry a
 * rectangle uses, costs one function and buys the convention.
 */

export type MarkupKind =
  | "PEN"
  | "LINE"
  | "ARROW"
  | "RECT"
  | "ELLIPSE"
  | "CLOUD"
  | "TEXT"
  | "CALLOUT"
  | "HIGHLIGHT"
  | "MEASURE"
  | "STAMP";

export const MARKUP_KINDS: MarkupKind[] = [
  "PEN",
  "LINE",
  "ARROW",
  "RECT",
  "ELLIPSE",
  "CLOUD",
  "TEXT",
  "CALLOUT",
  "HIGHLIGHT",
  "MEASURE",
  "STAMP",
];

export const MARKUP_KIND_LABEL: Record<MarkupKind, string> = {
  PEN: "Freehand",
  LINE: "Line",
  ARROW: "Arrow",
  RECT: "Rectangle",
  ELLIPSE: "Ellipse",
  CLOUD: "Revision cloud",
  TEXT: "Text",
  CALLOUT: "Callout",
  HIGHLIGHT: "Highlight",
  MEASURE: "Measurement",
  STAMP: "Stamp",
};

/** The stamps a review actually uses. Not a colour palette — a vocabulary. */
export const STAMPS = [
  "FOR REVIEW",
  "REVIEWED",
  "APPROVED",
  "APPROVED AS NOTED",
  "REVISE AND RESUBMIT",
  "SUPERSEDED",
  "AS BUILT",
  "NOT FOR CONSTRUCTION",
] as const;

export type StampLabel = (typeof STAMPS)[number];

export type Point = { x: number; y: number };

/**
 * A mark's geometry. One shape per kind, discriminated, so an impossible
 * combination — a freehand stroke with a radius, a stamp with a point list —
 * cannot be constructed or stored.
 */
export type MarkupGeometry =
  | { kind: "PEN"; points: Point[] }
  | { kind: "LINE"; a: Point; b: Point }
  | { kind: "ARROW"; a: Point; b: Point }
  | { kind: "RECT"; a: Point; b: Point }
  | { kind: "ELLIPSE"; a: Point; b: Point }
  | { kind: "CLOUD"; a: Point; b: Point }
  | { kind: "HIGHLIGHT"; a: Point; b: Point }
  | { kind: "TEXT"; at: Point; size: number }
  | { kind: "CALLOUT"; at: Point; target: Point; size: number }
  | { kind: "MEASURE"; a: Point; b: Point }
  | { kind: "STAMP"; at: Point; size: number };

/**
 * The redline colours. Red first because redlining is red — a review that
 * opens in blue reads as a different kind of comment to everyone who has held
 * a print. The rest exist so several reviewers can be told apart.
 */
export const MARKUP_COLOURS = [
  "#dc2626", // red — the default, and what "redline" means
  "#2563eb", // blue
  "#16a34a", // green
  "#d97706", // amber
  "#7c3aed", // violet
  "#0f172a", // near-black
] as const;

export const DEFAULT_MARKUP_COLOUR = MARKUP_COLOURS[0];

/**
 * A stable colour per author, so a sheet with four reviewers on it is readable
 * without a legend. Hashed rather than assigned, because assignment needs a
 * registry and this needs to work the first time a new person marks a sheet.
 * The author may still override it; this is only the default.
 */
export function colourForAuthor(authorId: string | null | undefined): string {
  const id = (authorId ?? "").trim();
  if (!id) return DEFAULT_MARKUP_COLOUR;
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return MARKUP_COLOURS[hash % MARKUP_COLOURS.length];
}

/* ------------------------------------------------------------------ *
 * Screen ↔ PDF user space
 * ------------------------------------------------------------------ */

/**
 * How the page is currently drawn: the rendered size in CSS pixels and the
 * page's own size in points. That is all the conversion needs — no zoom level,
 * no scroll offset, because both are already in the rendered size.
 */
export type PageView = {
  /** Rendered width of the page in CSS pixels. */
  widthPx: number;
  /** Rendered height of the page in CSS pixels. */
  heightPx: number;
  /** The page's own width in points. */
  widthPt: number;
  /** The page's own height in points. */
  heightPt: number;
};

/** A point on screen (origin top-left) as a point in the page (origin bottom-left). */
export function toPdfPoint(screen: Point, view: PageView): Point {
  if (view.widthPx <= 0 || view.heightPx <= 0) return { x: 0, y: 0 };
  const x = (screen.x / view.widthPx) * view.widthPt;
  // The flip. PDF counts up from the bottom; a browser counts down from the top.
  const y = ((view.heightPx - screen.y) / view.heightPx) * view.heightPt;
  return { x: round2(x), y: round2(y) };
}

/** The inverse, for drawing a stored mark back onto the page. */
export function toScreenPoint(pdf: Point, view: PageView): Point {
  if (view.widthPt <= 0 || view.heightPt <= 0) return { x: 0, y: 0 };
  const x = (pdf.x / view.widthPt) * view.widthPx;
  const y = view.heightPx - (pdf.y / view.heightPt) * view.heightPx;
  return { x: round2(x), y: round2(y) };
}

/** Points scale with the page: a 2 pt line stays 2 pt at any zoom. */
export function pointsToPixels(points: number, view: PageView): number {
  if (view.widthPt <= 0) return points;
  return (points / view.widthPt) * view.widthPx;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ------------------------------------------------------------------ *
 * Stroke economy
 * ------------------------------------------------------------------ */

/**
 * Thin a freehand stroke (Ramer–Douglas–Peucker).
 *
 * A pointer event fires every few milliseconds, so an unthinned stroke across
 * an A1 sheet is several thousand points — tens of kilobytes of JSON, per mark,
 * sent to the server and back to every reviewer. Thinning to a tolerance the
 * eye cannot see typically removes 80–95% of them and changes nothing on
 * screen.
 */
export function simplifyStroke(points: Point[], tolerancePt = 0.75): Point[] {
  if (!Array.isArray(points) || points.length <= 2) return points ?? [];

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let maxDistance = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const distance = perpendicularDistance(points[i], points[first], points[last]);
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    if (maxDistance > tolerancePt && index > 0) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + clamped * dx), p.y - (a.y + clamped * dy));
}

/* ------------------------------------------------------------------ *
 * Shapes
 * ------------------------------------------------------------------ */

export type Rect = { x: number; y: number; width: number; height: number };

/** The upright rectangle two corners describe, in any drag direction. */
export function normaliseRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

/**
 * A revision cloud as an SVG path: scallops of a fixed arc length around a
 * rectangle, so a big cloud gets more scallops rather than bigger ones. Drawn
 * clockwise from the top-left, in the coordinate space the caller hands in —
 * screen pixels when drawing, points when flattening.
 */
export function cloudPath(rect: Rect, scallopSize = 12): string {
  const size = Math.max(4, scallopSize);
  const { x, y, width, height } = rect;
  if (width <= 0 || height <= 0) return "";

  const across = Math.max(1, Math.round(width / size));
  const down = Math.max(1, Math.round(height / size));
  const stepX = width / across;
  const stepY = height / down;
  const r = Math.max(stepX, stepY) * 0.62;

  const parts: string[] = [`M ${x} ${y}`];
  const arc = (toX: number, toY: number) => parts.push(`A ${r} ${r} 0 0 1 ${toX} ${toY}`);

  for (let i = 1; i <= across; i++) arc(x + stepX * i, y);
  for (let i = 1; i <= down; i++) arc(x + width, y + stepY * i);
  for (let i = across - 1; i >= 0; i--) arc(x + stepX * i, y + height);
  for (let i = down - 1; i >= 0; i--) arc(x, y + stepY * i);
  parts.push("Z");
  return parts.join(" ");
}

/** The two short strokes of an arrow head at `b`, pointing away from `a`. */
export function arrowHead(a: Point, b: Point, size = 10): [Point, Point] {
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const spread = Math.PI / 7;
  return [
    { x: b.x - size * Math.cos(angle - spread), y: b.y - size * Math.sin(angle - spread) },
    { x: b.x - size * Math.cos(angle + spread), y: b.y - size * Math.sin(angle + spread) },
  ];
}

/* ------------------------------------------------------------------ *
 * Measuring
 * ------------------------------------------------------------------ */

/**
 * A measurement is only as good as its calibration, and a drawing's scale is
 * NOT reliably in the file — "1:100" in a title block is what the sheet was
 * plotted at, which stops being true the moment somebody prints it to A3
 * "fit to page". So a measurement carries the calibration it was taken under:
 * how many real-world millimetres one PDF point represents, established by the
 * user drawing along a known dimension and typing what it is.
 */
export type Calibration = {
  /** Real-world millimetres per PDF point. */
  mmPerPoint: number;
  /** What the user measured against, for the audit: "8000 mm grid line". */
  reference: string;
};

/** Millimetres per point for a line of `pt` points known to be `mm` long. */
export function calibrationFrom(pt: number, mm: number): number | null {
  if (!Number.isFinite(pt) || !Number.isFinite(mm) || pt <= 0 || mm <= 0) return null;
  return mm / pt;
}

/** Distance between two points, in points. */
export function distancePt(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * A measurement rendered the way a drawing office reads it: millimetres under a
 * metre, metres above, always with the unit. Uncalibrated returns points, and
 * SAYS "pt" — a bare number that might be millimetres and might be points is
 * how somebody orders the wrong steel.
 */
export function formatMeasurement(pt: number, calibration: Calibration | null): string {
  if (!Number.isFinite(pt) || pt <= 0) return "0";
  if (!calibration || !(calibration.mmPerPoint > 0)) return `${Math.round(pt)} pt`;
  const mm = pt * calibration.mmPerPoint;
  if (mm < 1000) return `${Math.round(mm)} mm`;
  return `${(mm / 1000).toFixed(2)} m`;
}

/* ------------------------------------------------------------------ *
 * Validation and hit-testing
 * ------------------------------------------------------------------ */

const MAX_STROKE_POINTS = 4000;

/** Is this geometry storable? Rejects the empty, the infinite and the absurd. */
export function isValidGeometry(g: MarkupGeometry | null | undefined): boolean {
  if (!g) return false;
  const finite = (p: Point) => Number.isFinite(p?.x) && Number.isFinite(p?.y);
  switch (g.kind) {
    case "PEN":
      return Array.isArray(g.points) && g.points.length >= 2 && g.points.length <= MAX_STROKE_POINTS && g.points.every(finite);
    case "LINE":
    case "ARROW":
    case "MEASURE":
      return finite(g.a) && finite(g.b) && distancePt(g.a, g.b) > 0.5;
    case "RECT":
    case "ELLIPSE":
    case "CLOUD":
    case "HIGHLIGHT": {
      if (!finite(g.a) || !finite(g.b)) return false;
      const r = normaliseRect(g.a, g.b);
      return r.width > 1 && r.height > 1;
    }
    case "TEXT":
    case "STAMP":
      return finite(g.at) && Number.isFinite(g.size) && g.size > 0;
    case "CALLOUT":
      return finite(g.at) && finite(g.target) && Number.isFinite(g.size) && g.size > 0;
    default:
      return false;
  }
}

/** The bounding box of a mark, for hit-testing and for fitting the view to it. */
export function boundsOf(g: MarkupGeometry, textWidthPt = 120): Rect {
  switch (g.kind) {
    case "PEN": {
      const xs = g.points.map((p) => p.x);
      const ys = g.points.map((p) => p.y);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
    }
    case "LINE":
    case "ARROW":
    case "MEASURE":
    case "RECT":
    case "ELLIPSE":
    case "CLOUD":
    case "HIGHLIGHT":
      return normaliseRect(g.a, g.b);
    case "TEXT":
    case "STAMP":
      return { x: g.at.x, y: g.at.y - g.size, width: textWidthPt, height: g.size * 1.4 };
    case "CALLOUT":
      return normaliseRect(g.at, g.target);
  }
}

/** Is `point` on or near this mark? `tolerance` is in the same space as the geometry. */
export function hitTest(g: MarkupGeometry, point: Point, tolerance = 4): boolean {
  const b = boundsOf(g);
  const inflated = {
    x: b.x - tolerance,
    y: b.y - tolerance,
    width: b.width + tolerance * 2,
    height: b.height + tolerance * 2,
  };
  const inBox =
    point.x >= inflated.x &&
    point.x <= inflated.x + inflated.width &&
    point.y >= inflated.y &&
    point.y <= inflated.y + inflated.height;
  if (!inBox) return false;

  // A filled shape is hit anywhere inside it; an open one only near its stroke,
  // so a rectangle drawn around half a plan does not swallow every click in it.
  switch (g.kind) {
    case "HIGHLIGHT":
    case "TEXT":
    case "STAMP":
    case "CALLOUT":
      return true;
    case "PEN":
      return g.points.some((p, i) =>
        i === 0 ? false : perpendicularDistance(point, g.points[i - 1], p) <= tolerance,
      );
    case "LINE":
    case "ARROW":
    case "MEASURE":
      return perpendicularDistance(point, g.a, g.b) <= tolerance;
    case "RECT":
    case "CLOUD":
    case "ELLIPSE": {
      const r = normaliseRect(g.a, g.b);
      const nearLeft = Math.abs(point.x - r.x) <= tolerance;
      const nearRight = Math.abs(point.x - (r.x + r.width)) <= tolerance;
      const nearTop = Math.abs(point.y - r.y) <= tolerance;
      const nearBottom = Math.abs(point.y - (r.y + r.height)) <= tolerance;
      return nearLeft || nearRight || nearTop || nearBottom;
    }
  }
}
