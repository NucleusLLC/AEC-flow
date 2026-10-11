/**
 * INTERACTIVE-GUIDE for the Estimates editor: the step list and every decision
 * that can be made without a browser. No Prisma, no React, no DOM.
 *
 * The guide is a self-running tour. Each step lights up one part of the screen
 * and parks a callout card beside it for GUIDE_HOLD_MS, then the card flies to
 * the next part. The overlay component (components/estimate-guide/) only reads
 * rectangles off the page and hands them to the functions below.
 *
 * A step names its target by `data-guide="…"` attributes. Those attributes are
 * the ONLY thing the guide adds to the protected Estimates files; a step whose
 * target is not on the page (no sections yet, Client view, sidebar hidden on a
 * phone) is skipped, never an error.
 */
import type { Lang } from "@/lib/i18n/types";

/**
 * The languages the guide is offered in. The button is not rendered in any
 * other language. Widening the guide is this one line plus that language's
 * card text in interactive-guide-content.ts (a test holds the two together);
 * narrating it is one more entry in lib/guide-narration/spoken.ts and voices.ts.
 */
export const GUIDE_LANGS: readonly Lang[] = ["es", "en"];

/** The single gate: is the INTERACTIVE-GUIDE button shown in this language? */
export function guideEnabledFor(lang: string | null | undefined): boolean {
  return typeof lang === "string" && (GUIDE_LANGS as readonly string[]).includes(lang);
}

/** The button label. Deliberately the same in every language. */
export const GUIDE_BUTTON_LABEL = "INTERACTIVE-GUIDE";

/**
 * The one card shown on the Estimates landing screen (the project picker),
 * where there is no estimate to tour yet. Not a step of the tour: it has no
 * number and is not in GUIDE_STEPS. Its narration clip is filed under this id.
 */
export const GUIDE_PICKER_HINT_ID = "pickerHint";

/** The route whose landing screen shows the picker card. */
export const GUIDE_PICKER_PATH = "/estimates";

/** Id of the empty slot in the shell's top bar the button moves into on wide screens. */
export const GUIDE_TOPBAR_SLOT_ID = "estimate-guide-slot";

/**
 * Set on the slot by the top bar once it is live in the browser. The button is
 * only moved into a slot that carries it: the top bar is server-rendered behind
 * a Suspense boundary, and a button put into it before React has adopted that
 * markup is a hydration mismatch (React then throws the whole shell away and
 * renders it again).
 */
export const GUIDE_TOPBAR_SLOT_READY = "data-guide-slot-ready";

/** How long a step stays lit once the card has arrived. */
export const GUIDE_HOLD_MS = 5000;
/** How long the card takes to fly to the next target. */
export const GUIDE_FLY_MS = 500;

/**
 * Time from one step change to the next. The first step has nothing to fly
 * from, and with reduced motion nothing flies at all, so both are the bare hold.
 */
export function stepDurationMs(opts: { flies: boolean; reducedMotion: boolean }): number {
  return opts.flies && !opts.reducedMotion ? GUIDE_FLY_MS + GUIDE_HOLD_MS : GUIDE_HOLD_MS;
}

export type GuideTone = "pink" | "blue" | "purple" | "green" | "orange" | "yellow" | "slate";

/** Callout colours, after the annotated screenshot the guide was specified from. */
export const GUIDE_TONE_HEX: Record<GuideTone, string> = {
  pink: "#ec4899",
  blue: "#3b82f6",
  purple: "#8b5cf6",
  green: "#22c55e",
  orange: "#f59e0b",
  yellow: "#eab308",
  slate: "#94a3b8",
};

export type GuideStep = {
  /** Stable key; the card text is looked up by it. */
  id: string;
  /** The number on the card's badge. */
  number: number;
  tone: GuideTone;
  /** `data-guide` values, in order of preference. */
  targets: readonly string[];
  /**
   * "first": light the first target that is on screen (the rest are fallbacks).
   * "union": light one box around every target that is on screen.
   */
  match: "first" | "union";
};

const step = (
  number: number,
  id: string,
  tone: GuideTone,
  targets: string | readonly string[],
  match: GuideStep["match"] = "first",
): GuideStep => ({ id, number, tone, targets: typeof targets === "string" ? [targets] : targets, match });

