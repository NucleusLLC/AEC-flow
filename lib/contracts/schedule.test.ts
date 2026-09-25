import { describe, expect, it } from "vitest";
import {
  amountInWords,
  buildSchedule,
  columnTotal,
  exchangeRateLine,
  netOfRetention,
  percentsTotalHundred,
  reconcileSchedule,
  retentionOn,
  roundPercent,
  totalPercent,
  usdFrom,
} from "./schedule";
import type { PhaseInput } from "./types";

const phase = (percent: number, over: Partial<PhaseInput> = {}): PhaseInput => ({
  phase: "",
  description: "",
  detail: "",
  percent,
  ...over,
});

describe("percentages", () => {
  it("keeps two decimals and refuses nonsense", () => {
    expect(roundPercent("33.333")).toBe(33.33);
    expect(roundPercent("12,5")).toBe(12.5);
    expect(roundPercent(-4)).toBe(0);
    expect(roundPercent(undefined)).toBe(0);
  });

  it("totals within a hundredth, because floating point is not exact", () => {
    const thirds = [phase(33.33), phase(33.33), phase(33.34)];
    expect(totalPercent(thirds)).toBe(100);
    expect(percentsTotalHundred(thirds)).toBe(true);
    expect(percentsTotalHundred([phase(40), phase(40)])).toBe(false);
  });
});

describe("the column ties to the contract sum", () => {
  it("puts the rounding remainder on the last instalment", () => {
    const built = buildSchedule({
      contractSum: 1_000_000,
      currency: "AWG",
      phases: [phase(33.33), phase(33.33), phase(33.34)],
    });
    expect(built.ties).toBe(true);
    expect(columnTotal(built.rows, "AWG")).toBe(1_000_000);
    // The odd cent lands at the end, where a contractor expects it.
    expect(built.rows[0].amountAwg).toBe(333_300);
    expect(built.rows[2].amountAwg).toBe(333_400);
  });

  it("ties on a sum that divides badly by seven", () => {
    const seven = Array.from({ length: 7 }, () => phase(100 / 7));
    const built = buildSchedule({ contractSum: 1_275_000.55, currency: "AWG", phases: seven });
    expect(columnTotal(built.rows, "AWG")).toBe(1_275_000.55);
    expect(built.ties).toBe(true);
  });

  it("still divides the whole sum when the percentages do not reach 100", () => {
    const built = buildSchedule({
      contractSum: 500_000,
      currency: "AWG",
      phases: [phase(40), phase(40)],
    });
    expect(columnTotal(built.rows, "AWG")).toBe(500_000);
    expect(built.warnings.join(" ")).toMatch(/80%, not 100%/);
  });

  it("returns nothing when no instalment was entered", () => {
    const built = buildSchedule({ contractSum: 500_000, currency: "AWG", phases: [] });
    expect(built.rows).toEqual([]);
    expect(built.warnings).toEqual([]);
    expect(built.ties).toBe(true);
  });

  it("says so when there is no contract sum, rather than printing zeroes silently", () => {
    const built = buildSchedule({ contractSum: 0, currency: "AWG", phases: [phase(100)] });
    expect(built.warnings.join(" ")).toMatch(/no contract sum/i);
    expect(built.rows[0].amountAwg).toBe(0);
  });
});

describe("the dollar column", () => {
  it("converts each row, so the column adds up on screen", () => {
    const built = buildSchedule({
      contractSum: 350_000,
      currency: "AWG",
      exchangeRate: 1.75,
      phases: [phase(50), phase(50)],
    });
    expect(built.rows[0].amountUsd).toBe(100_000);
    expect(built.totals.amountUsd).toBe(200_000);
  });

  it("defaults to the practice's 1.75 rather than guessing", () => {
    const built = buildSchedule({ contractSum: 175, currency: "AWG", phases: [phase(100)] });
    expect(built.rows[0].amountUsd).toBe(100);
    expect(exchangeRateLine(0)).toBe("Converted at 1 US$ = AWG 1.75");
  });

  it("refuses to divide by a rate of zero", () => {
    expect(usdFrom(1000, 0, "AWG")).toBe(0);
  });
});

describe("the model's words, our numbers", () => {
  it("takes the instalment names from the model and keeps the computed figures", () => {
    const built = buildSchedule({
      contractSum: 100_000,
      currency: "AWG",
      phases: [phase(50, { description: "First" }), phase(50, { description: "Second" })],
    });
    const merged = reconcileSchedule(built.rows, [
      { description: "Reservation and Initial Deposit", detail: "Within ten days of signing", amountAwg: 999 },
      { description: "Completion", amountAwg: 1 },
    ]);
    expect(merged[0].description).toBe("Reservation and Initial Deposit");
    expect(merged[0].detail).toBe("Within ten days of signing");
    expect(merged[0].amountAwg).toBe(50_000); // the model's 999 is ignored
    expect(merged[1].amountAwg).toBe(50_000);
  });

  it("keeps our words when the model supplies none", () => {
    const built = buildSchedule({
      contractSum: 100_000,
      currency: "AWG",
      phases: [phase(100, { description: "On completion" })],
    });
    expect(reconcileSchedule(built.rows, [{ description: "  " }])[0].description).toBe("On completion");
    expect(reconcileSchedule(built.rows, undefined)[0].description).toBe("On completion");
  });
});

describe("retention", () => {
  it("holds back a percentage and pays the rest", () => {
    expect(retentionOn(100_000, 10, "AWG")).toBe(10_000);
    expect(netOfRetention(100_000, 10, "AWG")).toBe(90_000);
  });

  it("is a no-op when the contract has no retention term", () => {
    expect(retentionOn(100_000, null, "AWG")).toBe(0);
    expect(netOfRetention(100_000, 0, "AWG")).toBe(100_000);
  });
});

describe("the sum in words", () => {
  it("writes the figure the way a contract writes it", () => {
    expect(amountInWords(1_275_000)).toBe(
      "one million two hundred seventy-five thousand Aruban florins and 00/100",
    );
    expect(amountInWords(1_250.5)).toBe(
      "one thousand two hundred fifty Aruban florins and 50/100",
    );
    expect(amountInWords(19)).toBe("nineteen Aruban florins and 00/100");
    expect(amountInWords(0)).toBe("zero Aruban florins and 00/100");
  });

  it("takes the currency word the contract uses", () => {
    expect(amountInWords(42, "United States dollars")).toBe(
      "forty-two United States dollars and 00/100",
    );
  });

  it("returns nothing for a figure that is not one", () => {
    expect(amountInWords(Number.NaN)).toBe("");
    expect(amountInWords(-5)).toBe("");
  });
});
