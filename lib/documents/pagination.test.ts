import { describe, it, expect } from "vitest";
import {
  computeCuts,
  headingRequiredSpace,
  resolveHeadingBreaks,
  selectHeadingsToPush,
  PAGE_START_EPSILON_PX,
  type PaginationBlock,
  type HeadingMetric,
} from "@/lib/documents/pagination";

/**
 * One page is 1000px throughout, so every figure below reads as a percentage of
 * a page. Blocks are the print engine's unbreakable atoms; headings carry the
 * space they need below their own top.
 */
const PAGE = 1000;

const block = (top: number, height: number): PaginationBlock => ({
  top,
  bottom: top + height,
  height,
});

const heading = (top: number, requiredSpace: number): HeadingMetric => ({ top, requiredSpace });

describe("computeCuts — page boundaries", () => {
  it("fills each page when nothing is unbreakable", () => {
    const cuts = computeCuts({ contentHeight: 2500, pageHeight: PAGE, blocks: [] });
    expect(cuts.map((c) => c.at)).toEqual([1000, 2000]);
    expect(cuts.every((c) => c.kind === "flow")).toBe(true);
  });

  it("returns no cut for a document shorter than one page", () => {
    expect(computeCuts({ contentHeight: 600, pageHeight: PAGE, blocks: [] })).toEqual([]);
  });

  it("pulls the boundary back to the top of a block it would have split", () => {
    const cuts = computeCuts({
      contentHeight: 2000,
      pageHeight: PAGE,
      blocks: [block(950, 200)],
    });
    expect(cuts[0]).toMatchObject({ at: 950, kind: "atom", blockIndex: 0 });
  });

  it("splits a block taller than a page rather than stranding the page above it", () => {
    // A 1200px block cannot fit anywhere; the browser slices it, and so must we.
    const cuts = computeCuts({
      contentHeight: 2000,
      pageHeight: PAGE,
      blocks: [block(900, 1200)],
    });
    expect(cuts[0]).toMatchObject({ at: 1000, kind: "flow" });
  });

  it("names the block that begins the next page even when the boundary is clean", () => {
    const cuts = computeCuts({
      contentHeight: 2000,
      pageHeight: PAGE,
      blocks: [block(1000, 100)],
    });
    expect(cuts[0]).toMatchObject({ at: 1000, kind: "flow", blockIndex: 0 });
  });

  it("ends the page early at a forced break", () => {
    const cuts = computeCuts({
      contentHeight: 2000,
      pageHeight: PAGE,
      blocks: [],
      forcedTops: [700],
    });
    expect(cuts.map((c) => c.at)).toEqual([700, 1700]);
    expect(cuts[0]).toMatchObject({ kind: "forced", forcedIndex: 0 });
  });

  it("reports the caller's own index for a forced break, whatever the order", () => {
    const cuts = computeCuts({
      contentHeight: 3000,
      pageHeight: PAGE,
      blocks: [],
      forcedTops: [1800, 700],
    });
    expect(cuts.map((c) => [c.at, c.forcedIndex])).toEqual([
      [700, 1],
      [1700, undefined],
      [1800, 0],
      [2800, undefined],
    ]);
  });

  it("honours a forced break that lands past the last natural page", () => {
    // 2.2 pages of content with a forced break at 2.1 pages: the natural loop
    // stops at 2000, and the break would otherwise be silently dropped.
    const cuts = computeCuts({
      contentHeight: 2200,
      pageHeight: PAGE,
      blocks: [],
      forcedTops: [2100],
    });
    expect(cuts.map((c) => c.at)).toEqual([1000, 2000, 2100]);
  });

  it("ignores a forced break sitting where the page already starts", () => {
    // The empty-page failure: a break requested a hair below the boundary.
    const cuts = computeCuts({
      contentHeight: 2000,
      pageHeight: PAGE,
      blocks: [],
      forcedTops: [1000 + PAGE_START_EPSILON_PX - 1],
    });
    expect(cuts.map((c) => c.at)).toEqual([1000]);
    expect(cuts.every((c) => c.kind !== "forced")).toBe(true);
  });

  it("ignores a forced break at the very top of the document", () => {
    const cuts = computeCuts({
      contentHeight: 2000,
      pageHeight: PAGE,
      blocks: [],
      forcedTops: [0],
    });
    expect(cuts.map((c) => c.at)).toEqual([1000]);
  });

  it("terminates on a degenerate page height instead of spinning", () => {
    expect(computeCuts({ contentHeight: 5000, pageHeight: 0, blocks: [] })).toEqual([]);
    expect(computeCuts({ contentHeight: 5000, pageHeight: -10, blocks: [] })).toEqual([]);
  });

  it("stops at the page cap", () => {
    const cuts = computeCuts({
      contentHeight: 1e6,
      pageHeight: PAGE,
      blocks: [],
      maxPages: 5,
    });
    expect(cuts).toHaveLength(5);
  });
});