/** The tour, in the order it runs. 1 to 20 are the numbered callouts, 21 to 29 the column legend. */
export const GUIDE_STEPS: readonly GuideStep[] = [
  step(1, "module", "pink", "shell-module"),
  step(2, "projectNo", "blue", "est-project-no"),
  step(3, "client", "purple", "est-client"),
  step(4, "version", "green", "est-version"),
  step(5, "date", "orange", "est-date"),
  step(6, "location", "pink", "est-location"),
  step(7, "area", "blue", "est-area"),
  step(8, "sideMenu", "blue", "shell-nav"),
  step(9, "pricing", "green", "est-pricing"),
  step(10, "costBase", "purple", ["est-cost-db", "est-view"], "union"),
  step(11, "totalCost", "orange", "est-total"),
  step(12, "status", "pink", ["est-status-banner", "est-status"]),
  step(13, "table", "pink", "est-table"),
  step(14, "subtotal", "blue", "est-subtotal"),
  step(15, "directCost", "green", "est-direct"),
  step(16, "totalDirect", "pink", "est-total-direct"),
  step(17, "addSection", "orange", "est-add-section"),
  step(18, "summary", "blue", "est-summary"),
  step(19, "markups", "purple", "est-markups"),
  step(20, "item", "green", "est-item-btn"),
  step(21, "colQty", "slate", "est-col-qty"),
  step(22, "colUnit", "purple", "est-col-unit"),
  step(23, "colNorm", "yellow", "est-col-norm"),
  step(24, "colHours", "orange", "est-col-hrs"),
  step(25, "colLabor", "green", "est-col-labor"),
  step(26, "colMaterial", "blue", "est-col-material"),
  step(27, "colEquipment", "purple", "est-col-equipment"),
  step(28, "colSub", "yellow", "est-col-sub"),
  step(29, "colProgress", "pink", "est-col-progress"),
];

// ---------------------------------------------------------------------------
// Card text
// ---------------------------------------------------------------------------

export type GuideStepText = {
  title: string;
  body: string;
  /** Optional "term: explanation" lines under the body. */
  points?: readonly { term: string; text: string }[];
};

export type GuideContent = {
  steps: Record<string, GuideStepText>;
  /**
   * The picker card: what to do before the tour can run. Its body names the
   * "New estimate" button exactly as that screen shows it in this language (a
   * test holds it to the dictionary).
   */
  picker: { title: string; body: string };
  ui: {
    /** Tooltip on the idle button. */
    start: string;
    /** Tooltip on the lit button. */
    stop: string;
    back: string;
    next: string;
    pause: string;
    resume: string;
    close: string;
    /** Tooltip of the speaker button while narration is on / off. */
    mute: string;
    unmute: string;
    /** Accessible name of the card. */
    label: string;
  };
};

/** Step ids that a language's card text leaves out or leaves blank. */
export function missingGuideText(content: GuideContent, steps: readonly GuideStep[] = GUIDE_STEPS): string[] {
  return steps
    .filter((s) => {
      const tx = content.steps[s.id];
      return !tx || !tx.title.trim() || !tx.body.trim();
    })
    .map((s) => s.id);
}

// ---------------------------------------------------------------------------
// Order: next / previous step, skipping targets that are not on the page
// ---------------------------------------------------------------------------

/**
 * The next step after `from` in direction `dir` whose target is on the page,
 * or -1 when there is none (going forward, that is the end of the tour).
 * Pass `from = -1` with `dir = 1` to find the first step.
 */
export function nextStepIndex(
  count: number,
  from: number,
  dir: 1 | -1,
  available: (index: number) => boolean,
): number {
  for (let i = from + dir; i >= 0 && i < count; i += dir) if (available(i)) return i;
  return -1;
}

/** Every step whose target is on the page, in tour order. */
export function availableIndices(count: number, available: (index: number) => boolean): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) if (available(i)) out.push(i);
  return out;
}

/**
 * "3 / 17" for the card: where `current` sits among the steps that can be
 * shown. A current step that has just lost its target still counts itself, so
 * the count never reads 0 or runs past the total.
 */
export function stepPosition(indices: readonly number[], current: number): { n: number; total: number } {
  const at = indices.indexOf(current);
  if (at >= 0) return { n: at + 1, total: indices.length };
  const before = indices.filter((i) => i < current).length;
  return { n: before + 1, total: indices.length + 1 };
}

// ---------------------------------------------------------------------------
// Geometry (viewport coordinates, CSS pixels)
// ---------------------------------------------------------------------------

export type Rect = { left: number; top: number; width: number; height: number };
export type Size = { width: number; height: number };

const right = (r: Rect) => r.left + r.width;
const bottom = (r: Rect) => r.top + r.height;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** One box around all of `rects`; null for none. */
export function unionRect(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const l = Math.min(...rects.map((r) => r.left));
  const t = Math.min(...rects.map((r) => r.top));
  const r = Math.max(...rects.map(right));
  const b = Math.max(...rects.map(bottom));
  return { left: l, top: t, width: r - l, height: b - t };
}

