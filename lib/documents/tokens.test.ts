import { describe, it, expect } from "vitest";
import {
  PAPER_MM,
  MARGIN_PRESETS,
  DEFAULT_PAGE,
  TYPE_SCALE,
  TYPE_LIMITS,
  SPACING,
  LOGO_TOKENS,
  HEADER_HEIGHT_MM,
  FOOTER_HEIGHT_MM,
  pageSizeMm,
  printableAreaMm,
  contentHeightMm,
  clampTypeSize,
  type TypeRole,
} from "@/lib/documents/tokens";

describe("page geometry", () => {
  it("returns portrait trim sizes", () => {
    expect(pageSizeMm({ paper: "A4", orientation: "portrait" })).toEqual({ width: 210, height: 297 });
  });

  it("swaps the axes for landscape", () => {
    expect(pageSizeMm({ paper: "A4", orientation: "landscape" })).toEqual({ width: 297, height: 210 });
  });

  it("supports Letter and Legal, not just A4", () => {
    // The whole point of the token: geometry used to be hardcoded to A4 inline.
    expect(PAPER_MM.Letter).toEqual({ width: 215.9, height: 279.4 });
    expect(PAPER_MM.Legal.height).toBeGreaterThan(PAPER_MM.Letter.height);
  });

  it("subtracts margins to give the printable area", () => {
    const area = printableAreaMm({ paper: "A4", orientation: "portrait", margins: MARGIN_PRESETS.standard });
    expect(area.width).toBeCloseTo(210 - 16 - 16);
    expect(area.height).toBeCloseTo(297 - 15 - 15);
  });

  it("subtracts header and footer to give usable content height", () => {
    const h = contentHeightMm(DEFAULT_PAGE, "corporate", "minimal");
    expect(h).toBeCloseTo(297 - 15 - 15 - HEADER_HEIGHT_MM.corporate - FOOTER_HEIGHT_MM.minimal);
  });

  it("keeps every margin preset inside the §15 guidance band", () => {
    for (const [name, m] of Object.entries(MARGIN_PRESETS)) {
      for (const side of [m.top, m.right, m.bottom, m.left]) {
        expect(side, `${name} margin`).toBeGreaterThanOrEqual(12);
        expect(side, `${name} margin`).toBeLessThanOrEqual(20);
      }
    }
  });

  it("leaves usable height on the densest legal combination", () => {
    // A guard against tokens that would render a page with no room for content.
    const h = contentHeightMm(
      { paper: "A4", orientation: "landscape", margins: MARGIN_PRESETS.comfortable },
      "letterhead",
      "legal",
    );
    expect(h).toBeGreaterThan(100);
  });
});

describe("typography scale", () => {
  it("places every default inside its own readability range", () => {
    for (const role of Object.keys(TYPE_SCALE) as TypeRole[]) {
      const { min, max } = TYPE_LIMITS[role];
      expect(TYPE_SCALE[role], role).toBeGreaterThanOrEqual(min);
      expect(TYPE_SCALE[role], role).toBeLessThanOrEqual(max);
    }
  });

  it("orders the scale so hierarchy cannot invert", () => {
    expect(TYPE_SCALE.documentTitle).toBeGreaterThan(TYPE_SCALE.majorHeading);
    expect(TYPE_SCALE.majorHeading).toBeGreaterThan(TYPE_SCALE.subheading);
    expect(TYPE_SCALE.subheading).toBeGreaterThan(TYPE_SCALE.body);
    expect(TYPE_SCALE.body).toBeGreaterThanOrEqual(TYPE_SCALE.compactBody);
    expect(TYPE_SCALE.compactBody).toBeGreaterThan(TYPE_SCALE.tableBody);
    expect(TYPE_SCALE.tableBody).toBeGreaterThan(TYPE_SCALE.footer);
  });

  it("clamps a too-small size up rather than rendering it", () => {
    const r = clampTypeSize("body", 4);
    expect(r.pt).toBe(TYPE_LIMITS.body.min);
    expect(r.clamped).toBe(true);
  });

  it("clamps a too-large size down", () => {
    const r = clampTypeSize("footer", 40);
    expect(r.pt).toBe(TYPE_LIMITS.footer.max);
    expect(r.clamped).toBe(true);
  });

  it("reports an in-range size as unclamped", () => {
    expect(clampTypeSize("body", 9.5)).toEqual({ pt: 9.5, clamped: false });
  });

  it("never allows body text below 9pt — the readability floor", () => {
    // Directive §7.4: text must not be compressed to reduce page count.
    expect(clampTypeSize("body", 1).pt).toBeGreaterThanOrEqual(9);
  });
});

describe("density spacing", () => {
  it("tightens monotonically from comfortable to compact", () => {
    const keys = Object.keys(SPACING.standard) as (keyof typeof SPACING.standard)[];
    for (const k of keys) {
      expect(SPACING.comfortable[k], k).toBeGreaterThanOrEqual(SPACING.standard[k]);
      expect(SPACING.standard[k], k).toBeGreaterThanOrEqual(SPACING.compact[k]);
    }
  });

  it("never collapses spacing to zero, even at compact", () => {
    for (const [k, v] of Object.entries(SPACING.compact)) {
      expect(v, k).toBeGreaterThan(0);
    }
  });
});

describe("system logo tokens", () => {
  it("reserves a minimum slot width so the placeholder cannot be squeezed away", () => {
    // Directive §3.2/§3.3: header space is reclaimed by layout, never by dropping the slot.
    expect(LOGO_TOKENS.minWidthMm).toBeGreaterThan(0);
    expect(LOGO_TOKENS.maxWidthMm).toBeGreaterThan(LOGO_TOKENS.minWidthMm);
  });

  it("keeps the continuation logo smaller than the primary one", () => {
    expect(LOGO_TOKENS.continuationMaxHeightMm).toBeLessThan(LOGO_TOKENS.maxHeightMm);
  });
});
