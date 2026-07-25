import { describe, it, expect } from "vitest";
import { computeProposal } from "./engine";
import { resolveCostBasis, grossUpFactor, worksheetTotal } from "./basis";
import type {
  FeeComponentInput,
  ProposalCalcInput,
  DevelopmentCostItem,
} from "./types";

const USD = "USD";

function base(overrides: Partial<ProposalCalcInput> = {}): ProposalCalcInput {
  return {
    currency: USD,
    costBasis: {
      type: "ESTIMATED_CONSTRUCTION_COST",
      amount: 2_500_000,
      sourceField: "grandTotal",
    },
    feeComponents: [],
    ...overrides,
  };
}

const pct = (id: string, label: string, percent: number): FeeComponentInput => ({
  id,
  label,
  method: "PERCENT_OF_BASIS",
  category: "BASE",
  percent,
});

const fixed = (id: string, label: string, amount: number): FeeComponentInput => ({
  id,
  label,
  method: "FIXED",
  category: "BASE",
  fixedAmount: amount,
});

const codes = (d: { code: string }[]) => d.map((x) => x.code);

describe("percentage fees", () => {
  it("computes the specification's worked example", () => {
    const r = computeProposal(base({ feeComponents: [pct("a", "Architecture", 7.5)] }));
    expect(r.totals.baseFeeTotal).toBe(187_500);
    expect(r.totals.grandTotal).toBe(187_500);
    expect(r.isValid).toBe(true);
  });

  it("names the basis and the estimate field it came from", () => {
    const r = computeProposal(base({ feeComponents: [pct("a", "Architecture", 7.5)] }));
    expect(r.basis?.label).toBe("Estimated construction cost");
    expect(r.basis?.amount).toBe(2_500_000);
    expect(r.basis?.sourceField).toBe("grandTotal");
  });

  it("blocks a percentage fee with no cost basis", () => {
    const r = computeProposal(
      base({ costBasis: null, feeComponents: [pct("a", "Architecture", 7.5)] }),
    );
    expect(codes(r.errors)).toContain("PERCENT_WITHOUT_BASIS");
    expect(r.isValid).toBe(false);
  });

  it("blocks a percentage fee with no percentage entered", () => {
    const r = computeProposal(
      base({
        feeComponents: [
          { id: "a", label: "Architecture", method: "PERCENT_OF_BASIS", category: "BASE" },
        ],
      }),
    );
    expect(codes(r.errors)).toContain("PERCENT_MISSING");
  });

  it("warns when an estimate-sourced basis does not say which figure was used", () => {
    const r = computeProposal(
      base({
        costBasis: { type: "ESTIMATED_CONSTRUCTION_COST", amount: 1_000_000, sourceId: "est-1" },
        feeComponents: [pct("a", "Architecture", 5)],
      }),
    );
    expect(codes(r.warnings)).toContain("BASIS_WITHOUT_SOURCE_FIELD");
  });
});

describe("fixed fees", () => {
  it("uses the entered amount", () => {
    const r = computeProposal(base({ feeComponents: [fixed("i", "Interior design", 55_000)] }));
    expect(r.totals.baseFeeTotal).toBe(55_000);
  });

  it("blocks a fixed fee with no amount", () => {
    const r = computeProposal(
      base({ feeComponents: [{ id: "i", label: "Interior", method: "FIXED", category: "BASE" }] }),
    );
    expect(codes(r.errors)).toContain("FIXED_WITHOUT_AMOUNT");
  });
});

