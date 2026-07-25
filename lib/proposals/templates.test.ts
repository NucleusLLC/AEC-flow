import { describe, it, expect } from "vitest";
import { PROPOSAL_TEMPLATES, getTemplate } from "./templates";
import { computeProposal } from "./engine/engine";
import type { ProposalCalcInput } from "./engine/types";

describe("proposal templates", () => {
  it("every template has a unique key", () => {
    const keys = PROPOSAL_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every template's phase split totals 100%", () => {
    for (const t of PROPOSAL_TEMPLATES) {
      const sum = t.phases.reduce((s, p) => s + p.percentage, 0);
      expect(sum, `${t.key} phases sum`).toBe(100);
    }
  });

  it("every template has at least one base fee line", () => {
    for (const t of PROPOSAL_TEMPLATES) {
      expect(t.fees.some((f) => f.category === "BASE"), `${t.key} has a base fee`).toBe(true);
    }
  });

  it("uses no lorem-ipsum placeholder text", () => {
    for (const t of PROPOSAL_TEMPLATES) {
      expect(t.scopeSummary.toLowerCase()).not.toContain("lorem");
      expect(t.scopeSummary.length).toBeGreaterThan(40);
    }
  });

  it("getTemplate finds a known template and misses gracefully", () => {
    expect(getTemplate("single_family_residence")?.name).toBe("Single-family residence");
    expect(getTemplate("nope")).toBeUndefined();
  });

  it("each template computes into a valid proposal", () => {
    for (const t of PROPOSAL_TEMPLATES) {
      const usesPercent = t.fees.some((f) => f.method === "PERCENT_OF_BASIS");
      const input: ProposalCalcInput = {
        currency: "USD",
        costBasis: usesPercent
          ? { type: t.defaultBasis, amount: 2_000_000, sourceField: "direct" }
          : null,
        feeComponents: t.fees.map((f, i) => ({
          id: `f${i}`,
          label: f.label,
          method: f.method,
          category: f.category,
          percent: f.percent ?? null,
          fixedAmount: f.fixedAmount ?? null,
          quantity: f.quantity ?? null,
          unitRate: f.unitRate ?? null,
        })),
        phases: t.phases.map((p, i) => ({ id: `p${i}`, name: p.name, percent: p.percentage })),
      };
      const r = computeProposal(input);
      // No blocking errors except where a rate template intentionally ships qty 0 (the user
      // fills it in) — those raise RATE_INPUTS_MISSING, which is expected guidance, not a bug.
      const realErrors = r.errors.filter((e) => e.code !== "RATE_INPUTS_MISSING");
      expect(realErrors, `${t.key} errors: ${JSON.stringify(realErrors)}`).toEqual([]);
      // Phase allocation must never warn — the splits are defined to total 100.
      expect(r.warnings.map((w) => w.code)).not.toContain("PHASE_ALLOCATION_NOT_100");
    }
  });
});
