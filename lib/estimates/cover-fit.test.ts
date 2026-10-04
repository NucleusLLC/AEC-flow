import { describe, expect, it } from "vitest";
import { coverCropBox, frameRatio, normalizeCoverFit, panCoverFit, DEFAULT_COVER_FIT } from "./cover-fit";

describe("cover image framing", () => {
  it("defaults to the image's own proportions for anything unsaved or invalid", () => {
    expect(normalizeCoverFit(undefined)).toEqual(DEFAULT_COVER_FIT);
    expect(normalizeCoverFit({ frame: "21:9", x: 500, y: -4, zoom: 9 })).toEqual({ frame: "original", x: 100, y: 0, zoom: 3 });
    expect(normalizeCoverFit({ frame: "4:3", imageRatio: 1.5 })).toMatchObject({ frame: "4:3", imageRatio: 1.5 });
  });

  it("reads the ratio of each frame", () => {
    expect(frameRatio("original")).toBeNull();
    expect(frameRatio("16:9")).toBeCloseTo(16 / 9);
    expect(frameRatio("1:1")).toBe(1);
  });

  it("scales uniformly, so the image keeps its proportions in every frame", () => {
    for (const ir of [0.5, 1, 4 / 3, 16 / 9, 3]) {
      for (const fr of [1, 4 / 3, 3 / 2, 16 / 9]) {
        for (const zoom of [1, 2, 3]) {
          const b = coverCropBox(ir, fr, { x: 50, y: 50, zoom });
          // width% of frame-width / height% of frame-height × frame ratio = image ratio
          expect(((b.width / 100) * fr) / (b.height / 100)).toBeCloseTo(ir);
          // and it always covers the frame
          expect(b.width).toBeGreaterThanOrEqual(100 - 1e-9);
          expect(b.height).toBeGreaterThanOrEqual(100 - 1e-9);
        }
      }
    }
  });

  it("places the crop window at x/y and never leaves a gap", () => {
    const wide = coverCropBox(2, 1, { x: 0, y: 50, zoom: 1 });
    expect(wide).toMatchObject({ width: 200, height: 100, left: -0, top: -0 });
    expect(coverCropBox(2, 1, { x: 100, y: 50, zoom: 1 }).left).toBe(-100);
    const b = coverCropBox(2, 1, { x: 100, y: 100, zoom: 2 });
    expect(b.left + b.width).toBeCloseTo(100);
    expect(b.top + b.height).toBeCloseTo(100);
  });

  it("pans opposite to the drag and stays inside the image", () => {
    const fit = { ...DEFAULT_COVER_FIT, frame: "1:1" as const };
    // 2:1 image in a 400px square frame: 400px of horizontal slack, none vertical.
    const moved = panCoverFit(fit, 100, 80, 400, 400, 2);
    expect(moved.x).toBeCloseTo(25);
    expect(moved.y).toBe(50);
    expect(panCoverFit(fit, 10_000, 0, 400, 400, 2).x).toBe(0);
    expect(panCoverFit({ ...fit, frame: "original" }, 100, 0, 400, 400, 2)).toEqual({ ...fit, frame: "original" });
  });
});