describe("the specification's multi-discipline example", () => {
  const input = base({
    costBasis: { type: "ESTIMATED_CONSTRUCTION_COST", amount: 3_000_000, sourceField: "direct" },
    feeComponents: [
      pct("arch", "Architecture", 6),
      fixed("int", "Interior design", 55_000),
      pct("str", "Structural engineering", 1.25),
      pct("mep", "MEP engineering", 1.75),
      {
        id: "ren",
        label: "Renderings",
        method: "FIXED",
        category: "OPTIONAL",
        fixedAmount: 12_000,
        selected: true,
      },
    ],
    reimbursables: [{ id: "r1", label: "Reimbursable allowance", amount: 5_000 }],
    discounts: [{ id: "d1", label: "Negotiated adjustment", type: "FIXED", value: 10_000 }],
  });

  it("reproduces every published figure", () => {
    const r = computeProposal(input);
    expect(r.components.find((c) => c.id === "arch")?.calculatedAmount).toBe(180_000);
    expect(r.components.find((c) => c.id === "str")?.calculatedAmount).toBe(37_500);
    expect(r.components.find((c) => c.id === "mep")?.calculatedAmount).toBe(52_500);
    expect(r.totals.baseFeeTotal).toBe(325_000);
    expect(r.totals.subtotal).toBe(342_000); // 325,000 + 12,000 optional + 5,000 reimbursable
    expect(r.totals.discountTotal).toBe(10_000);
    expect(r.totals.grandTotal).toBe(332_000); // no tax configured
  });

  it("produces an audit trail a client can follow", () => {
    const r = computeProposal(input);
    const arch = r.auditTrail.find((s) => s.label === "Architecture");
    expect(arch?.formula).toBe("3,000,000.00 x 6%");
    expect(arch?.amount).toBe(180_000);
    expect(r.auditTrail.at(-1)?.label).toBe("Grand total");
  });
});

describe("optional and additional services", () => {
  const withServices = (selected: boolean) =>
    computeProposal(
      base({
        feeComponents: [
          fixed("b", "Base design", 100_000),
          {
            id: "o",
            label: "Renderings",
            method: "FIXED",
            category: "OPTIONAL",
            fixedAmount: 12_000,
            selected,
          },
          {
            id: "x",
            label: "Rezoning support",
            method: "FIXED",
            category: "ADDITIONAL",
            fixedAmount: 8_000,
          },
        ],
      }),
    );

  it("excludes an unselected optional service from the total but still prices it", () => {
    const r = withServices(false);
    expect(r.totals.grandTotal).toBe(100_000);
    expect(r.totals.optionalServicesTotal).toBe(12_000);
    expect(r.totals.optionalUnselectedTotal).toBe(12_000);
    expect(r.totals.optionalSelectedTotal).toBe(0);
  });

  it("includes it once selected", () => {
    const r = withServices(true);
    expect(r.totals.grandTotal).toBe(112_000);
    expect(r.totals.optionalSelectedTotal).toBe(12_000);
    // Still reported separately — the client sees what the options cost.
    expect(r.totals.optionalServicesTotal).toBe(12_000);
  });

  it("never counts additional services in any total", () => {
    expect(withServices(true).totals.additionalServicesTotal).toBe(8_000);
    expect(withServices(true).totals.grandTotal).toBe(112_000);
  });
});

describe("discounts", () => {
  it("preserves the original fee alongside the discount", () => {
    const r = computeProposal(
      base({
        feeComponents: [fixed("b", "Design", 100_000)],
        discounts: [{ id: "d", label: "Repeat client", type: "PERCENT", value: 10 }],
      }),
    );
    expect(r.totals.subtotal).toBe(100_000); // original preserved
    expect(r.totals.discountTotal).toBe(10_000);
    expect(r.totals.grandTotal).toBe(90_000);
  });

  it("supports fixed discounts", () => {
    const r = computeProposal(
      base({
        feeComponents: [fixed("b", "Design", 100_000)],
        discounts: [{ id: "d", label: "Courtesy", type: "FIXED", value: 2_500 }],
      }),
    );
    expect(r.totals.grandTotal).toBe(97_500);
  });

  it("flags a negative total rather than issuing one", () => {
    const r = computeProposal(
      base({
        feeComponents: [fixed("b", "Design", 1_000)],
        discounts: [{ id: "d", label: "Oops", type: "FIXED", value: 5_000 }],
      }),
    );
    expect(codes(r.errors)).toContain("NEGATIVE_TOTAL");
    expect(r.isValid).toBe(false);
  });
});

