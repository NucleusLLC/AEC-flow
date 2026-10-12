import { describe, expect, it } from "vitest";
import { invoiceTotals } from "./calc";
import { milestoneBasis, milestoneInvoiceLines, type MilestoneBasisInput } from "./proposal-billing";

const AWG = "AWG";
const notTaxedLabel = (name: string) => `${name} (not taxed)`;

/** A proposal of 1,000.00 + 7% BBO = 1,070.00, paid 50 / 30 / 20. */
const exclusive: MilestoneBasisInput = {
  currency: AWG,
  grandTotal: 1070,
  taxTotal: 70,
  taxableSubtotal: 1000,
  taxes: [{ name: "BBO", percent: 7, mode: "EXCLUSIVE" }],
  milestones: [
    { id: "a", amount: 535 },
    { id: "b", amount: 321 },
    { id: "c", amount: 214 },
  ],
};

/** What the invoice for one whole milestone comes to. */
function invoiceFor(input: MilestoneBasisInput, id: string) {
  const basis = milestoneBasis(input);
  const { billable, taxable } = basis.amounts[id];
  const lines = milestoneInvoiceLines(
    { id, name: "Stage", remaining: billable, billable, taxable },
    { currency: input.currency, taxPercent: basis.taxPercent, notTaxedLabel },
  );
  return { basis, lines, totals: invoiceTotals(lines, { percent: basis.taxPercent, mode: basis.taxMode }, input.currency) };
}

describe("a tax that is added on top of the price", () => {
  it("bills a milestone for what the proposal says, not for the tax twice", () => {
    // The bug: a 535.00 milestone became a 535.00 line plus 7% = 572.45.
    const { basis, lines, totals } = invoiceFor(exclusive, "a");
    expect(basis).toMatchObject({ taxName: "BBO", taxPercent: 7, taxMode: "EXCLUSIVE", taxOnTop: true, warnings: [] });
    expect(lines).toEqual([{ description: "Stage", milestoneId: "a", milestoneName: "Stage", amount: 500, taxable: true }]);
    expect(totals).toEqual({ subtotal: 500, taxableSubtotal: 500, taxTotal: 35, total: 535 });
  });

  it("makes every milestone, invoiced in turn, add up to the proposal's grand total", () => {
    const totals = ["a", "b", "c"].map((id) => invoiceFor(exclusive, id).totals);
    expect(totals.map((t) => t.total)).toEqual([535, 321, 214]);
    expect(totals.reduce((n, t) => n + t.subtotal, 0)).toBe(1000);
    expect(totals.reduce((n, t) => n + t.taxTotal, 0)).toBe(70);
  });

  it("splits the net across milestones so it sums to the proposal's net exactly", () => {
    const basis = milestoneBasis({
      ...exclusive,
      grandTotal: 107,
      taxTotal: 7,
      taxableSubtotal: 100,
      milestones: [
        { id: "a", amount: 35.67 },
        { id: "b", amount: 35.67 },
        { id: "c", amount: 35.66 },
      ],
    });
    const nets = Object.values(basis.amounts).map((x) => x.billable);
    expect(nets).toEqual([33.34, 33.33, 33.33]);
    expect(Math.round(nets.reduce((n, x) => n + x, 0) * 100)).toBe(10000);
  });

  it("keeps the untaxed part of the proposal untaxed, as a second line on the same milestone", () => {
    // 1,000.00 of fees taxed at 7%, 200.00 of reimbursables not taxed: 1,270.00.
    const mixed: MilestoneBasisInput = {
      ...exclusive,
      grandTotal: 1270,
      taxTotal: 70,
      taxableSubtotal: 1000,
      milestones: [
        { id: "a", amount: 635 },
        { id: "b", amount: 635 },
      ],
    };
    const { lines, totals } = invoiceFor(mixed, "a");
    expect(lines).toEqual([
      { description: "Stage", milestoneId: "a", milestoneName: "Stage", amount: 500, taxable: true },
      { description: "Stage (not taxed)", milestoneId: "a", milestoneName: "Stage", amount: 100, taxable: false },
    ]);
    expect(totals).toEqual({ subtotal: 600, taxableSubtotal: 500, taxTotal: 35, total: 635 });
  });

  it("bills only what is left of a milestone that was partly invoiced", () => {
    const basis = milestoneBasis(exclusive);
    const { billable, taxable } = basis.amounts.a;
    const lines = milestoneInvoiceLines(
      { id: "a", name: "Stage", remaining: 200, billable, taxable },
      { currency: AWG, taxPercent: 7, notTaxedLabel },
    );
    expect(lines.map((l) => [l.amount, l.taxable])).toEqual([[200, true]]);
    expect(milestoneInvoiceLines({ id: "a", name: "Stage", remaining: 0, billable, taxable }, { currency: AWG, taxPercent: 7, notTaxedLabel })).toEqual([]);
  });

  it("does not hand the whole net to a schedule that only bills part of the proposal", () => {
    // 50% + 30% = 80% of 1,070.00: the two milestones carry 80% of the net.
    const basis = milestoneBasis({ ...exclusive, milestones: exclusive.milestones.slice(0, 2) });
    expect(basis.amounts).toEqual({ a: { billable: 500, taxable: 500 }, b: { billable: 300, taxable: 300 } });
  });

  it("combines two added taxes into the one tax line an invoice has, and says so", () => {
    const { basis, totals } = invoiceFor(
      {
        ...exclusive,
        grandTotal: 1090,
        taxTotal: 90,
        taxes: [
          { name: "BBO", percent: 7, mode: "EXCLUSIVE" },
          { name: "BAVP", percent: 2, mode: "EXCLUSIVE" },
        ],
        milestones: [{ id: "a", amount: 1090 }],
      },
      "a",
    );
    expect(basis).toMatchObject({ taxName: "BBO + BAVP", taxPercent: 9, taxMode: "EXCLUSIVE", taxOnTop: true });
    expect(basis.warnings).toHaveLength(1);
    expect(totals.total).toBe(1090);
  });
});

