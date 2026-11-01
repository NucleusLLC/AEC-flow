import { describe, expect, it } from "vitest";
import { MAX_SET_PAGES, pageBatches, pageFilename, shouldSplitSet } from "./set-split";

describe("shouldSplitSet", () => {
  it("splits a bound set, not a single sheet, not an oversize document", () => {
    expect(shouldSplitSet(1)).toBe(false);
    expect(shouldSplitSet(2)).toBe(true);
    expect(shouldSplitSet(MAX_SET_PAGES)).toBe(true);
    expect(shouldSplitSet(MAX_SET_PAGES + 1)).toBe(false);
    expect(shouldSplitSet(null)).toBe(false);
    expect(shouldSplitSet(Number.NaN)).toBe(false);
  });
});

describe("pageBatches", () => {
  it("covers every page once, in order, inclusive", () => {
    expect(pageBatches(10, 4)).toEqual([[1, 4], [5, 8], [9, 10]]);
    expect(pageBatches(4, 4)).toEqual([[1, 4]]);
    expect(pageBatches(1, 4)).toEqual([[1, 1]]);
    expect(pageBatches(0, 4)).toEqual([]);
  });

  it("survives a silly batch size", () => {
    expect(pageBatches(3, 0)).toEqual([[1, 1], [2, 2], [3, 3]]);
  });
});

describe("pageFilename", () => {
  it("keeps the set's name, pads the page to the set's width, and is always a .pdf", () => {
    expect(pageFilename("Issue-Set-Rev-C.pdf", 7, 40)).toBe("Issue-Set-Rev-C-p07.pdf");
    expect(pageFilename("set.PDF", 3, 120)).toBe("set-p003.pdf");
    expect(pageFilename("tender drawings", 1, 2)).toBe("tender drawings-p01.pdf");
  });

  it("copes with an empty name", () => {
    expect(pageFilename("", 1, 1)).toBe("set-p01.pdf");
  });
});