/** How many pixels of `a` lie inside `b` horizontally (0 when they do not meet). */
export function horizontalOverlap(a: Rect, b: Rect): number {
  return Math.max(0, Math.min(right(a), right(b)) - Math.max(a.left, b.left));
}

/**
 * The part of `r` inside the viewport, kept `inset` away from its edges, so the
 * glowing outline of a target taller than the screen is still drawn on screen.
 * A rect wholly off screen collapses onto the nearest edge.
 */
export function clampRect(r: Rect, viewport: Size, inset = 0): Rect {
  const l = clamp(r.left, inset, viewport.width - inset);
  const t = clamp(r.top, inset, viewport.height - inset);
  const rr = clamp(right(r), inset, viewport.width - inset);
  const bb = clamp(bottom(r), inset, viewport.height - inset);
  return { left: l, top: t, width: Math.max(0, rr - l), height: Math.max(0, bb - t) };
}

/**
 * How far to scroll (positive = down) so a target spanning top..bottom shows
 * inside the view spanning viewTop..viewBottom, `margin` clear of both edges.
 * 0 when it already does. A target that fits is centred; one taller than the
 * view is aligned to its top.
 */
export function scrollDeltaToReveal(
  top: number,
  bottom_: number,
  viewTop: number,
  viewBottom: number,
  margin = 0,
): number {
  const lo = viewTop + margin;
  const hi = viewBottom - margin;
  if (top >= lo && bottom_ <= hi) return 0;
  const room = hi - lo;
  const height = bottom_ - top;
  if (height >= room) return top - lo;
  return top - (lo + (room - height) / 2);
}

export type CardSide = "bottom" | "top" | "right" | "left" | "over";

export type CardPlacement = {
  /** Top-left corner of the card. Always inside the viewport, `margin` from its edges. */
  x: number;
  y: number;
  /** Which side of the target the card sits on; "over" when no side has room. */
  side: CardSide;
  /** Where the pointer sits along the card edge that faces the target, in px from that edge's start. */
  arrow: number;
};

/**
 * Where the callout card goes. Sides are tried in the order below, above,
 * right, left, and the first with room for the whole card wins: that is the
 * flip. When no side has room (a phone, or a target as big as the screen) the
 * card is laid over the bottom of the target instead. In every case the result
 * is clamped into the viewport, so the card can never leave the screen.
 */
export function placeCard(opts: {
  target: Rect;
  card: Size;
  viewport: Size;
  /** Distance between target and card. */
  gap?: number;
  /** Minimum distance between card and viewport edge. */
  margin?: number;
}): CardPlacement {
  const { card, viewport } = opts;
  const gap = opts.gap ?? 14;
  const margin = opts.margin ?? 12;
  // Work from the part of the target that is actually on screen.
  const t = clampRect(opts.target, viewport);
  const maxX = viewport.width - margin - card.width;
  const maxY = viewport.height - margin - card.height;
  const cx = t.left + t.width / 2;
  const cy = t.top + t.height / 2;
  const alongX = () => clamp(cx - card.width / 2, margin, maxX);
  const alongY = () => clamp(cy - card.height / 2, margin, maxY);
  const arrowX = (x: number) => clamp(cx - x, 18, card.width - 18);
  const arrowY = (y: number) => clamp(cy - y, 18, card.height - 18);

  const room = {
    bottom: viewport.height - margin - (bottom(t) + gap),
    top: t.top - gap - margin,
    right: viewport.width - margin - (right(t) + gap),
    left: t.left - gap - margin,
  };
  const fitsWide = card.width <= viewport.width - 2 * margin;
  const fitsTall = card.height <= viewport.height - 2 * margin;

  if (fitsWide && room.bottom >= card.height) {
    const x = alongX();
    return { x, y: bottom(t) + gap, side: "bottom", arrow: arrowX(x) };
  }
  if (fitsWide && room.top >= card.height) {
    const x = alongX();
    return { x, y: t.top - gap - card.height, side: "top", arrow: arrowX(x) };
  }
  if (fitsTall && room.right >= card.width) {
    const y = alongY();
    return { x: right(t) + gap, y, side: "right", arrow: arrowY(y) };
  }
  if (fitsTall && room.left >= card.width) {
    const y = alongY();
    return { x: t.left - gap - card.width, y, side: "left", arrow: arrowY(y) };
  }
  const x = alongX();
  return { x, y: clamp(bottom(t) - gap - card.height, margin, maxY), side: "over", arrow: arrowX(x) };
}