describe("a tax that is included in the price", () => {
  it("leaves the milestone amounts alone and backs the tax out of them", () => {
    const { basis, lines, totals } = invoiceFor(
      {
        currency: AWG,
        grandTotal: 1070,
        taxTotal: 70,
        taxableSubtotal: 1070,
        taxes: [{ name: "BBO", percent: 7, mode: "INCLUSIVE" }],
        milestones: [
          { id: "a", amount: 535 },
          { id: "b", amount: 535 },
        ],
      },
      "a",
    );
    expect(basis).toMatchObject({ taxPercent: 7, taxMode: "INCLUSIVE", taxOnTop: false });
    expect(lines.map((l) => [l.amount, l.taxable])).toEqual([[535, true]]);
    expect(totals).toEqual({ subtotal: 535, taxableSubtotal: 535, taxTotal: 35, total: 535 });
  });
});

describe("the edges", () => {
  it("bills the milestone as it stands when the proposal has no tax", () => {
    for (const taxes of [[], [{ name: "BBO", percent: 0, mode: "EXCLUSIVE" as const }]]) {
      const { basis, lines, totals } = invoiceFor(
        { currency: AWG, grandTotal: 1000, taxTotal: 0, taxableSubtotal: 1000, taxes, milestones: [{ id: "a", amount: 400 }] },
        "a",
      );
      expect(basis).toMatchObject({ taxPercent: 0, taxOnTop: false, warnings: [] });
      expect(lines.map((l) => l.amount)).toEqual([400]);
      expect(totals.total).toBe(400);
    }
  });

  it("adds no tax, and warns, when one proposal mixes an included tax with an added one", () => {
    const { basis, totals } = invoiceFor(
      {
        currency: AWG,
        grandTotal: 1090,
        taxTotal: 90,
        taxableSubtotal: 1000,
        taxes: [
          { name: "BBO", percent: 7, mode: "EXCLUSIVE" },
          { name: "BAVP", percent: 2, mode: "INCLUSIVE" },
        ],
        milestones: [{ id: "a", amount: 1090 }],
      },
      "a",
    );
    expect(basis).toMatchObject({ taxName: null, taxPercent: 0, taxOnTop: false });
    expect(basis.warnings).toHaveLength(1);
    expect(totals.total).toBe(1090);
  });

  it("survives a proposal with no milestones, a zero total and junk figures", () => {
    expect(milestoneBasis({ ...exclusive, milestones: [] }).amounts).toEqual({});
    const zeroed = milestoneBasis({ ...exclusive, grandTotal: 0, taxTotal: 0, taxableSubtotal: 0, milestones: [{ id: "a", amount: 0 }] });
    expect(zeroed.amounts).toEqual({ a: { billable: 0, taxable: 0 } });
    const junk = milestoneBasis({ ...exclusive, grandTotal: null, taxTotal: undefined, taxableSubtotal: "", milestones: [{ id: "a", amount: null }] });
    expect(junk.amounts).toEqual({ a: { billable: 0, taxable: 0 } });
  });
});