describe("tax", () => {
  it("adds exclusive tax on the discounted subtotal", () => {
    const r = computeProposal(
      base({
        feeComponents: [fixed("b", "Design", 100_000)],
        discounts: [{ id: "d", label: "Adj", type: "FIXED", value: 10_000 }],
        taxes: [{ name: "BBO", percent: 7, mode: "EXCLUSIVE" }],
      }),
    );
    expect(r.totals.taxableSubtotal).toBe(90_000);
    expect(r.totals.taxTotal).toBe(6_300);
    expect(r.totals.grandTotal).toBe(96_300);
  });

  it("back-computes inclusive tax without inflating the total", () => {
    const r = computeProposal(
      base({
        feeComponents: [fixed("b", "Design", 107_000)],
        taxes: [{ name: "BBO", percent: 7, mode: "INCLUSIVE" }],
      }),
    );
    expect(r.totals.grandTotal).toBe(107_000); // unchanged — tax already inside
    expect(r.totals.taxTotal).toBe(7_000);
  });

  it("excludes non-taxable lines from the taxable subtotal", () => {
    const r = computeProposal(
      base({
        feeComponents: [
          fixed("b", "Design", 100_000),
          { id: "n", label: "Permit fee (pass-through)", method: "FIXED", category: "BASE", fixedAmount: 5_000, taxable: false },
        ],
        taxes: [{ name: "BBO", percent: 10, mode: "EXCLUSIVE" }],
      }),
    );
    expect(r.totals.subtotal).toBe(105_000);
    expect(r.totals.taxableSubtotal).toBe(100_000);
    expect(r.totals.taxTotal).toBe(10_000);
    expect(r.totals.grandTotal).toBe(115_000);
  });

  it("produces valid totals when no tax is configured", () => {
    const r = computeProposal(base({ feeComponents: [fixed("b", "Design", 100_000)] }));
    expect(r.totals.taxTotal).toBe(0);
    expect(Number.isNaN(r.totals.grandTotal)).toBe(false);
  });
});

describe("manual overrides", () => {
  it("keeps the calculated value and reports the delta", () => {
    const r = computeProposal(
      base({
        feeComponents: [
          { ...pct("a", "Architecture", 7.5), overrideAmount: 175_000, overrideReason: "Negotiated with client" },
        ],
      }),
    );
    const c = r.components[0];
    expect(c.calculatedAmount).toBe(187_500); // never destroyed
    expect(c.overrideAmount).toBe(175_000);
    expect(c.effectiveAmount).toBe(175_000);
    expect(c.overrideDelta).toBe(-12_500);
    expect(r.totals.grandTotal).toBe(175_000);
    expect(codes(r.warnings)).toContain("FEE_OVERRIDDEN");
  });

  it("blocks an override with no reason recorded", () => {
    const r = computeProposal(
      base({ feeComponents: [{ ...pct("a", "Architecture", 7.5), overrideAmount: 175_000 }] }),
    );
    expect(codes(r.errors)).toContain("OVERRIDE_WITHOUT_REASON");
  });
});

