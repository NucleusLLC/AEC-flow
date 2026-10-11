import { describe, expect, it } from "vitest";
import { LANG_CODES } from "@/lib/i18n/types";
import {
  GUIDE_BUTTON_LABEL,
  GUIDE_FLY_MS,
  GUIDE_HOLD_MS,
  GUIDE_LANGS,
  GUIDE_STEPS,
  GUIDE_TONE_HEX,
  availableIndices,
  clampRect,
  guideEnabledFor,
  horizontalOverlap,
  missingGuideText,
  nextStepIndex,
  placeCard,
  scrollDeltaToReveal,
  stepDurationMs,
  stepPosition,
  unionRect,
  type Rect,
} from "./interactive-guide";
import { GUIDE_CONTENT, guideContentFor } from "./interactive-guide-content";

describe("the language gate", () => {
  it("offers the guide in Spanish only", () => {
    expect(GUIDE_LANGS).toEqual(["es"]);
    expect(guideEnabledFor("es")).toBe(true);
    for (const l of LANG_CODES.filter((x) => x !== "es")) expect(guideEnabledFor(l)).toBe(false);
  });

  it("is closed for anything that is not a known language", () => {
    for (const v of [undefined, null, "", "ES", "es-CO", "xx"]) expect(guideEnabledFor(v)).toBe(false);
  });

  it("has complete card text for every language it is offered in, and for no other", () => {
    for (const l of GUIDE_LANGS) {
      const content = guideContentFor(l);
      expect(content, l).not.toBeNull();
      expect(missingGuideText(content!)).toEqual([]);
      for (const v of Object.values(content!.ui)) expect(v.trim()).not.toBe("");
    }
    expect(Object.keys(GUIDE_CONTENT).sort()).toEqual([...GUIDE_LANGS].sort());
    expect(guideContentFor("en")).toBeNull();
    expect(guideContentFor(undefined)).toBeNull();
  });

  it("keeps the button label fixed", () => {
    expect(GUIDE_BUTTON_LABEL).toBe("INTERACTIVE-GUIDE");
  });
});

