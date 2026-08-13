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
    // The 42/50 split is the whole point: white washes out faster than black,
    // so an identical alpha reads as a milky slab in light theme.
    for (const l of CARD_OPACITY_LEVELS) {
      expect(l.light).toBeLessThan(l.dark);
    }
  });

  it("keeps light tracking dark at the shipped ratio (42/50)", () => {
    for (const l of CARD_OPACITY_LEVELS) {
      expect(l.light).toBe(Math.round(l.dark * (42 / 50)));
    }
  });

  it("stays inside the measured bounds at both ends", () => {
    // Floor: light 34% is where `text-faint` still measures 3.04:1 against the
    // worst block of the worst photo. Ceiling: past ~60% white the photograph is
    // no longer identifiable and the glass has become a plain panel.
    for (const l of CARD_OPACITY_LEVELS) {
      expect(l.light).toBeGreaterThanOrEqual(34);
      expect(l.light).toBeLessThanOrEqual(60);
      expect(l.dark).toBeGreaterThanOrEqual(40);
      expect(l.dark).toBeLessThanOrEqual(70);
    }
  });

  it("carries a distinct, non-empty label per level", () => {
    const labels = CARD_OPACITY_LEVELS.map((l) => l.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) expect(label.length).toBeGreaterThan(0);
    expect(new Set(CARD_OPACITY_LEVELS.map((l) => l.dark)).size).toBe(CARD_OPACITY_LEVELS.length);
  });
});

describe("the default is today's look", () => {
  it("is the pair already hard-coded in globals.css", () => {
    // If either of these changes, every existing user's dashboard changes with
    // it — which the feature explicitly promises not to do.
    expect(DEFAULT_CARD_OPACITY_PERCENT).toBe(50);
    expect(resolveCardOpacityLevel(DEFAULT_CARD_OPACITY_PERCENT).light).toBe(42);
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
      41,
      49,
      51,
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
      expect(vars["--glass-surface-dark"]).toBe("50%");
      expect(vars["--glass-surface-light"]).toBe("42%");
    }
  });
});

describe("cardOpacityVars", () => {
  it("emits both ends so the theme can be decided in the browser", () => {
    // One number would apply to both themes and flatten the split; the CSS picks
    // whichever of these two matches the active theme.
    expect(cardOpacityVars(40)).toEqual({
      "--glass-surface-light": "34%",
      "--glass-surface-dark": "40%",
    });
    expect(cardOpacityVars(68)).toEqual({
      "--glass-surface-light": "57%",
      "--glass-surface-dark": "68%",
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