describe("selectHeadingsToPush — threshold maths", () => {
  const cuts = [1000, 2000];

  it("pushes a heading whose clearance is under its requirement", () => {
    expect(selectHeadingsToPush({ headings: [heading(950, 100)], cuts, pageHeight: PAGE })).toEqual([
      0,
    ]);
  });

  it("leaves a heading with exactly its requirement alone", () => {
    expect(selectHeadingsToPush({ headings: [heading(900, 100)], cuts, pageHeight: PAGE })).toEqual(
      [],
    );
  });

  it("never pushes a heading that already begins its page", () => {
    // Exactly on the boundary, and a sub-pixel below it: both are page tops.
    expect(
      selectHeadingsToPush({
        headings: [heading(1000, 900), heading(1000 + PAGE_START_EPSILON_PX - 1, 900)],
        cuts,
        pageHeight: PAGE,
      }),
    ).toEqual([]);
  });

  it("never pushes the first heading of the document", () => {
    expect(selectHeadingsToPush({ headings: [heading(0, 900)], cuts, pageHeight: PAGE })).toEqual(
      [],
    );
  });

  it("ignores headings on the final page, which has no foot", () => {
    expect(selectHeadingsToPush({ headings: [heading(2500, 900)], cuts, pageHeight: PAGE })).toEqual(
      [],
    );
  });

  it("ignores a requirement no page could satisfy", () => {
    expect(
      selectHeadingsToPush({ headings: [heading(950, PAGE + 1)], cuts, pageHeight: PAGE }),
    ).toEqual([]);
  });

  it("returns every stranded heading, in document order", () => {
    expect(
      selectHeadingsToPush({
        headings: [heading(300, 100), heading(960, 100), heading(1970, 100)],
        cuts,
        pageHeight: PAGE,
      }),
    ).toEqual([1, 2]);
  });
});

describe("headingRequiredSpace", () => {
  it("uses the token floor when the lead-in needs less", () => {
    expect(
      headingRequiredSpace({
        headingHeight: 20,
        minimumSpacePx: 75,
        leadInSpacePx: 30,
        maxUnitHeight: 350,
      }),
    ).toBe(95);
  });

  it("raises the floor for a lead-in that needs more", () => {
    expect(
      headingRequiredSpace({
        headingHeight: 20,
        minimumSpacePx: 75,
        leadInSpacePx: 200,
        maxUnitHeight: 350,
      }),
    ).toBe(220);
  });

  it("clamps a tall lead-in to the keep-together ceiling", () => {
    expect(
      headingRequiredSpace({
        headingHeight: 20,
        minimumSpacePx: 75,
        leadInSpacePx: 900,
        maxUnitHeight: 350,
      }),
    ).toBe(370);
  });

  it("falls back to the token floor with no lead-in", () => {
    expect(
      headingRequiredSpace({ headingHeight: 20, minimumSpacePx: 75, maxUnitHeight: 350 }),
    ).toBe(95);
  });
});