describe("the step list", () => {
  it("is 29 steps numbered 1 to 29 in order: 20 callouts, then 9 column legends", () => {
    expect(GUIDE_STEPS.map((s) => s.number)).toEqual(Array.from({ length: 29 }, (_, i) => i + 1));
    expect(GUIDE_STEPS.slice(20).every((s) => s.targets.every((t) => t.startsWith("est-col-")))).toBe(true);
  });

  it("has unique ids, at least one target each, and a known colour", () => {
    expect(new Set(GUIDE_STEPS.map((s) => s.id)).size).toBe(GUIDE_STEPS.length);
    for (const s of GUIDE_STEPS) {
      expect(s.targets.length).toBeGreaterThan(0);
      expect(GUIDE_TONE_HEX[s.tone]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("has no card text without a step", () => {
    const ids = new Set(GUIDE_STEPS.map((s) => s.id));
    for (const content of Object.values(GUIDE_CONTENT))
      expect(Object.keys(content.steps).filter((k) => !ids.has(k))).toEqual([]);
  });

  it("reports a step whose text is missing or blank", () => {
    const es = guideContentFor("es")!;
    const steps = { ...es.steps, client: { title: " ", body: "x" } };
    delete (steps as Record<string, unknown>).date;
    expect(missingGuideText({ ...es, steps })).toEqual(["client", "date"]);
  });
});

describe("timing", () => {
  it("holds a step for 5 seconds and flies for half a second", () => {
    expect(GUIDE_HOLD_MS).toBe(5000);
    expect(GUIDE_FLY_MS).toBe(500);
    expect(stepDurationMs({ flies: false, reducedMotion: false })).toBe(5000);
    expect(stepDurationMs({ flies: true, reducedMotion: false })).toBe(5500);
  });

  it("does not wait for a flight that reduced motion removes", () => {
    expect(stepDurationMs({ flies: true, reducedMotion: true })).toBe(5000);
  });
});

describe("next and previous step", () => {
  const all = () => true;

  it("walks forward and back through every step", () => {
    expect(nextStepIndex(5, -1, 1, all)).toBe(0);
    expect(nextStepIndex(5, 2, 1, all)).toBe(3);
    expect(nextStepIndex(5, 2, -1, all)).toBe(1);
  });

  it("ends after the last step and stops before the first", () => {
    expect(nextStepIndex(5, 4, 1, all)).toBe(-1);
    expect(nextStepIndex(5, 0, -1, all)).toBe(-1);
  });

  it("skips steps whose target is not on the page", () => {
    const present = (i: number) => [1, 4].includes(i);
    expect(nextStepIndex(6, -1, 1, present)).toBe(1);
    expect(nextStepIndex(6, 1, 1, present)).toBe(4);
    expect(nextStepIndex(6, 4, 1, present)).toBe(-1);
    expect(nextStepIndex(6, 4, -1, present)).toBe(1);
    expect(nextStepIndex(6, 1, -1, present)).toBe(-1);
  });

  it("finds nothing on a page with no targets at all", () => {
    expect(nextStepIndex(29, -1, 1, () => false)).toBe(-1);
    expect(availableIndices(29, () => false)).toEqual([]);
  });

  it("lists the steps that can be shown, in order", () => {
    expect(availableIndices(6, (i) => i % 2 === 0)).toEqual([0, 2, 4]);
  });

  it("counts the position among the steps that can be shown", () => {
    expect(stepPosition([0, 2, 4], 0)).toEqual({ n: 1, total: 3 });
    expect(stepPosition([0, 2, 4], 4)).toEqual({ n: 3, total: 3 });
  });

  it("still counts a step that has just lost its target", () => {
    expect(stepPosition([0, 4], 2)).toEqual({ n: 2, total: 3 });
    expect(stepPosition([], 7)).toEqual({ n: 1, total: 1 });
  });
});

describe("rectangles", () => {
  const r = (left: number, top: number, width: number, height: number): Rect => ({ left, top, width, height });

  it("draws one box around several targets", () => {
    expect(unionRect([r(10, 10, 20, 20), r(100, 5, 50, 10)])).toEqual(r(10, 5, 140, 25));
    expect(unionRect([r(1, 2, 3, 4)])).toEqual(r(1, 2, 3, 4));
    expect(unionRect([])).toBeNull();
  });

  it("measures how much of a target a clipping parent leaves visible", () => {
    expect(horizontalOverlap(r(10, 0, 100, 10), r(0, 0, 300, 10))).toBe(100);
    expect(horizontalOverlap(r(250, 0, 100, 10), r(0, 0, 300, 10))).toBe(50);
    // A collapsed sidebar: zero wide, so nothing inside it is visible.
    expect(horizontalOverlap(r(0, 0, 24, 10), r(0, 0, 0, 800))).toBe(0);
    expect(horizontalOverlap(r(400, 0, 10, 10), r(0, 0, 300, 10))).toBe(0);
  });

  it("keeps the outline of an oversized target on screen", () => {
    const vp = { width: 1000, height: 600 };
    expect(clampRect(r(100, 100, 200, 50), vp, 4)).toEqual(r(100, 100, 200, 50));
    expect(clampRect(r(-50, 200, 2000, 3000), vp, 4)).toEqual(r(4, 200, 992, 396));
    const off = clampRect(r(100, 900, 50, 50), vp, 4);
    expect(off.height).toBe(0);
    expect(off.top).toBe(596);
  });

  it("scrolls only when the target is not already in view", () => {
    expect(scrollDeltaToReveal(100, 200, 0, 600, 20)).toBe(0);
    // Below the view: centred. Room is 20..580 = 560, target 100 tall -> top at 250.
    expect(scrollDeltaToReveal(900, 1000, 0, 600, 20)).toBe(650);
    // Above the view: scrolls up.
    expect(scrollDeltaToReveal(-300, -200, 0, 600, 20)).toBe(-550);
    // Taller than the view: aligned to its top.
    expect(scrollDeltaToReveal(700, 2700, 0, 600, 20)).toBe(680);
    // Works for a scroll container that does not start at 0.
    expect(scrollDeltaToReveal(100, 150, 64, 664, 16)).toBe(0);
  });
});

describe("card placement", () => {
  const card = { width: 340, height: 180 };
  const desktop = { width: 1440, height: 900 };
  const phone = { width: 390, height: 844 };
  const r = (left: number, top: number, width: number, height: number): Rect => ({ left, top, width, height });

  const inside = (p: { x: number; y: number }, c: typeof card, vp: typeof desktop, margin = 12) => {
    expect(p.x).toBeGreaterThanOrEqual(margin);
    expect(p.y).toBeGreaterThanOrEqual(margin);
    expect(p.x + c.width).toBeLessThanOrEqual(vp.width - margin);
    expect(p.y + c.height).toBeLessThanOrEqual(vp.height - margin);
  };

  it("sits below a target with room underneath, centred on it", () => {
    const p = placeCard({ target: r(600, 100, 200, 40), card, viewport: desktop });
    expect(p.side).toBe("bottom");
    expect(p.y).toBe(100 + 40 + 14);
    expect(p.x).toBe(700 - 170);
    expect(p.arrow).toBe(170);
  });

  it("flips above when there is no room below", () => {
    const p = placeCard({ target: r(600, 820, 200, 40), card, viewport: desktop });
    expect(p.side).toBe("top");
    expect(p.y).toBe(820 - 14 - 180);
  });

  it("goes to the right of a full-height sidebar", () => {
    const p = placeCard({ target: r(0, 130, 256, 700), card, viewport: desktop });
    expect(p.side).toBe("right");
    expect(p.x).toBe(256 + 14);
    inside(p, card, desktop);
  });

  it("goes to the left of a full-height panel on the right edge", () => {
    const p = placeCard({ target: r(1100, 20, 340, 870), card, viewport: desktop });
    expect(p.side).toBe("left");
    expect(p.x).toBe(1100 - 14 - 340);
  });

  it("lies over the target when no side has room", () => {
    const p = placeCard({ target: r(280, 70, 1140, 2400), card, viewport: desktop });
    expect(p.side).toBe("over");
    inside(p, card, desktop);
  });

  it("slides along the edge instead of leaving the screen, and keeps pointing at the target", () => {
    const p = placeCard({ target: r(1380, 100, 50, 30), card, viewport: desktop });
    expect(p.side).toBe("bottom");
    expect(p.x).toBe(1440 - 12 - 340);
    // The target's centre (1405) is 317 px into the card; the pointer follows it.
    expect(p.arrow).toBe(1405 - p.x);
    const q = placeCard({ target: r(2, 100, 20, 30), card, viewport: desktop });
    expect(q.x).toBe(12);
    expect(q.arrow).toBe(18);
  });

  it("stays on screen at phone width for a target anywhere, of any size", () => {
    const c = { width: 366, height: 210 };
    const targets = [
      r(16, 90, 170, 28),
      r(200, 90, 170, 28),
      r(0, 400, 390, 40),
      r(16, 780, 358, 50),
      r(-200, -100, 900, 3000),
      r(350, 820, 30, 20),
      r(0, 2000, 390, 40),
      r(0, -500, 390, 40),
    ];
    for (const target of targets) inside(placeCard({ target, card: c, viewport: phone }), c, phone);
  });

  it("never leaves the screen across a sweep of targets and viewports", () => {
    for (const vp of [desktop, phone, { width: 768, height: 1024 }, { width: 1024, height: 500 }]) {
      const c = { width: Math.min(340, vp.width - 24), height: 200 };
      for (let x = -200; x <= vp.width + 200; x += 97)
        for (let y = -200; y <= vp.height + 200; y += 89)
          for (const [w, h] of [[30, 20], [300, 40], [vp.width, 60], [200, 2000]] as const) {
            const p = placeCard({ target: r(x, y, w, h), card: c, viewport: vp });
            inside(p, c, vp);
            const edge = p.side === "left" || p.side === "right" ? c.height : c.width;
            expect(p.arrow).toBeGreaterThanOrEqual(18);
            expect(p.arrow).toBeLessThanOrEqual(edge - 18);
          }
    }
  });

  it("does not sit on top of the target when a side has room", () => {
    const target = r(500, 300, 300, 120);
    const p = placeCard({ target, card, viewport: desktop });
    const overlapX = Math.min(p.x + card.width, 800) - Math.max(p.x, 500);
    const overlapY = Math.min(p.y + card.height, 420) - Math.max(p.y, 300);
    expect(overlapX > 0 && overlapY > 0).toBe(false);
  });
});