describe("phase allocation", () => {
  it("splits the base fee 10/15/35/40 with no rounding loss", () => {
    const r = computeProposal(
      base({
        feeComponents: [pct("a", "Architecture", 7.5)], // 187,500
        phases: [
          { id: "1", name: "Concept Design", percent: 10 },
          { id: "2", name: "Schematic Design", percent: 15 },
          { id: "3", name: "Design Development", percent: 35 },
          { id: "4", name: "Construction Documents", percent: 40 },
        ],
      }),
    );
    expect(r.phases.map((p) => p.amount)).toEqual([18_750, 28_125, 65_625, 75_000]);
    expect(r.phases.reduce((s, p) => s + p.amount, 0)).toBe(187_500);
    expect(codes(r.warnings)).not.toContain("PHASE_ALLOCATION_NOT_100");
  });

  it("warns but does not block when phases do not total 100%", () => {
    const r = computeProposal(
      base({
        feeComponents: [fixed("b", "Design", 100_000)],
        phases: [
          { id: "1", name: "Concept", percent: 10 },
          { id: "2", name: "Schematic", percent: 15 },
          { id: "3", name: "DD", percent: 32 },
          { id: "4", name: "CD", percent: 40 },
        ],
      }),
    );
    expect(codes(r.warnings)).toContain("PHASE_ALLOCATION_NOT_100");
    expect(r.isValid).toBe(true); // warning, not error
    // Shortfall stays visible rather than being silently absorbed.
    expect(r.phases.reduce((s, p) => s + p.amount, 0)).toBe(97_000);
  });

  it("reconciles exactly on an awkward fee and split", () => {
    const r = computeProposal(
      base({
        costBasis: { type: "ESTIMATED_CONSTRUCTION_COST", amount: 1_234_567.89, sourceField: "direct" },
        feeComponents: [pct("a", "Architecture", 7.33)],
        phases: [
          { id: "1", name: "A", percent: 33.33 },
          { id: "2", name: "B", percent: 33.33 },
          { id: "3", name: "C", percent: 33.34 },
        ],
      }),
    );
    const total = r.phases.reduce((s, p) => s + p.amount, 0);
    expect(Math.round(total * 100)).toBe(Math.round(r.totals.baseFeeTotal * 100));
  });
});

describe("payment schedule", () => {
  it("reconciles to the grand total", () => {
    const r = computeProposal(
      base({
        feeComponents: [fixed("b", "Design", 150_000)],
        paymentMilestones: [
          { id: "1", name: "On acceptance", percent: 10 },
          { id: "2", name: "Concept Design", percent: 15 },
          { id: "3", name: "Schematic Design", percent: 20 },
          { id: "4", name: "Design Development", percent: 25 },
          { id: "5", name: "Construction Documents", percent: 20 },
          { id: "6", name: "Construction Administration", percent: 10 },
        ],
      }),
    );
    expect(r.paymentSchedule.reduce((s, m) => s + m.amount, 0)).toBe(150_000);
  });

  it("warns when the schedule does not reconcile", () => {
    const r = computeProposal(
      base({
        feeComponents: [fixed("b", "Design", 100_000)],
        paymentMilestones: [
          { id: "1", name: "Deposit", percent: 50 },
          { id: "2", name: "Final", percent: 40 },
        ],
      }),
    );
    expect(codes(r.warnings)).toContain("PAYMENT_SCHEDULE_NOT_100");
  });
});