describe("resolveHeadingBreaks — the fixed-point loop", () => {
  it("does nothing when no heading is stranded", () => {
    const r = resolveHeadingBreaks({
      contentHeight: 2500,
      pageHeight: PAGE,
      blocks: [],
      headings: [heading(200, 100), heading(1200, 100)],
    });
    expect(r.forcedHeadings).toEqual([]);
    expect(r.passes).toBe(0);
    expect(r.settled).toBe(true);
    expect(r.cuts.map((c) => c.at)).toEqual([1000, 2000]);
  });

  it("pushes a stranded heading and reports the new boundary", () => {
    const r = resolveHeadingBreaks({
      contentHeight: 2500,
      pageHeight: PAGE,
      blocks: [],
      headings: [heading(950, 100)],
    });
    expect(r.forcedHeadings).toEqual([0]);
    expect(r.cuts[0]).toMatchObject({ at: 950, kind: "forced" });
    expect(r.settled).toBe(true);
  });

  it("re-solves the headings a push moved", () => {
    // Pushing the first heading drags the second one onto a page foot it was
    // clear of before. A single pass would leave it stranded.
    const r = resolveHeadingBreaks({
      contentHeight: 3000,
      pageHeight: PAGE,
      blocks: [],
      headings: [heading(950, 100), heading(1900, 100)],
    });
    expect(r.forcedHeadings).toEqual([0, 1]);
    expect(r.cuts.map((c) => c.at)).toEqual([950, 1900, 2900]);
    expect(r.passes).toBe(2);
    expect(r.settled).toBe(true);
  });

  it("stops at the pass cap and returns a self-consistent layout", () => {
    const headings = [heading(950, 100), heading(1900, 100), heading(2850, 100)];
    const capped = resolveHeadingBreaks({
      contentHeight: 4000,
      pageHeight: PAGE,
      blocks: [],
      headings,
      maxPasses: 1,
    });
    expect(capped.passes).toBe(1);
    expect(capped.settled).toBe(false);
    // Still coherent: every cut it reports comes from the forced set it applied.
    expect(capped.cuts.map((c) => c.at)).toEqual([950, 1950, 2950, 3950]);
    expect(capped.forcedHeadings).toEqual([0]);

    const full = resolveHeadingBreaks({
      contentHeight: 4000,
      pageHeight: PAGE,
      blocks: [],
      headings,
    });
    expect(full.settled).toBe(true);
    expect(full.forcedHeadings).toEqual([0, 1, 2]);
  });

  it("terminates when every heading demands more than a page", () => {
    // The pathological input: nothing can ever be satisfied. The requirement
    // guard must reject them all rather than push forever.
    const r = resolveHeadingBreaks({
      contentHeight: 5000,
      pageHeight: PAGE,
      blocks: [],
      headings: Array.from({ length: 20 }, (_, i) => heading(i * 240 + 10, PAGE * 2)),
    });
    expect(r.forcedHeadings).toEqual([]);
    expect(r.passes).toBe(0);
    expect(r.settled).toBe(true);
  });

  it("terminates on a document made entirely of stranded headings", () => {
    // Headings 4px apart across five pages: the guard against pushing a heading
    // that already begins its page is the only thing that ends this.
    const headings = Array.from({ length: 60 }, (_, i) => heading(i * 80 + 40, 200));
    const r = resolveHeadingBreaks({
      contentHeight: 5000,
      pageHeight: PAGE,
      blocks: [],
      headings,
      maxPasses: 3,
    });
    expect(r.cuts.length).toBeLessThan(200);
    // No cut may sit within the epsilon of the previous one — that is an empty page.
    const tops = [0, ...r.cuts.map((c) => c.at)];
    for (let i = 1; i < tops.length; i++) {
      expect(tops[i] - tops[i - 1]).toBeGreaterThan(PAGE_START_EPSILON_PX);
    }
  });

  it("only reports headings whose push actually cut the layout", () => {
    // Two headings, the second so close behind the first that once the first is
    // pushed it begins the same page. Stamping it would be a break the layout
    // ignored — the preview and the printer would then disagree.
    const r = resolveHeadingBreaks({
      contentHeight: 2500,
      pageHeight: PAGE,
      blocks: [],
      headings: [heading(950, 100), heading(952, 100)],
    });
    expect(r.cuts.filter((c) => c.kind === "forced").map((c) => c.at)).toEqual([950]);
    expect(r.forcedHeadings).toEqual([0]);
  });

  it("never returns a cut before the block that caused it", () => {
    // Guards the interaction: an unbreakable block AND a forced heading in the
    // same page. Whichever comes first must win, and the page must advance.
    const r = resolveHeadingBreaks({
      contentHeight: 3000,
      pageHeight: PAGE,
      blocks: [block(900, 300)],
      headings: [heading(1850, 300)],
    });
    expect(r.cuts.map((c) => [c.at, c.kind])).toEqual([
      [900, "atom"],
      [1850, "forced"],
      [2850, "flow"],
    ]);
  });
});
