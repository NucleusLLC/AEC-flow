import { describe, expect, it } from "vitest";
import {
  EXACT_TOLERANCE_MM,
  MM_PER_POINT,
  PAPER_SIZES,
  describePaper,
  detectPaperSize,
  mmToPoints,
  oneSizeUp,
  pointsToMm,
  undersizeWarning,
} from "./paper";

/** A page of `w` x `h` millimetres, expressed the way a PDF reports it. */
const page = (wMm: number, hMm: number): [number, number] => [wMm / MM_PER_POINT, hMm / MM_PER_POINT];

describe("points and millimetres", () => {
  it("converts at 1/72 inch, both ways", () => {
    expect(pointsToMm(72)).toBe(25.4);
    expect(mmToPoints(25.4)).toBe(72);
    // A1 landscape, the size a plotted sheet actually is.
    expect(pointsToMm(2383.94)).toBeCloseTo(841, 0);
  });

  it("treats nonsense as zero rather than throwing", () => {
    expect(pointsToMm(Number.NaN)).toBe(0);
    expect(pointsToMm(-10)).toBe(0);
    expect(mmToPoints(0)).toBe(0);
  });
});

describe("naming the sheet", () => {
  it("reads every ISO A size exactly, in either orientation", () => {
    for (const size of PAPER_SIZES.filter((s) => s.series === "ISO_A")) {
      const portrait = detectPaperSize(...page(size.shortMm, size.longMm));
      const landscape = detectPaperSize(...page(size.longMm, size.shortMm));
      expect(portrait.size.name, `${size.name} portrait`).toBe(size.name);
      expect(portrait.orientation).toBe("portrait");
      expect(portrait.match).toBe("exact");
      expect(landscape.size.name, `${size.name} landscape`).toBe(size.name);
      expect(landscape.orientation).toBe("landscape");
    }
  });

  it("reads the American sizes too — consultants send them", () => {
    expect(detectPaperSize(...page(863.6, 1117.6)).size.name).toBe("ANSI E");
    expect(detectPaperSize(...page(914.4, 609.6)).size.name).toBe("ARCH D");
    expect(detectPaperSize(...page(279.4, 215.9)).size.name).toBe("ANSI A");
  });

  it("forgives the couple of millimetres a CAD exporter rounds away", () => {
    const trimmed = detectPaperSize(...page(841 - EXACT_TOLERANCE_MM + 0.5, 594));
    expect(trimmed.size.name).toBe("A1");
    expect(trimmed.match).toBe("exact");
    expect(trimmed.confidence).toBeGreaterThan(0.9);
  });

  it("says 'near' rather than claiming a match it does not have", () => {
    const bled = detectPaperSize(...page(841 + 6, 594 + 6));
    expect(bled.size.name).toBe("A1");
    expect(bled.match).toBe("near");
    expect(bled.confidence).toBeLessThan(0.8);
    expect(bled.note).toMatch(/off by/);
  });

  it("calls a genuinely odd sheet custom, and still names the nearest", () => {
    const odd = detectPaperSize(...page(1000, 500));
    expect(odd.match).toBe("custom");
    expect(odd.size.series).toBe("CUSTOM");
    expect(odd.size.name).toContain("500");
    expect(odd.alternates.length).toBeGreaterThan(0);
    expect(odd.note).toMatch(/Nearest named size/);
  });

  it("calls a square page square rather than guessing an orientation", () => {
    expect(detectPaperSize(...page(500, 500)).orientation).toBe("square");
  });

  it("returns a zero-confidence answer for a page with no geometry", () => {
    const nothing = detectPaperSize(0, 0);
    expect(nothing.confidence).toBe(0);
    expect(nothing.match).toBe("custom");
    expect(describePaper(nothing)).toBe("Unknown size");
    expect(detectPaperSize(Number.NaN, 100).confidence).toBe(0);
  });

  it("reports the page as measured, not the nominal size", () => {
    const trimmed = detectPaperSize(...page(840, 594));
    expect(trimmed.size.name).toBe("A1");
    expect(trimmed.widthMm).toBeCloseTo(840, 0);
    expect(trimmed.size.longMm).toBe(841); // the NAMED size is unchanged
  });
});

describe("the warning that earns its place", () => {
  it("flags a working drawing that arrived as a reading copy", () => {
    const a3 = detectPaperSize(...page(420, 297));
    expect(undersizeWarning(a3)).toMatch(/A3/);
  });

  it("says nothing about a full-size sheet, or about a note", () => {
    expect(undersizeWarning(detectPaperSize(...page(841, 594)))).toBeNull();
    expect(undersizeWarning(detectPaperSize(...page(105, 148)))).toBeNull();
    expect(undersizeWarning(detectPaperSize(0, 0))).toBeNull();
  });
});

describe("one size up", () => {
  it("steps through the ISO A series and stops at A0", () => {
    const a3 = PAPER_SIZES.find((s) => s.name === "A3")!;
    expect(oneSizeUp(a3)?.name).toBe("A2");
    const a0 = PAPER_SIZES.find((s) => s.name === "A0")!;
    expect(oneSizeUp(a0)).toBeNull();
  });

  it("refuses to pretend the other series ladder the same way", () => {
    const ansiD = PAPER_SIZES.find((s) => s.name === "ANSI D")!;
    expect(oneSizeUp(ansiD)).toBeNull();
  });
});

describe("how it reads on screen", () => {
  it("names the sheet and its orientation", () => {
    expect(describePaper(detectPaperSize(...page(841, 594)))).toBe("A1 landscape");
    expect(describePaper(detectPaperSize(...page(210, 297)))).toBe("A4 portrait");
  });
});
