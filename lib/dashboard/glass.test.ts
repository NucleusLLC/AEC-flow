import { describe, it, expect } from "vitest";
import {
  CARD_OPACITY_LEVELS,
  DEFAULT_CARD_OPACITY_PERCENT,
  cardOpacityVars,
  coerceCardOpacityPercent,
  resolveCardOpacityLevel,
} from "./glass";

describe("card opacity ladder", () => {
  it("is ascending by opacity, so the dropdown reads as a scale", () => {
    const darks = CARD_OPACITY_LEVELS.map((l) => l.dark);
    expect(darks).toEqual([...darks].sort((a, b) => a - b));
    const lights = CARD_OPACITY_LEVELS.map((l) => l.light);
    expect(lights).toEqual([...lights].sort((a, b) => a - b));
  });

  it("never lets light and dark collapse to the same number", () => {
    // The split is the whole point: white frosted glass and smoky glass are
    // different materials over the same bright photo, so one alpha for both
    // would be wrong for at least one of them.
    for (const l of CARD_OPACITY_LEVELS) {
      expect(l.light).not.toBe(l.dark);
    }
  });

  it("keeps light a fixed four points above dark at every step", () => {
    // Light holds dark text up with a little more white; smoky glass goes
    // opaque-looking sooner, so dark sits below. The gap is constant so the
    // control reads as one scale, not two.
    for (const l of CARD_OPACITY_LEVELS) {
      expect(l.light).toBe(l.dark + 4);
    }
  });

  it("stays inside the measured bounds at both ends", () => {
    // Floor: body text must clear 4.5:1 at Standard and stay above 3.8:1 on
    // the most transparent step (measured, see glass.ts). Ceiling: past ~60%
    // the photograph is no longer identifiable behind the blur and the glass
    // has become a plain panel.
    for (const l of CARD_OPACITY_LEVELS) {
      expect(l.light).toBeGreaterThanOrEqual(34);
      expect(l.light).toBeLessThanOrEqual(60);
      expect(l.dark).toBeGreaterThanOrEqual(30);
      expect(l.dark).toBeLessThanOrEqual(56);
    }
  });

  it("carries a distinct, non-empty label per level", () => {
    const labels = CARD_OPACITY_LEVELS.map((l) => l.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) expect(label.length).toBeGreaterThan(0);
    expect(new Set(CARD_OPACITY_LEVELS.map((l) => l.dark)).size).toBe(CARD_OPACITY_LEVELS.length);
  });
});

describe("the default is the stylesheet's look", () => {
  it("is the pair hard-coded in globals.css", () => {
    // If either of these changes, globals.css must change with it — a user who
    // never touched the control sees the stylesheet defaults.
    expect(DEFAULT_CARD_OPACITY_PERCENT).toBe(38);
    expect(resolveCardOpacityLevel(DEFAULT_CARD_OPACITY_PERCENT).light).toBe(42);
  });

  it("is what a value from the retired dark-set ladder resolves to", () => {
    // 40/45/50/58/68 were tuned for the old dark photos; they are not carried
    // over, they fall back to the new Standard step.
    for (const v of [40, 45, 50, 58, 68]) {
      expect(coerceCardOpacityPercent(v)).toBe(DEFAULT_CARD_OPACITY_PERCENT);
    }
  });

  it("is one of the published choices", () => {
    expect(CARD_OPACITY_LEVELS.some((l) => l.dark === DEFAULT_CARD_OPACITY_PERCENT)).toBe(true);
  });

  it("is what a preferences blob written before this key existed resolves to", () => {
    expect(coerceCardOpacityPercent(undefined)).toBe(DEFAULT_CARD_OPACITY_PERCENT);
  });
});

describe("coerceCardOpacityPercent", () => {
  it("accepts every published value unchanged", () => {
    for (const { dark } of CARD_OPACITY_LEVELS) {
      expect(coerceCardOpacityPercent(dark)).toBe(dark);
    }
  });

  it("refuses anything the dropdown cannot produce", () => {
    // `User.preferences` is free-form JSON and this number ends up inside a CSS
    // custom property, so a whitelist is the only door.
    const bad = [
      0,
      -50,
      37,
      39,
      50,
      100,
      101,
      NaN,
      Infinity,
      "50",
      "50%",
      null,
      undefined,
      {},
      [],
      true,
    ];
    for (const v of bad) {
      expect(coerceCardOpacityPercent(v)).toBe(DEFAULT_CARD_OPACITY_PERCENT);
    }
  });

  it("cannot be talked into emitting a hostile string", () => {
    const hostile = [
      "50%; background: url(http://evil)",
      "0%, transparent), url(x)",
      "</style><script>",
      { dark: 50 },
      ["50"],
    ];
    for (const v of hostile) {
      const vars = cardOpacityVars(v);
      expect(vars["--glass-surface-dark"]).toBe("38%");
      expect(vars["--glass-surface-light"]).toBe("42%");
    }
  });
});

describe("cardOpacityVars", () => {
  it("emits both ends so the theme can be decided in the browser", () => {
    // One number would apply to both themes and flatten the split; the CSS picks
    // whichever of these two matches the active theme.
    expect(cardOpacityVars(30)).toEqual({
      "--glass-surface-light": "34%",
      "--glass-surface-dark": "30%",
    });
    expect(cardOpacityVars(56)).toEqual({
      "--glass-surface-light": "60%",
      "--glass-surface-dark": "56%",
    });
  });

  it("only ever emits bare <percentage> tokens", () => {
    for (const { dark } of CARD_OPACITY_LEVELS) {
      for (const v of Object.values(cardOpacityVars(dark))) {
        expect(v).toMatch(/^\d{1,3}%$/);
      }
    }
  });
});
