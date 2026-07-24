import { describe, it, expect } from "vitest";
import {
  money,
  zero,
  fromMajor,
  toMajor,
  add,
  subtract,
  sum,
  applyPercent,
  multiply,
  allocate,
  allocateByPercent,
  clampToZero,
  compare,
  equals,
  toPlainString,
  MoneyError,
} from "./money";

const USD = "USD";
const m = (major: number) => fromMajor(major, USD);
/** Total of an allocation, in minor units — the reconciliation check. */
const totalMinor = (parts: { minor: number }[]) => parts.reduce((s, p) => s + p.minor, 0);

describe("construction and conversion", () => {
  it("converts major units to exact minor units", () => {
    expect(fromMajor(1234.5, USD).minor).toBe(123450);
    expect(fromMajor("2500000", USD).minor).toBe(250000000);
    expect(fromMajor(0, USD).minor).toBe(0);
  });

  it("treats null, undefined and empty string as zero", () => {
    expect(fromMajor(null, USD).minor).toBe(0);
    expect(fromMajor(undefined, USD).minor).toBe(0);
    expect(fromMajor("", USD).minor).toBe(0);
  });

  it("rounds sub-cent input half-up at the boundary", () => {
    // The classic float trap: 2.675 is really 2.67499999... in binary.
    expect(fromMajor(2.675, USD).minor).toBe(268);
    expect(fromMajor(0.005, USD).minor).toBe(1);
    expect(fromMajor(-0.005, USD).minor).toBe(-1);
  });

  it("round-trips through major units", () => {
    expect(toMajor(fromMajor(187500, USD))).toBe(187500);
    expect(toMajor(fromMajor(0.01, USD))).toBe(0.01);
  });

  it("rejects non-integer minor units and non-finite input", () => {
    expect(() => money(10.5, USD)).toThrow(MoneyError);
    expect(() => fromMajor(Number.NaN, USD)).toThrow(MoneyError);
    expect(() => fromMajor(Number.POSITIVE_INFINITY, USD)).toThrow(MoneyError);
  });
});

describe("arithmetic", () => {
  it("adds without float drift", () => {
    // 0.1 + 0.2 !== 0.3 in floating point; here it must be exact.
    expect(add(m(0.1), m(0.2)).minor).toBe(30);
    expect(toMajor(add(m(0.1), m(0.2)))).toBe(0.3);
  });

  it("subtracts and sums", () => {
    expect(subtract(m(100), m(37.5)).minor).toBe(6250);
    expect(sum([m(10), m(20), m(30.55)], USD).minor).toBe(6055);
    expect(sum([], USD).minor).toBe(0);
  });

  it("refuses to mix currencies", () => {
    expect(() => add(m(10), fromMajor(10, "AWG"))).toThrow(MoneyError);
    expect(() => compare(m(10), fromMajor(10, "EUR"))).toThrow(MoneyError);
  });

  it("clamps negatives to zero where a fee must not go below zero", () => {
    expect(clampToZero(m(-50)).minor).toBe(0);
    expect(clampToZero(m(50)).minor).toBe(5000);
  });

  it("compares and tests equality", () => {
    expect(compare(m(10), m(20))).toBe(-1);
    expect(compare(m(20), m(10))).toBe(1);
    expect(compare(m(10), m(10))).toBe(0);
    expect(equals(m(10), m(10))).toBe(true);
    expect(equals(m(10), fromMajor(10, "AWG"))).toBe(false);
  });
});

describe("percentages — the core fee calculation", () => {
  it("computes the specification's worked example exactly", () => {
    // 2,500,000 x 7.50% = 187,500.00
    expect(toMajor(applyPercent(m(2_500_000), 7.5))).toBe(187_500);
  });

  it("computes the multi-discipline example exactly", () => {
    const basis = m(3_000_000);
    expect(toMajor(applyPercent(basis, 6))).toBe(180_000); // Architecture
    expect(toMajor(applyPercent(basis, 1.25))).toBe(37_500); // Structural
    expect(toMajor(applyPercent(basis, 1.75))).toBe(52_500); // MEP
    const base = sum(
      [applyPercent(basis, 6), m(55_000), applyPercent(basis, 1.25), applyPercent(basis, 1.75)],
      USD,
    );
    expect(toMajor(base)).toBe(325_000); // + Interior fixed 55,000
  });

  it("rounds percentage results half-up at the cent", () => {
    expect(applyPercent(m(0.1), 5).minor).toBe(1); // 0.005 -> 1 cent
    expect(applyPercent(m(1), 33.333).minor).toBe(33);
  });

  it("handles zero and 100 percent", () => {
    expect(applyPercent(m(1000), 0).minor).toBe(0);
    expect(applyPercent(m(1000), 100).minor).toBe(100000);
  });

  it("multiplies by a factor for markups and quantities", () => {
    expect(toMajor(multiply(m(1000), 1.1))).toBe(1100);
    expect(toMajor(multiply(m(750), 3))).toBe(2250);
  });

  it("rejects non-finite rates", () => {
    expect(() => applyPercent(m(100), Number.NaN)).toThrow(MoneyError);
    expect(() => multiply(m(100), Number.POSITIVE_INFINITY)).toThrow(MoneyError);
  });
});

