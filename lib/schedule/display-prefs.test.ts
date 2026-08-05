import { describe, expect, it } from "vitest";
import {
  DISPLAY_ITEMS,
  TILE_KEYS,
  countVisibleTiles,
  defaultDisplayPrefs,
  parseDisplayPrefs,
  serializeDisplayPrefs,
  tileGridClass,
  type DisplayPrefs,
} from "@/lib/schedule/display-prefs";

describe("DISPLAY_ITEMS", () => {
  it("lists the eight toggles in the owner's order", () => {
    expect(DISPLAY_ITEMS.map((i) => i.label)).toEqual([
      "Display Actual/Planned",
      "SPI",
      "Schedule Variance",
      "Behind/Overdue",
      "Baseline Finish",
      "Forecast",
      "Critical Path Slipping",
      "Current Date Vertical Line (RED)",
    ]);
  });

  it("counts six metric tiles; the callout and the today rule are not tiles", () => {
    expect(TILE_KEYS).toHaveLength(6);
    expect(TILE_KEYS).not.toContain("criticalPathSlipping");
    expect(TILE_KEYS).not.toContain("todayLine");
  });
});

describe("defaultDisplayPrefs", () => {
  it("turns everything on", () => {
    const prefs = defaultDisplayPrefs();
    expect(Object.values(prefs).every(Boolean)).toBe(true);
    expect(Object.keys(prefs)).toHaveLength(DISPLAY_ITEMS.length);
  });

  it("returns a fresh object each call so callers cannot poison the default", () => {
    const a = defaultDisplayPrefs();
    a.spi = false;
    expect(defaultDisplayPrefs().spi).toBe(true);
  });
});

describe("parseDisplayPrefs — degrades to all-on, never to a blank board", () => {
  const allOn = (p: DisplayPrefs) => Object.values(p).every(Boolean);

  it("falls back when storage is empty or unavailable", () => {
    expect(allOn(parseDisplayPrefs(null))).toBe(true);
    expect(allOn(parseDisplayPrefs(undefined))).toBe(true);
    expect(allOn(parseDisplayPrefs(""))).toBe(true);
  });

  it("falls back on corrupt JSON", () => {
    expect(allOn(parseDisplayPrefs("{"))).toBe(true);
    expect(allOn(parseDisplayPrefs("not json at all"))).toBe(true);
    expect(allOn(parseDisplayPrefs('{"spi":fa'))).toBe(true);
  });

  it("falls back on valid JSON of the wrong shape", () => {
    expect(allOn(parseDisplayPrefs("null"))).toBe(true);
    expect(allOn(parseDisplayPrefs("[]"))).toBe(true);
    expect(allOn(parseDisplayPrefs('"spi"'))).toBe(true);
    expect(allOn(parseDisplayPrefs("42"))).toBe(true);
  });

  it("honours booleans it recognises", () => {
    const prefs = parseDisplayPrefs('{"spi":false,"todayLine":false}');
    expect(prefs.spi).toBe(false);
    expect(prefs.todayLine).toBe(false);
    expect(prefs.forecast).toBe(true);
  });

  it("ignores unknown keys and non-boolean values", () => {
    const prefs = parseDisplayPrefs('{"spi":"nope","bogus":false,"forecast":0}');
    expect(prefs.spi).toBe(true);
    expect(prefs.forecast).toBe(true);
    expect("bogus" in prefs).toBe(false);
  });

  it("defaults a key absent from an older blob to visible", () => {
    expect(parseDisplayPrefs('{"spi":false}').forecast).toBe(true);
  });

  it("round-trips through serialize", () => {
    const prefs = defaultDisplayPrefs();
    prefs.behindOverdue = false;
    expect(parseDisplayPrefs(serializeDisplayPrefs(prefs))).toEqual(prefs);
  });
});

describe("countVisibleTiles", () => {
  it("counts only the six tiles", () => {
    const prefs = defaultDisplayPrefs();
    expect(countVisibleTiles(prefs)).toBe(6);

    prefs.criticalPathSlipping = false;
    prefs.todayLine = false;
    expect(countVisibleTiles(prefs)).toBe(6);

    prefs.spi = false;
    prefs.forecast = false;
    expect(countVisibleTiles(prefs)).toBe(4);
  });

  it("reaches zero when every tile is hidden", () => {
    const prefs = defaultDisplayPrefs();
    for (const k of TILE_KEYS) prefs[k] = false;
    expect(countVisibleTiles(prefs)).toBe(0);
  });
});

describe("tileGridClass — the grid reflows to the visible count", () => {
  it("keeps the original responsive shape when all six show", () => {
    expect(tileGridClass(6)).toBe("grid-cols-2 sm:grid-cols-3 lg:grid-cols-6");
  });

  it("never asks for more columns than there are tiles", () => {
    expect(tileGridClass(1)).toBe("grid-cols-1");
    expect(tileGridClass(2)).toBe("grid-cols-2");
    expect(tileGridClass(3)).toBe("grid-cols-2 sm:grid-cols-3");
    expect(tileGridClass(4)).toBe("grid-cols-2 sm:grid-cols-2 lg:grid-cols-4");
    expect(tileGridClass(5)).toBe("grid-cols-2 sm:grid-cols-3 lg:grid-cols-5");
  });

  it("emits no column class when nothing is visible", () => {
    expect(tileGridClass(0)).toBe("");
  });

  it("clamps nonsense rather than emitting a broken class", () => {
    expect(tileGridClass(-3)).toBe("");
    expect(tileGridClass(99)).toBe(tileGridClass(6));
    expect(tileGridClass(Number.NaN)).toBe("");
    expect(tileGridClass(3.7)).toBe(tileGridClass(3));
  });
});
