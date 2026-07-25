import { describe, it, expect } from "vitest";
import { buildWriteData, nextProposalNumber } from "./persist";
import { serviceProposalInputSchema } from "./schema/proposal";

/** Parse through the real schema so the test exercises exactly what the server persists. */
function input(overrides: Record<string, unknown> = {}) {
  return serviceProposalInputSchema.parse({
    title: "Design services",
    currency: "USD",
    feeComponents: [
      { id: "a", label: "Architecture", method: "PERCENT_OF_BASIS", category: "BASE", percent: 7.5 },
    ],
    costBasis: { type: "ESTIMATED_CONSTRUCTION_COST", amount: 2_500_000, sourceField: "grandTotal" },
    ...overrides,
  });
}

describe("nextProposalNumber", () => {
  it("starts a fresh company at 001", () => {
    expect(nextProposalNumber([], 2026)).toBe("SP-2026-001");
  });

  it("increments past the highest existing number", () => {
    expect(nextProposalNumber(["SP-2026-001", "SP-2026-002"], 2026)).toBe("SP-2026-003");
  });

  it("never reuses a number even with gaps (deleted rows still counted)", () => {
    // 002 was soft-deleted but is still in the list, so the next is 004 not 002.
    expect(nextProposalNumber(["SP-2026-001", "SP-2026-003"], 2026)).toBe("SP-2026-004");
  });

  it("is not confused by digits earlier in the string", () => {
    expect(nextProposalNumber(["SP-2026-009"], 2026)).toBe("SP-2026-010");
  });
});

describe("buildWriteData — the header totals come from the engine, never the client", () => {
  it("writes engine totals onto the header", () => {
    const { header, calc } = buildWriteData(input());
    expect(header.grandTotal).toBe(187_500);
    expect(header.baseFeeTotal).toBe(187_500);
    expect(header.grandTotal).toBe(calc.totals.grandTotal);
  });

  it("snapshots the resolved cost basis amount, not the raw input", () => {
    const { header } = buildWriteData(
      input({
        costBasis: {
          type: "TOTAL_DEVELOPMENT_COST",
          worksheet: [
            { category: "Construction", amount: 2_000_000, includedInBasis: true },
            { category: "Professional fees", amount: 200_000, includedInBasis: true, isProfessionalFees: true },
          ],
        },
        feeComponents: [{ id: "a", label: "Architecture", method: "PERCENT_OF_BASIS", category: "BASE", percent: 5 }],
      }),
    );
    // Basis excludes the professional-fees line: 2,200,000 - 200,000 = 2,000,000.
    expect(header.costBasisAmount).toBe(2_000_000);
    expect(header.costBasisType).toBe("TOTAL_DEVELOPMENT_COST");
  });

  it("stamps each fee component with its engine-calculated amount", () => {
    const { children } = buildWriteData(
      input({
        feeComponents: [
          { id: "a", label: "Architecture", method: "PERCENT_OF_BASIS", category: "BASE", percent: 6 },
          { id: "i", label: "Interior", method: "FIXED", category: "BASE", fixedAmount: 55_000 },
        ],
        costBasis: { type: "ESTIMATED_CONSTRUCTION_COST", amount: 3_000_000, sourceField: "direct" },
      }),
    );
    expect(children.feeComponents[0].calculatedAmount).toBe(180_000);
    expect(children.feeComponents[1].calculatedAmount).toBe(55_000);
    // sortOrder preserves the input order.
    expect(children.feeComponents.map((c) => c.sortOrder)).toEqual([0, 1]);
  });

  it("stamps each phase and milestone with its allocated amount", () => {
    const { children } = buildWriteData(
      input({
        phases: [
          { id: "1", name: "Concept", percent: 10 },
          { id: "2", name: "Schematic", percent: 15 },
          { id: "3", name: "DD", percent: 35 },
          { id: "4", name: "CD", percent: 40 },
        ],
        paymentMilestones: [
          { id: "m1", name: "Deposit", percent: 50 },
          { id: "m2", name: "Final", percent: 50 },
        ],
      }),
    );
    expect(children.phases.map((p) => p.amount)).toEqual([18_750, 28_125, 65_625, 75_000]);
    expect(children.phases.reduce((s, p) => s + p.amount, 0)).toBe(187_500);
    expect(children.paymentMilestones.map((m) => m.amount)).toEqual([93_750, 93_750]);
  });

  it("preserves a manual override and its reason on the row", () => {
    const { children } = buildWriteData(
      input({
        feeComponents: [
          {
            id: "a",
            label: "Architecture",
            method: "PERCENT_OF_BASIS",
            category: "BASE",
            percent: 7.5,
            overrideAmount: 175_000,
            overrideReason: "Negotiated",
          },
        ],
      }),
    );
    const row = children.feeComponents[0];
    expect(row.calculatedAmount).toBe(187_500); // engine value preserved on the row
    expect(row.overrideAmount).toBe(175_000);
    expect(row.overrideReason).toBe("Negotiated");
  });

  it("converts an empty validUntil to null, not an unparseable date string", () => {
    // The schema permits "" for an unset date; Prisma would reject "" as a DateTime.
    const { header } = buildWriteData(input({ validUntil: "" }));
    expect(header.validUntil).toBeNull();
  });

  it("parses a real validUntil to a Date", () => {
    const { header } = buildWriteData(input({ validUntil: "2026-12-31" }));
    expect(header.validUntil).toBeInstanceOf(Date);
  });

  it("stores scope items, preserving the included/excluded flag", () => {
    const { header } = buildWriteData(
      input({
        scopeItems: [
          { title: "Site analysis", description: "Feasibility review", included: true, category: "BASE" },
          { title: "Full-time supervision", included: false, category: "BASE" },
        ],
      }),
    );
    const items = header.scopeItems as { title: string; included: boolean }[];
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Site analysis");
    expect(items[1].included).toBe(false);
  });

  it("maps the development-cost worksheet to rows", () => {
    const { children } = buildWriteData(
      input({
        costBasis: {
          type: "TOTAL_DEVELOPMENT_COST",
          worksheet: [
            { category: "Land", amount: 500_000, includedInBasis: false },
            { category: "Construction", amount: 2_000_000, includedInBasis: true },
          ],
        },
        feeComponents: [{ id: "a", label: "Architecture", method: "PERCENT_OF_BASIS", category: "BASE", percent: 5 }],
      }),
    );
    expect(children.developmentCostItems).toHaveLength(2);
    expect(children.developmentCostItems[0].includedInBasis).toBe(false);
    expect(children.developmentCostItems[1].category).toBe("Construction");
  });
});