describe("total development cost basis and the circular-fee guard", () => {
  const worksheet: DevelopmentCostItem[] = [
    { category: "Land acquisition", amount: 800_000, includedInBasis: true },
    { category: "Building construction", amount: 2_000_000, includedInBasis: true },
    { category: "Professional fees", amount: 200_000, includedInBasis: true, isProfessionalFees: true },
    { category: "Marketing", amount: 100_000, includedInBasis: false },
  ];

  it("sums only the included categories", () => {
    expect(worksheetTotal(worksheet, USD).minor).toBe(300_000_000); // 3,000,000
  });

  it("excludes professional fees from its own basis by default", () => {
    const r = computeProposal(
      base({
        costBasis: { type: "TOTAL_DEVELOPMENT_COST", worksheet },
        feeComponents: [pct("a", "Architecture", 5)],
      }),
    );
    expect(r.basis?.amount).toBe(2_800_000); // 3,000,000 - 200,000
    expect(r.totals.baseFeeTotal).toBe(140_000);
    expect(codes(r.warnings)).toContain("CIRCULAR_BASIS_EXCLUDED");
  });

  it("grosses up when that method is chosen", () => {
    const r = computeProposal(
      base({
        costBasis: { type: "TOTAL_DEVELOPMENT_COST", worksheet, circularHandling: "GROSS_UP" },
        feeComponents: [pct("a", "Architecture", 5)],
      }),
    );
    // 2,800,000 x 0.05 / 0.95 = 147,368.42
    expect(r.totals.baseFeeTotal).toBeCloseTo(147_368.42, 2);
    expect(codes(r.warnings)).toContain("CIRCULAR_BASIS_GROSSED_UP");
  });

  it("refuses to gross up at 100% or more instead of returning Infinity", () => {
    expect(grossUpFactor(100)).toBeNull();
    expect(grossUpFactor(150)).toBeNull();
    expect(grossUpFactor(50)).toBeCloseTo(1, 10);

    const r = computeProposal(
      base({
        costBasis: { type: "TOTAL_DEVELOPMENT_COST", worksheet, circularHandling: "GROSS_UP" },
        feeComponents: [pct("a", "Architecture", 100)],
      }),
    );
    expect(codes(r.errors)).toContain("GROSS_UP_RATE_TOO_HIGH");
    expect(Number.isFinite(r.totals.grandTotal)).toBe(true);
  });

  it("does not flag circularity when professional fees are excluded from the basis", () => {
    const clean = worksheet.map((w) =>
      w.isProfessionalFees ? { ...w, includedInBasis: false } : w,
    );
    const r = computeProposal(
      base({
        costBasis: { type: "TOTAL_DEVELOPMENT_COST", worksheet: clean },
        feeComponents: [pct("a", "Architecture", 5)],
      }),
    );
    expect(r.basis?.amount).toBe(2_800_000);
    expect(codes(r.warnings)).not.toContain("CIRCULAR_BASIS_EXCLUDED");
  });
});

describe("cost basis drift", () => {
  it("reports the change without recalculating the fee", () => {
    const r = resolveCostBasis(
      {
        type: "ESTIMATED_CONSTRUCTION_COST",
        amount: 2_750_000,
        previousAmount: 2_500_000,
        sourceField: "direct",
      },
      USD,
    );
    const drift = r.warnings.find((w) => w.code === "COST_BASIS_DRIFT");
    expect(drift).toBeDefined();
    expect(drift?.message).toContain("10%");
  });

  it("stays quiet when the basis is unchanged", () => {
    const r = resolveCostBasis(
      { type: "ESTIMATED_CONSTRUCTION_COST", amount: 2_500_000, previousAmount: 2_500_000 },
      USD,
    );
    expect(r.warnings.map((w) => w.code)).not.toContain("COST_BASIS_DRIFT");
  });
});

describe("edge cases", () => {
  it("handles an empty proposal without throwing", () => {
    const r = computeProposal({ currency: USD, feeComponents: [] });
    expect(r.totals.grandTotal).toBe(0);
    expect(codes(r.warnings)).toContain("NO_FEE_COMPONENTS");
  });

  it("reports missing rate inputs rather than silently returning zero", () => {
    const r = computeProposal(
      base({
        feeComponents: [
          { id: "h", label: "Site visits", method: "HOURLY", category: "BASE" },
        ],
      }),
    );
    expect(codes(r.errors)).toContain("RATE_INPUTS_MISSING");
  });

  it("is deterministic — identical input yields identical output", () => {
    const input = base({
      feeComponents: [pct("a", "Architecture", 7.5), fixed("i", "Interior", 55_000)],
      phases: [
        { id: "1", name: "Concept", percent: 10 },
        { id: "2", name: "Schematic", percent: 15 },
        { id: "3", name: "DD", percent: 35 },
        { id: "4", name: "CD", percent: 40 },
      ],
      taxes: [{ name: "BBO", percent: 7, mode: "EXCLUSIVE" }],
    });
    expect(JSON.stringify(computeProposal(input))).toBe(JSON.stringify(computeProposal(input)));
  });
});
