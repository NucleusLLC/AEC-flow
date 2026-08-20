import { describe, it, expect } from "vitest";
import {
  advanceLoadSignal,
  createLoadSignal,
  formatElapsed,
  isOverdue,
  OPEN_ESTIMATE_STAGES,
  OVERDUE_FLOOR_MS,
  progressPercent,
  SHOW_ELAPSED_AFTER_MS,
  shouldShowElapsed,
  SMOOTHER_CEILING,
  smootherFraction,
  stageBoundaries,
  type ProgressStage,
} from "./progress-loader";

/**
 * The point of these tests is the promise the loader makes to the user:
 * the bar only crosses a boundary when a stage really finished, and it never
 * claims to be finished when it is not. Both are asserted here rather than
 * eyeballed in a browser.
 */

const TWO: ProgressStage[] = [
  { id: "a", label: "A", medianMs: 900 },
  { id: "b", label: "B", medianMs: 300 },
];

describe("stageBoundaries", () => {
  it("weights each stage by its median and ends at exactly 1", () => {
    const b = stageBoundaries(TWO);
    expect(b).toHaveLength(3);
    expect(b[0]).toBe(0);
    expect(b[1]).toBeCloseTo(0.75, 10); // 900 / 1200
    expect(b[2]).toBe(1);
  });

  it("is monotonically increasing", () => {
    const b = stageBoundaries([
      { id: "a", label: "A", medianMs: 100 },
      { id: "b", label: "B", medianMs: 5 },
      { id: "c", label: "C", medianMs: 900 },
    ]);
    for (let i = 1; i < b.length; i++) expect(b[i]).toBeGreaterThan(b[i - 1]);
  });

  it("falls back to an even split when no median is usable", () => {
    const b = stageBoundaries([
      { id: "a", label: "A", medianMs: 0 },
      { id: "b", label: "B", medianMs: -1 },
    ]);
    expect(b[1]).toBeCloseTo(0.5, 10);
    expect(b[2]).toBe(1);
  });

  it("handles an empty stage list without throwing", () => {
    expect(stageBoundaries([])).toEqual([0, 1]);
  });
});

describe("smootherFraction", () => {
  it("is 0 at zero elapsed", () => {
    expect(smootherFraction(0, 900)).toBe(0);
    expect(smootherFraction(-50, 900)).toBe(0);
  });

  it("is half way through the stage at exactly the median (the half-life convention)", () => {
    expect(smootherFraction(900, 900)).toBeCloseTo(0.5, 6);
    expect(smootherFraction(1800, 900)).toBeCloseTo(0.75, 6);
  });

  it("never exceeds the ceiling, however long the stage overruns", () => {
    for (const t of [10_000, 60_000, 3_600_000, Number.MAX_SAFE_INTEGER]) {
      expect(smootherFraction(t, 900)).toBeLessThanOrEqual(SMOOTHER_CEILING);
    }
    expect(smootherFraction(3_600_000, 900)).toBe(SMOOTHER_CEILING);
  });

  it("assumes nothing when there is no usable median", () => {
    expect(smootherFraction(5_000, 0)).toBe(0);
  });

  it("only ever increases with elapsed time", () => {
    let prev = -1;
    for (let t = 0; t <= 20_000; t += 250) {
      const f = smootherFraction(t, 900);
      expect(f).toBeGreaterThanOrEqual(prev);
      prev = f;
    }
  });
});

describe("progressPercent", () => {
  it("starts at 0", () => {
    expect(progressPercent({ stages: TWO, stageIndex: 0, elapsedInStageMs: 0 })).toBe(0);
  });

  it("credits a completed stage in full and only then moves into the next", () => {
    const b = stageBoundaries(TWO);
    // The instant stage A finishes, the bar sits exactly on A's boundary.
    const atBoundary = progressPercent({ stages: TWO, stageIndex: 1, elapsedInStageMs: 0 });
    expect(atBoundary).toBeCloseTo(b[1] * 100, 6);
  });

  it("cannot creep past the next boundary no matter how long a stage takes", () => {
    const b = stageBoundaries(TWO);
    const stuck = progressPercent({ stages: TWO, stageIndex: 0, elapsedInStageMs: 10 * 60 * 1000 });
    expect(stuck).toBeLessThan(b[1] * 100);
    // …and it gets close enough to read as "nearly there", not as "dead".
    expect(stuck).toBeGreaterThan(b[1] * 100 * 0.85);
  });

  it("never reaches 100 before the work is done — for any stage and any elapsed time", () => {
    for (let i = 0; i < TWO.length; i++) {
      for (const t of [0, 1, 500, 5_000, 120_000, 86_400_000]) {
        const pct = progressPercent({ stages: TWO, stageIndex: i, elapsedInStageMs: t });
        expect(pct).toBeLessThan(100);
      }
    }
  });

  it("caps the final stage below 100 by exactly the smoother ceiling", () => {
    const b = stageBoundaries(TWO);
    const max = progressPercent({ stages: TWO, stageIndex: 1, elapsedInStageMs: 86_400_000 });
    expect(max).toBeCloseTo((b[1] + (1 - b[1]) * SMOOTHER_CEILING) * 100, 6);
  });

  it("reaches 100 only when the caller says the job is done", () => {
    expect(progressPercent({ stages: TWO, stageIndex: 0, elapsedInStageMs: 0, done: true })).toBe(100);
  });

  it("clamps a stage index that ran off the end instead of throwing", () => {
    const pct = progressPercent({ stages: TWO, stageIndex: 99, elapsedInStageMs: 0 });
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(100);
    expect(progressPercent({ stages: TWO, stageIndex: -5, elapsedInStageMs: 0 })).toBe(0);
    expect(progressPercent({ stages: [], stageIndex: 0, elapsedInStageMs: 1000 })).toBe(0);
  });

  it("never goes backwards as time and stages advance", () => {
    let prev = -1;
    for (let i = 0; i < TWO.length; i++) {
      for (let t = 0; t <= 6_000; t += 100) {
        const pct = progressPercent({ stages: TWO, stageIndex: i, elapsedInStageMs: t });
        // Within a stage it rises; crossing into the next stage restarts the
        // stage clock but starts from that stage's floor, which is >= the cap
        // the previous stage could reach.
        if (t === 0 && i > 0) prev = -1;
        expect(pct).toBeGreaterThanOrEqual(prev);
        prev = pct;
      }
    }
  });

  it("a finished stage always outranks any amount of waiting in the stage before it", () => {
    const stuckInA = progressPercent({ stages: TWO, stageIndex: 0, elapsedInStageMs: 86_400_000 });
    const justIntoB = progressPercent({ stages: TWO, stageIndex: 1, elapsedInStageMs: 0 });
    expect(justIntoB).toBeGreaterThan(stuckInA);
  });
});

