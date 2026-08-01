import { describe, expect, it } from "vitest";
import { MARGIN_PRESETS, PAPER_MM } from "./tokens";
import {
  gutterZones,
  intrudesIntoMargin,
  printableHeightMm,
  type PageMargins,
} from "./preview-geometry";

/** What CaPrintShell actually passes: 14mm top, 20mm bottom, 6mm sheet break. */
const SHELL: PageMargins = { topMm: 14, bottomMm: 20, sheetGapMm: 6 };

describe("gutterZones", () => {
  it("opens the bottom margin, the sheet break and the top margin", () => {
    expect(gutterZones(SHELL)).toEqual({
      gutterMm: 40,
      footerBandMm: 20,
      sheetEdgeAtMm: 20,
      topMarginStartsAtMm: 26,
      contentResumesAtMm: 40,
    });
  });

  // The regression this module exists for: a flat 16mm gutter is smaller than the
  // 20mm bottom margin, so the footer band consumed the whole gap and the next
  // page's first line was drawn inside the header zone.
  it("is never smaller than the bottom margin it has to hold the footer in", () => {
    const z = gutterZones(SHELL);
    expect(z.gutterMm).toBeGreaterThan(SHELL.bottomMm);
    expect(z.gutterMm).toBeGreaterThan(16);
  });

  it("leaves the next page's top margin entirely empty", () => {
    const z = gutterZones(SHELL);
    expect(z.contentResumesAtMm - z.topMarginStartsAtMm).toBe(SHELL.topMm);
  });

  it("puts the footer band inside the ending page's own bottom margin", () => {
    const z = gutterZones(SHELL);
    expect(z.footerBandMm).toBe(SHELL.bottomMm);
    expect(z.sheetEdgeAtMm).toBe(z.footerBandMm);
  });

  it("holds for every documented margin preset", () => {
    for (const preset of Object.values(MARGIN_PRESETS)) {
      const margins: PageMargins = { topMm: preset.top, bottomMm: preset.bottom, sheetGapMm: 6 };
      const z = gutterZones(margins);
      expect(z.gutterMm).toBe(preset.bottom + 6 + preset.top);
      expect(z.contentResumesAtMm - z.topMarginStartsAtMm).toBe(preset.top);
      expect(z.footerBandMm).toBe(preset.bottom);
    }
  });

  it("degenerates cleanly with no margins at all", () => {
    expect(gutterZones({ topMm: 0, bottomMm: 0, sheetGapMm: 0 })).toEqual({
      gutterMm: 0,
      footerBandMm: 0,
      sheetEdgeAtMm: 0,
      topMarginStartsAtMm: 0,
      contentResumesAtMm: 0,
    });
  });

  it("refuses negative margins rather than drawing something impossible", () => {
    expect(() => gutterZones({ topMm: -1, bottomMm: 20, sheetGapMm: 6 })).toThrow();
    expect(() => gutterZones({ topMm: 14, bottomMm: -20, sheetGapMm: 6 })).toThrow();
    expect(() => gutterZones({ topMm: 14, bottomMm: 20, sheetGapMm: -6 })).toThrow();
  });
});

describe("intrudesIntoMargin", () => {
  // "the text can only continue within the boundary of Headers, footers and Side
  // margins" — the reported bug was content at offset 16mm, i.e. inside the band.
  it("calls out content drawn anywhere before the gutter is spent", () => {
    expect(intrudesIntoMargin(0, SHELL)).toBe(true);
    expect(intrudesIntoMargin(16, SHELL)).toBe(true); // the old flat gutter
    expect(intrudesIntoMargin(20, SHELL)).toBe(true); // on the sheet edge
    expect(intrudesIntoMargin(26, SHELL)).toBe(true); // top of the top margin
    expect(intrudesIntoMargin(39.9, SHELL)).toBe(true);
  });

  it("accepts content that starts after both margins", () => {
    expect(intrudesIntoMargin(40, SHELL)).toBe(false);
    expect(intrudesIntoMargin(60, SHELL)).toBe(false);
  });
});

describe("printableHeightMm", () => {
  it("gives the 263mm content box the shell hard-codes for A4", () => {
    expect(printableHeightMm(PAPER_MM.A4.height, { topMm: 14, bottomMm: 20 })).toBe(263);
  });

  it("agrees with the tokens' own page height", () => {
    expect(PAPER_MM.A4.height).toBe(297);
    expect(printableHeightMm(PAPER_MM.A4.height, { topMm: 0, bottomMm: 0 })).toBe(297);
  });
});