describe("allocate — must always reconcile exactly", () => {
  it("splits the standard architectural phase weighting", () => {
    const parts = allocate(m(100), [10, 15, 35, 40]);
    expect(parts.map(toMajor)).toEqual([10, 15, 35, 40]);
    expect(totalMinor(parts)).toBe(10000);
  });

  it("splits the specification's fixed-fee example", () => {
    // 150,000 across 15/20/35/10/20
    const parts = allocate(m(150_000), [15, 20, 35, 10, 20]);
    expect(parts.map(toMajor)).toEqual([22_500, 30_000, 52_500, 15_000, 30_000]);
    expect(totalMinor(parts)).toBe(15_000_000);
  });

  it("loses no cent on a three-way split", () => {
    const parts = allocate(m(100), [1, 1, 1]);
    expect(totalMinor(parts)).toBe(10000);
    expect(parts.map(toMajor)).toEqual([33.34, 33.33, 33.33]);
  });

  it("distributes single leftover units deterministically", () => {
    const parts = allocate(m(0.05), [50, 50]);
    expect(totalMinor(parts)).toBe(5);
    expect(parts.map(toMajor)).toEqual([0.03, 0.02]);
  });

  it("treats weights as relative shares, not required percentages", () => {
    const parts = allocate(m(1000), [1, 3]);
    expect(parts.map(toMajor)).toEqual([250, 750]);
    expect(totalMinor(parts)).toBe(100000);
  });

  it("returns zeros rather than NaN for degenerate weights", () => {
    expect(allocate(m(500), [0, 0]).map(toMajor)).toEqual([0, 0]);
    expect(allocate(m(500), [])).toEqual([]);
  });

  it("reconciles exactly for negative totals (credit notes)", () => {
    const parts = allocate(m(-100), [1, 1, 1]);
    expect(totalMinor(parts)).toBe(-10000);
  });

  it("rejects negative or non-finite weights", () => {
    expect(() => allocate(m(100), [50, -50])).toThrow(MoneyError);
    expect(() => allocate(m(100), [50, Number.NaN])).toThrow(MoneyError);
  });

  it("PROPERTY: allocation always sums to the total, over many random cases", () => {
    // Deterministic pseudo-random so a failure is reproducible.
    let seed = 42;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };

    for (let iteration = 0; iteration < 10_000; iteration += 1) {
      const totalMajor = Math.floor(next() * 5_000_000) / 100;
      const count = 1 + Math.floor(next() * 8);
      const weights = Array.from({ length: count }, () => next() * 100);
      const total = fromMajor(totalMajor, USD);

      const parts = allocate(total, weights);

      expect(totalMinor(parts)).toBe(total.minor);
      expect(parts).toHaveLength(count);
      expect(parts.every((p) => Number.isInteger(p.minor))).toBe(true);
    }
  });
});

describe("allocateByPercent — literal percentages, shortfall preserved", () => {
  it("distributes exactly when percentages total 100", () => {
    const parts = allocateByPercent(m(1000), [10, 15, 35, 40]);
    expect(parts.map(toMajor)).toEqual([100, 150, 350, 400]);
    expect(totalMinor(parts)).toBe(100000);
  });

  it("leaves a shortfall visible when percentages do not total 100", () => {
    // 97% must NOT be silently topped up — the caller reports the warning.
    const parts = allocateByPercent(m(1000), [10, 15, 32, 40]);
    expect(totalMinor(parts)).toBe(97000);
  });
});

describe("formatting", () => {
  it("renders a locale-independent plain string", () => {
    expect(toPlainString(m(1234.5))).toBe("1234.50");
    expect(toPlainString(m(0.07))).toBe("0.07");
    expect(toPlainString(m(-42))).toBe("-42.00");
    expect(toPlainString(zero(USD))).toBe("0.00");
  });
});