describe("liveness helpers", () => {
  it("shows the elapsed counter only once the wait is worth counting", () => {
    expect(shouldShowElapsed(SHOW_ELAPSED_AFTER_MS - 1)).toBe(false);
    expect(shouldShowElapsed(SHOW_ELAPSED_AFTER_MS)).toBe(true);
  });

  it("declares a stage overdue at 4x its median, but never before the floor", () => {
    // Short stage: the floor is what protects a fast machine from being nagged.
    expect(isOverdue(4_000, 300)).toBe(false);
    expect(isOverdue(OVERDUE_FLOOR_MS + 1, 300)).toBe(true);
    // Long stage: the multiple is what governs.
    expect(isOverdue(OVERDUE_FLOOR_MS + 1, 5_000)).toBe(false);
    expect(isOverdue(20_001, 5_000)).toBe(true);
  });

  it("formats elapsed time as whole seconds, then minutes", () => {
    expect(formatElapsed(0)).toBe("0s");
    expect(formatElapsed(1_999)).toBe("1s");
    expect(formatElapsed(59_999)).toBe("59s");
    expect(formatElapsed(60_000)).toBe("1m 00s");
    expect(formatElapsed(64_000)).toBe("1m 04s");
    expect(formatElapsed(-5)).toBe("0s");
  });
});

describe("LoadSignal", () => {
  it("starts on the first stage at the given moment", () => {
    const s = createLoadSignal(1_000);
    expect(s.stageIndex).toBe(0);
    expect(s.stageStartedAt).toBe(1_000);
    expect(s.detail).toBeUndefined();
  });

  it("advances and restarts the stage clock", () => {
    const s = createLoadSignal(1_000);
    advanceLoadSignal(s, 1, "19 sections · 113 lines", 2_400);
    expect(s.stageIndex).toBe(1);
    expect(s.stageStartedAt).toBe(2_400);
    expect(s.detail).toBe("19 sections · 113 lines");
  });

  it("refuses to move backwards, so a duplicate or late call cannot rewind the bar", () => {
    const s = createLoadSignal(1_000);
    advanceLoadSignal(s, 1, undefined, 2_400);
    advanceLoadSignal(s, 1, undefined, 9_000);
    advanceLoadSignal(s, 0, undefined, 9_000);
    expect(s.stageIndex).toBe(1);
    expect(s.stageStartedAt).toBe(2_400);
  });

  it("can attach a detail without advancing", () => {
    const s = createLoadSignal(1_000);
    advanceLoadSignal(s, 0, "new sheet", 1_500);
    expect(s.stageIndex).toBe(0);
    expect(s.stageStartedAt).toBe(1_000);
    expect(s.detail).toBe("new sheet");
  });
});

describe("OPEN_ESTIMATE_STAGES", () => {
  it("gives the server round trip the larger share, matching the measured split", () => {
    const b = stageBoundaries(OPEN_ESTIMATE_STAGES);
    expect(OPEN_ESTIMATE_STAGES).toHaveLength(2);
    // 900 / (900 + 350) — see the provenance comment on the constant.
    expect(b[1]).toBeCloseTo(0.72, 2);
  });

  it("tops out in the nineties while the sheet is still being prepared", () => {
    const max = progressPercent({
      stages: OPEN_ESTIMATE_STAGES,
      stageIndex: 1,
      elapsedInStageMs: 86_400_000,
    });
    expect(max).toBeGreaterThan(90);
    expect(max).toBeLessThan(100);
  });
});
