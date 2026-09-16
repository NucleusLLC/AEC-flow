import { describe, it, expect } from "vitest";
import { gutterMode, pageEndAt, spanOf, MARGIN_LESS_DISPLAYS } from "./gutter";

/**
 * The rule that decides how a page boundary opens its gap, and where the footer
 * band therefore goes. Geometry is verified in a real browser
 * (scripts/verify-print-overflow.mjs); what is testable here is the decision, and
 * it is the decision that was wrong.
 */
describe("gutterMode", () => {
  it("asks for a spacer on a table row, which cannot hold a margin", () => {
    expect(gutterMode("table-row")).toBe("spacer");
    expect(gutterMode("table-row-group")).toBe("spacer");
    expect(gutterMode("table-header-group")).toBe("spacer");
    expect(gutterMode("table-cell")).toBe("spacer");
  });

  it("uses the margin on anything that is a margin box", () => {
    for (const display of ["block", "flow-root", "flex", "grid", "table", "table-caption", "list-item"]) {
      expect(gutterMode(display)).toBe("margin");
    }
  });

  it("does not treat the table itself as margin-less", () => {
    // The table is pushed down whole by a margin like any other block; it is only
    // its internal boxes that discard one. Adding `table` to the set would have
    // moved a whole register to the next page to break inside it.
    expect(MARGIN_LESS_DISPLAYS.has("table")).toBe(false);
    expect(MARGIN_LESS_DISPLAYS.has("table-caption")).toBe(false);
  });

  it("falls back to the margin for a display it has never heard of", () => {
    // A guess either way, and this is the safe one: the margin mechanism is what
    // every non-table document already uses, and an unknown display that turns
    // out to discard margins is caught by the browser check, not hidden by it.
    expect(gutterMode("ruby-text")).toBe("margin");
    expect(gutterMode("")).toBe("margin");
  });
});

describe("pageEndAt", () => {
  const gutterPx = 151;

  it("puts the page end a gutter above a block pushed down by its margin", () => {
    expect(pageEndAt({ markerTop: 1000, gutterPx, mode: "margin" })).toBe(849);
  });

  it("puts it at the spacer, because the spacer IS the gap", () => {
    expect(pageEndAt({ markerTop: 1000, gutterPx, mode: "spacer" })).toBe(1000);
  });

  it("is the whole defect: the two modes differ by a full gutter", () => {
    // Reading a spacer as a margin drew the footer band 151px — 40mm — above the
    // end of the page, across live table rows. That is the reported bug in one
    // line of arithmetic.
    const asMargin = pageEndAt({ markerTop: 1000, gutterPx, mode: "margin" });
    const asSpacer = pageEndAt({ markerTop: 1000, gutterPx, mode: "spacer" });
    expect(asSpacer - asMargin).toBe(gutterPx);
  });
});

describe("spanOf", () => {
  it("counts the columns a row covers, not the cells it has", () => {
    expect(spanOf([{}, {}, {}, {}, {}])).toBe(5);
    expect(spanOf([{ colSpan: 5 }])).toBe(5);
    expect(spanOf([{ colSpan: 2 }, {}, { colSpan: 3 }])).toBe(6);
  });

  it("never spans less than one column, whatever the row reports", () => {
    expect(spanOf([])).toBe(1);
    expect(spanOf([{ colSpan: 0 }])).toBe(1);
    expect(spanOf([{ colSpan: -1 }])).toBe(1);
  });
});
