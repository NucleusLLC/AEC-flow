import { describe, it, expect } from "vitest";
import { computeProposal } from "./engine";
import type { FeeComponentInput, ProposalCalcInput } from "./types";

const USD = "USD";
const codes = (d: { code: string }[]) => d.map((x) => x.code);

function withFee(fee: Partial<FeeComponentInput>): ProposalCalcInput {
  return {
    currency: USD,
    feeComponents: [{ id: "f", label: "Fee", category: "BASE", method: "FIXED", ...fee } as FeeComponentInput],
  };
}

const amount = (fee: Partial<FeeComponentInput>) =>
  computeProposal(withFee(fee)).components[0]?.calculatedAmount;

describe("lump-sum methods (fixed / retainer / milestone)", () => {
  it("all pay out the entered amount", () => {
    expect(amount({ method: "FIXED", fixedAmount: 55_000 })).toBe(55_000);
    expect(amount({ method: "RETAINER", fixedAmount: 10_000 })).toBe(10_000);
    expect(amount({ method: "MILESTONE", fixedAmount: 25_000 })).toBe(25_000);
  });

  it("keep their distinct labels in the formula", () => {
    const r = computeProposal(withFee({ method: "RETAINER", fixedAmount: 10_000 }));
    expect(r.components[0].formula).toBe("Retainer");
  });

  it("error when no amount is given", () => {
    expect(codes(computeProposal(withFee({ method: "MILESTONE" })).errors)).toContain("FIXED_WITHOUT_AMOUNT");
  });
});

describe("rate methods (quantity × unit rate)", () => {
  it("hourly = hours × rate", () => {
    expect(amount({ method: "HOURLY", quantity: 120, unitRate: 150 })).toBe(18_000);
  });
  it("per area = area × rate", () => {
    expect(amount({ method: "PER_AREA", quantity: 450, unitRate: 12.5 })).toBe(5_625);
  });
  it("per unit = units × rate", () => {
    expect(amount({ method: "PER_UNIT", quantity: 24, unitRate: 3_500 })).toBe(84_000);
  });
  it("per deliverable = count × rate", () => {
    expect(amount({ method: "PER_DELIVERABLE", quantity: 8, unitRate: 750 })).toBe(6_000);
  });
  it("monthly = months × rate", () => {
    expect(amount({ method: "MONTHLY", quantity: 6, unitRate: 8_000 })).toBe(48_000);
  });

  it("holds the unit rate to the cent before multiplying", () => {
    // A rate is money: 33.335 rounds to 33.34 (half-up), then × 3 = 100.02.
    // Rates finer than a cent are not representable — acceptable for AEC fee rates.
    expect(amount({ method: "HOURLY", quantity: 3, unitRate: 33.335 })).toBe(100.02);
  });

  it("names the unit in the formula", () => {
    const r = computeProposal(withFee({ method: "HOURLY", quantity: 120, unitRate: 150 }));
    expect(r.components[0].formula).toBe("120 hours x 150.00");
  });

  it("errors when quantity or rate is missing or zero", () => {
    expect(codes(computeProposal(withFee({ method: "HOURLY", quantity: 0, unitRate: 150 })).errors)).toContain("RATE_INPUTS_MISSING");
    expect(codes(computeProposal(withFee({ method: "PER_UNIT", quantity: 10 })).errors)).toContain("RATE_INPUTS_MISSING");
  });
});

describe("markup methods (cost plus)", () => {
  it("cost plus markup = base × (1 + markup%)", () => {
    expect(amount({ method: "COST_PLUS", baseAmount: 100_000, markupPercent: 10 })).toBe(110_000);
  });
  it("subconsultant plus markup", () => {
    expect(amount({ method: "SUBCONSULTANT_PLUS_MARKUP", baseAmount: 40_000, markupPercent: 15 })).toBe(46_000);
  });
  it("treats a missing markup as zero, not an error", () => {
    expect(amount({ method: "COST_PLUS", baseAmount: 50_000 })).toBe(50_000);
  });
  it("errors when the base cost is missing", () => {
    expect(codes(computeProposal(withFee({ method: "COST_PLUS", markupPercent: 10 })).errors)).toContain("MARKUP_BASE_MISSING");
  });
  it("rounds the markup portion to the cent", () => {
    // 100.10 × 7.5% = 7.5075 → markup 7.51; total 107.61
    expect(amount({ method: "COST_PLUS", baseAmount: 100.1, markupPercent: 7.5 })).toBe(107.61);
  });
});

describe("a genuinely hybrid proposal (several methods in one proposal)", () => {
  it("combines percentage, fixed, hourly and cost-plus into one reconciled total", () => {
    const r = computeProposal({
      currency: USD,
      costBasis: { type: "ESTIMATED_CONSTRUCTION_COST", amount: 3_000_000, sourceField: "direct" },
      feeComponents: [
        { id: "a", label: "Architecture", category: "BASE", method: "PERCENT_OF_BASIS", percent: 6 },
        { id: "i", label: "Interior", category: "BASE", method: "FIXED", fixedAmount: 45_000 },
        { id: "ca", label: "Construction admin", category: "BASE", method: "MONTHLY", quantity: 10, unitRate: 8_000 },
        { id: "sv", label: "Extra site visits", category: "OPTIONAL", method: "PER_DELIVERABLE", quantity: 12, unitRate: 750, selected: false },
        { id: "sc", label: "Acoustic subconsultant", category: "BASE", method: "SUBCONSULTANT_PLUS_MARKUP", baseAmount: 20_000, markupPercent: 10 },
      ],
    });
    // 180,000 + 45,000 + 80,000 + 22,000 = 327,000 base; the optional 9,000 is excluded.
    expect(r.totals.baseFeeTotal).toBe(327_000);
    expect(r.totals.optionalServicesTotal).toBe(9_000);
    expect(r.totals.grandTotal).toBe(327_000);
    expect(r.isValid).toBe(true);
  });
});
