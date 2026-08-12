import { describe, it, expect } from "vitest";
import {
  BACKGROUND_INTERVALS,
  DASHBOARD_BACKGROUNDS,
  DEFAULT_BACKGROUND_INTERVAL_SECONDS,
  coerceBackgroundIntervalSeconds,
  nextBackgroundIndex,
  pickDashboardBackgroundIndex,
} from "./backgrounds";

describe("dashboard background manifest", () => {
  it("carries twelve entries with unique ids and paths", () => {
    expect(DASHBOARD_BACKGROUNDS).toHaveLength(12);
    expect(new Set(DASHBOARD_BACKGROUNDS.map((b) => b.id)).size).toBe(12);
    expect(new Set(DASHBOARD_BACKGROUNDS.map((b) => b.src)).size).toBe(12);
  });

  it("points at public/backgrounds/dashboard", () => {
    for (const bg of DASHBOARD_BACKGROUNDS) {
      expect(bg.src).toMatch(/^\/backgrounds\/dashboard\/\d{2}-[a-z-]+\.jpg$/);
      expect(bg.label.length).toBeGreaterThan(0);
      expect(bg.description.length).toBeGreaterThan(0);
    }
  });
});

describe("pickDashboardBackgroundIndex", () => {
  it("is deterministic for a given seed — the server pick must survive hydration", () => {
    expect(pickDashboardBackgroundIndex("user-abc")).toBe(pickDashboardBackgroundIndex("user-abc"));
  });

  it("stays in range for any seed, including none", () => {
    for (const seed of [null, undefined, "", "u", "a".repeat(200), "🙂"]) {
      const i = pickDashboardBackgroundIndex(seed);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(DASHBOARD_BACKGROUNDS.length);
    }
  });

  it("spreads similar ids across the set", () => {
    const picks = new Set(
      Array.from({ length: 40 }, (_, i) => pickDashboardBackgroundIndex(`clx000000000${i}`)),
    );
    expect(picks.size).toBeGreaterThan(4);
  });
});

describe("rotation interval", () => {
  it("offers exactly the seven approved choices, ascending", () => {
    expect(BACKGROUND_INTERVALS.map((i) => i.seconds)).toEqual([10, 30, 60, 120, 300, 600, 1800]);
    expect(BACKGROUND_INTERVALS.map((i) => i.label)).toEqual([
      "10 seconds",
      "30 seconds",
      "1 minute",
      "2 minutes",
      "5 minutes",
      "10 minutes",
      "30 minutes",
    ]);
  });

  it("defaults to ten seconds, and that default is one of the choices", () => {
    expect(DEFAULT_BACKGROUND_INTERVAL_SECONDS).toBe(10);
    expect(BACKGROUND_INTERVALS.some((i) => i.seconds === DEFAULT_BACKGROUND_INTERVAL_SECONDS)).toBe(true);
  });

  it("accepts every published value unchanged", () => {
    for (const { seconds } of BACKGROUND_INTERVALS) {
      expect(coerceBackgroundIntervalSeconds(seconds)).toBe(seconds);
    }
  });

  it("refuses anything the dropdown cannot produce", () => {
    // The preferences blob is free-form JSON — none of this may become a timer.
    for (const bad of [0, -10, 7, 1801, NaN, Infinity, "60", null, undefined, {}, [], true]) {
      expect(coerceBackgroundIntervalSeconds(bad)).toBe(DEFAULT_BACKGROUND_INTERVAL_SECONDS);
    }
  });
});

describe("nextBackgroundIndex", () => {
  const last = DASHBOARD_BACKGROUNDS.length - 1;

  it("advances and wraps", () => {
    expect(nextBackgroundIndex(0)).toBe(1);
    expect(nextBackgroundIndex(last)).toBe(0);
  });

  it("skips images that failed to load", () => {
    expect(nextBackgroundIndex(0, [1, 2])).toBe(3);
    expect(nextBackgroundIndex(last, [0, 1])).toBe(2);
  });

  it("returns the only survivor rather than nothing", () => {
    const skip = DASHBOARD_BACKGROUNDS.map((_, i) => i).filter((i) => i !== 5);
    expect(nextBackgroundIndex(5, skip)).toBe(5);
  });

  it("returns null when every image is unusable", () => {
    const skip = DASHBOARD_BACKGROUNDS.map((_, i) => i);
    expect(nextBackgroundIndex(3, skip)).toBeNull();
  });
});
