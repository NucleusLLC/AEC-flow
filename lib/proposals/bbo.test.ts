import { describe, expect, it } from "vitest";
import {
  DEFAULT_BBO_PERCENT,
  bboAddedTo,
  bboContainedIn,
  bboNote,
  bboPerMilestone,
  bboTotal,
  resolveBbo,
} from "./bbo";

const AWG = "AWG";

describe("bboContainedIn", () => {
  it("backs the tax out of a tax-inclusive price", () => {
    // 10,000 at 7% inclusive: 10,000 − 10,000/1.07 = 654.21
    expect(bboContainedIn(10_000, 7, AWG)).toBe(654.21);
    expect(bboContainedIn(1_070, 7, AWG)).toBe(70);
  });

  it("never adds to the price — the net plus the tax is the price again", () => {
    const gross = 8_450.75;
    const tax = bboContainedIn(gross, 7, AWG);
    expect(Math.round((gross - tax) * 1.07 * 100) / 100).toBeCloseTo(gross, 2);
  });

  it("is zero for nothing, and for a rate of nothing", () => {
    expect(bboContainedIn(0, 7, AWG)).toBe(0);
    expect(bboContainedIn(null, 7, AWG)).toBe(0);
    expect(bboContainedIn(10_000, 0, AWG)).toBe(0);
    expect(bboContainedIn(10_000, Number.NaN, AWG)).toBe(0);
  });

  it("takes the string a Prisma Decimal arrives as", () => {
    expect(bboContainedIn("10000.00", 7, AWG)).toBe(654.21);
  });
});

describe("bboAddedTo", () => {
  it("puts the tax on top when the price excludes it", () => {
    expect(bboAddedTo(10_000, 7, AWG)).toBe(700);
  });
});

describe("resolveBbo", () => {
  it("states the practice rate when the proposal configured no tax", () => {
    const line = resolveBbo({ currency: AWG, grandTotal: 10_000 });
    expect(line).toEqual({
      name: "BBO",
      percent: DEFAULT_BBO_PERCENT,
      amount: 654.21,
      included: true,
      source: "default",
    });
  });

  it("prefers the engine's own figure when the proposal has tax rows", () => {
    const line = resolveBbo({
      currency: AWG,
      grandTotal: 10_000,
      taxes: [{ name: "BBO", percent: 7, mode: "INCLUSIVE" }],
      taxTotal: 654.21,
      taxableSubtotal: 10_000,
    });
    expect(line).toEqual({
      name: "BBO",
      percent: 7,
      amount: 654.21,
      included: true,
      source: "proposal",
    });
  });

  it("keeps the proposal's own name and rate, even when they differ from the default", () => {
    const line = resolveBbo({
      currency: AWG,
      grandTotal: 5_000,
      taxes: [{ name: "BBO/BAZV", percent: 6, mode: "INCLUSIVE" }],
    });
    expect(line.name).toBe("BBO/BAZV");
    expect(line.percent).toBe(6);
    expect(line.amount).toBe(bboContainedIn(5_000, 6, AWG));
    expect(line.source).toBe("proposal");
  });

  it("says so when the proposal's tax is added rather than included", () => {
    const line = resolveBbo({
      currency: AWG,
      grandTotal: 10_700,
      taxes: [{ name: "BBO", percent: 7, mode: "EXCLUSIVE" }],
      taxableSubtotal: 10_000,
    });
    expect(line.included).toBe(false);
    expect(line.amount).toBe(700);
    expect(bboNote(line)).toBe("BBO is added to the price.");
  });

  it("sums several rows and does not invent a combined name", () => {
    const line = resolveBbo({
      currency: AWG,
      grandTotal: 10_000,
      taxes: [
        { name: "BBO", percent: 1.5, mode: "INCLUSIVE" },
        { name: "BAVP", percent: 3, mode: "INCLUSIVE" },
        { name: "BAZV", percent: 2.5, mode: "INCLUSIVE" },
      ],
    });
    expect(line.percent).toBe(7);
    expect(line.name).toBe("BBO");
    expect(line.amount).toBe(bboContainedIn(10_000, 7, AWG));
  });

  it("ignores a zero-rate row rather than reporting a 0% tax", () => {
    const line = resolveBbo({
      currency: AWG,
      grandTotal: 10_000,
      taxes: [{ name: "Exempt", percent: 0, mode: "INCLUSIVE" }],
    });
    expect(line.source).toBe("default");
    expect(line.percent).toBe(DEFAULT_BBO_PERCENT);
  });

  it("recomputes when the engine figure is absent or zero", () => {
    const line = resolveBbo({
      currency: AWG,
      grandTotal: 10_000,
      taxes: [{ name: "BBO", percent: 7, mode: "INCLUSIVE" }],
      taxTotal: 0,
      taxableSubtotal: 10_000,
    });
    expect(line.amount).toBe(654.21);
    expect(line.source).toBe("proposal");
  });
});

describe("bboNote", () => {
  it("is the one sentence a client and a bookkeeper both need", () => {
    expect(bboNote({ name: "BBO", percent: 7, amount: 654.21, included: true, source: "default" })).toBe(
      "BBO is included in the price.",
    );
  });
});

describe("bboTotal", () => {
  it("adds a month of proposals to the cent", () => {
    expect(bboTotal([{ amount: 654.21 }, { amount: 131.78 }, { amount: 0.01 }], AWG)).toBe(786);
    expect(bboTotal([], AWG)).toBe(0);
  });
});

describe("bboPerMilestone", () => {
  const AWG2 = "AWG";

  it("splits the proposal's BBO across the milestones by their amounts", () => {
    const split = bboPerMilestone(
      [
        { id: "m1", amount: 3_000 },
        { id: "m2", amount: 4_000 },
        { id: "m3", amount: 3_000 },
      ],
      654.21,
      AWG2,
    );
    // 30/40/30 of 654.21 is 196.263 / 261.684 / 196.263; the flooring leaves one
    // cent, which goes to the largest remainder — the 40% milestone.
    expect(split).toEqual({ m1: 196.26, m2: 261.69, m3: 196.26 });
  });

  it("sums to the total exactly, which a per-row percentage does not promise", () => {
    const milestones = [
      { id: "a", amount: 33.33 },
      { id: "b", amount: 33.33 },
      { id: "c", amount: 33.34 },
    ];
    const total = bboContainedIn(100, 7, AWG2);
    const split = bboPerMilestone(milestones, total, AWG2);
    const summed = Object.values(split).reduce((n, v) => Math.round((n + v) * 100) / 100, 0);
    expect(summed).toBe(total);
  });

  it("gives nothing away on a zero-value milestone", () => {
    const split = bboPerMilestone(
      [
        { id: "m1", amount: 0 },
        { id: "m2", amount: 1_000 },
      ],
      70,
      AWG2,
    );
    expect(split).toEqual({ m1: 0, m2: 70 });
  });

  it("is empty for no milestones, and zero when there is no BBO", () => {
    expect(bboPerMilestone([], 654.21, AWG2)).toEqual({});
    expect(bboPerMilestone([{ id: "m1", amount: 1_000 }], 0, AWG2)).toEqual({ m1: 0 });
  });
});
