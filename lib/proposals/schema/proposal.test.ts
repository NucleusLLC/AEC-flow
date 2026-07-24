import { describe, it, expect, expectTypeOf } from "vitest";
import {
  parseServiceProposalInput,
  serviceProposalInputSchema,
  feeComponentSchema,
  costBasisSchema,
  type ServiceProposalInput,
} from "./proposal";
import { computeProposal } from "../engine/engine";
import type { ProposalCalcInput } from "../engine/types";

function valid(overrides: Record<string, unknown> = {}) {
  return {
    title: "Architectural design services — Palm Beach Residence",
    currency: "USD",
    feeComponents: [
      { id: "a", label: "Architecture", method: "PERCENT_OF_BASIS", category: "BASE", percent: 7.5 },
    ],
    costBasis: { type: "ESTIMATED_CONSTRUCTION_COST", amount: 2_500_000, sourceField: "grandTotal" },
    ...overrides,
  };
}

const issuePaths = (r: { ok: false; issues: { path: string }[] }) => r.issues.map((i) => i.path);

describe("structural validation", () => {
  it("accepts a well-formed proposal and applies defaults", () => {
    const r = parseServiceProposalInput(valid());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.kind).toBe("QUICK");
      expect(r.value.showFeeDerivation).toBe(true);
      expect(r.value.phases).toEqual([]);
    }
  });

  it("requires a title", () => {
    const r = parseServiceProposalInput(valid({ title: "   " }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(issuePaths(r)).toContain("title");
  });

  it("requires a 3-letter ISO currency", () => {
    expect(parseServiceProposalInput(valid({ currency: "dollars" })).ok).toBe(false);
    expect(parseServiceProposalInput(valid({ currency: "usd" })).ok).toBe(false);
    expect(parseServiceProposalInput(valid({ currency: "USD" })).ok).toBe(true);
  });

  it("rejects a negative fee amount", () => {
    const r = parseServiceProposalInput(
      valid({ feeComponents: [{ id: "b", label: "Design", method: "FIXED", category: "BASE", fixedAmount: -100 }] }),
    );
    expect(r.ok).toBe(false);
  });

  it("rejects sub-cent precision", () => {
    const r = parseServiceProposalInput(
      valid({ feeComponents: [{ id: "b", label: "Design", method: "FIXED", category: "BASE", fixedAmount: 100.005 }] }),
    );
    expect(r.ok).toBe(false);
  });

  it("rejects an invalid contact email but allows empty", () => {
    expect(parseServiceProposalInput(valid({ contactEmail: "not-an-email" })).ok).toBe(false);
    expect(parseServiceProposalInput(valid({ contactEmail: "" })).ok).toBe(true);
    expect(parseServiceProposalInput(valid({ contactEmail: "client@example.com" })).ok).toBe(true);
  });
});

describe("fee component rules", () => {
  it("requires a percentage on a percentage fee", () => {
    const r = feeComponentSchema.safeParse({
      id: "a",
      label: "Architecture",
      method: "PERCENT_OF_BASIS",
      category: "BASE",
    });
    expect(r.success).toBe(false);
  });

  it("requires an amount on a fixed fee", () => {
    const r = feeComponentSchema.safeParse({
      id: "i",
      label: "Interior",
      method: "FIXED",
      category: "BASE",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an override amount without a reason", () => {
    const r = feeComponentSchema.safeParse({
      id: "a",
      label: "Architecture",
      method: "PERCENT_OF_BASIS",
      category: "BASE",
      percent: 7.5,
      overrideAmount: 175_000,
    });
    expect(r.success).toBe(false);
  });

  it("accepts an override amount with a reason", () => {
    const r = feeComponentSchema.safeParse({
      id: "a",
      label: "Architecture",
      method: "PERCENT_OF_BASIS",
      category: "BASE",
      percent: 7.5,
      overrideAmount: 175_000,
      overrideReason: "Negotiated with client",
    });
    expect(r.success).toBe(true);
  });
});

describe("cost basis rules", () => {
  it("requires an amount for a non-development basis", () => {
    const r = costBasisSchema.safeParse({ type: "ESTIMATED_CONSTRUCTION_COST" });
    expect(r.success).toBe(false);
  });

  it("accepts a development basis with a worksheet and no explicit amount", () => {
    const r = costBasisSchema.safeParse({
      type: "TOTAL_DEVELOPMENT_COST",
      worksheet: [{ category: "Building", amount: 2_000_000, includedInBasis: true }],
    });
    expect(r.success).toBe(true);
  });
});

describe("draft tolerance", () => {
  it("allows a bare draft with no cost basis yet", () => {
    const r = parseServiceProposalInput({ title: "Draft", currency: "USD" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.costBasis ?? null).toBeNull();
  });
});

describe("schema output is engine input", () => {
  it("a validated payload computes without adaptation", () => {
    const r = parseServiceProposalInput(valid());
    expect(r.ok).toBe(true);
    if (r.ok) {
      // The whole point: no mapping layer between validation and calculation.
      const calc = computeProposal(r.value as ProposalCalcInput);
      expect(calc.totals.grandTotal).toBe(187_500);
      expect(calc.isValid).toBe(true);
    }
  });

  it("TYPE: ServiceProposalInput is assignable to ProposalCalcInput", () => {
    // Compile-time guard — if the schema drifts from the engine, this fails to typecheck.
    expectTypeOf<ServiceProposalInput>().toMatchObjectType<
      Pick<ProposalCalcInput, "currency" | "feeComponents">
    >();
  });

  it("infers a strongly-typed value", () => {
    const parsed = serviceProposalInputSchema.parse(valid());
    expectTypeOf(parsed.currency).toBeString();
    expectTypeOf(parsed.feeComponents).toBeArray();
  });
});
