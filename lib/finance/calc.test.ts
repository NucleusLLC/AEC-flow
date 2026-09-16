import { describe, expect, it } from "vitest";
import {
  ageingBucket,
  daysOverdue,
  dueDateFrom,
  invoiceStatus,
  invoiceTotals,
  lineAmount,
  nextInvoiceNumber,
  receivablesSummary,
  settlement,
} from "./calc";

const AWG = "AWG";
const EXCLUSIVE = { percent: 6, mode: "EXCLUSIVE" } as const;
const NO_TAX = { percent: 0, mode: "EXCLUSIVE" } as const;

describe("invoiceTotals", () => {
  it("adds exclusive tax on top of the taxable lines", () => {
    expect(invoiceTotals([{ amount: 1000 }, { amount: 500 }], EXCLUSIVE, AWG)).toEqual({
      subtotal: 1500,
      taxableSubtotal: 1500,
      taxTotal: 90,
      total: 1590,
    });
  });

  it("leaves a non-taxable line out of the tax but not out of the total", () => {
    expect(
      invoiceTotals([{ amount: 1000 }, { amount: 200, taxable: false }], EXCLUSIVE, AWG),
    ).toEqual({ subtotal: 1200, taxableSubtotal: 1000, taxTotal: 60, total: 1260 });
  });

  it("backs inclusive tax OUT of the amounts instead of adding it again", () => {
    // 1060 gross at 6% contains 60.00 of tax; the client still owes 1060.
    expect(invoiceTotals([{ amount: 1060 }], { percent: 6, mode: "INCLUSIVE" }, AWG)).toEqual({
      subtotal: 1060,
      taxableSubtotal: 1060,
      taxTotal: 60,
      total: 1060,
    });
  });

  it("is exact where floats are not", () => {
    // 0.1 + 0.2 in float is 0.30000000000000004.
    expect(invoiceTotals([{ amount: 0.1 }, { amount: 0.2 }], NO_TAX, AWG).subtotal).toBe(0.3);
    // A third of 0.05 at 6% rounds half-up to the cent, not toward the float.
    expect(invoiceTotals([{ amount: 12.34 }], EXCLUSIVE, AWG)).toEqual({
      subtotal: 12.34,
      taxableSubtotal: 12.34,
      taxTotal: 0.74,
      total: 13.08,
    });
  });

  it("treats empty, null and unparseable amounts as nothing rather than NaN", () => {
    expect(invoiceTotals([{ amount: null }, { amount: undefined }, { amount: "" }], EXCLUSIVE, AWG)).toEqual({
      subtotal: 0,
      taxableSubtotal: 0,
      taxTotal: 0,
      total: 0,
    });
  });

  it("takes an amount as a string, which is how Prisma hands a Decimal back", () => {
    expect(invoiceTotals([{ amount: "1000.50" }], NO_TAX, AWG).total).toBe(1000.5);
  });

  it("ignores a nonsense tax percentage instead of producing a nonsense total", () => {
    expect(invoiceTotals([{ amount: 100 }], { percent: Number.NaN, mode: "EXCLUSIVE" }, AWG).total).toBe(100);
    expect(invoiceTotals([{ amount: 100 }], { percent: -5, mode: "EXCLUSIVE" }, AWG).total).toBe(100);
  });
});

describe("lineAmount", () => {
  it("multiplies a quantity by a unit rate, to the cent", () => {
    expect(lineAmount(3, 12.5, AWG)).toBe(37.5);
    expect(lineAmount(7, 0.1, AWG)).toBe(0.7);
  });

  it("is zero when either half is missing", () => {
    expect(lineAmount(null, 12.5, AWG)).toBe(0);
    expect(lineAmount(3, null, AWG)).toBe(0);
    expect(lineAmount(Number.NaN, 12.5, AWG)).toBe(0);
  });
});

describe("settlement", () => {
  it("adds the payments up and reports what is left", () => {
    expect(settlement(1590, [{ amount: 500 }, { amount: 90 }], AWG)).toEqual({
      paid: 590,
      outstanding: 1000,
      settled: false,
      overpaidBy: 0,
    });
  });

  it("is settled when the payments cover it exactly", () => {
    expect(settlement(1000, [{ amount: 1000 }], AWG)).toEqual({
      paid: 1000,
      outstanding: 0,
      settled: true,
      overpaidBy: 0,
    });
  });

  it("never reports a negative balance, and says how much came in over", () => {
    expect(settlement(1000, [{ amount: 1200 }], AWG)).toEqual({
      paid: 1200,
      outstanding: 0,
      settled: true,
      overpaidBy: 200,
    });
  });

  it("does not call a zero invoice with no payments settled", () => {
    expect(settlement(0, [], AWG).settled).toBe(false);
  });
});

describe("invoiceStatus", () => {
  const base = { total: 1000, currency: AWG, issueDate: "2026-09-01" };

  it("leaves the two chosen states alone", () => {
    expect(invoiceStatus({ ...base, status: "DRAFT", payments: [{ amount: 1000 }] })).toBe("DRAFT");
    expect(invoiceStatus({ ...base, status: "VOID", payments: [] })).toBe("VOID");
  });

  it("follows the money for the rest", () => {
    expect(invoiceStatus({ ...base, status: "ISSUED", payments: [] })).toBe("ISSUED");
    expect(invoiceStatus({ ...base, status: "ISSUED", payments: [{ amount: 400 }] })).toBe("PART_PAID");
    expect(invoiceStatus({ ...base, status: "ISSUED", payments: [{ amount: 1000 }] })).toBe("PAID");
    // Recorded in two instalments that add up.
    expect(
      invoiceStatus({ ...base, status: "PART_PAID", payments: [{ amount: 400 }, { amount: 600 }] }),
    ).toBe("PAID");
  });

  it("does not let a stored PAID survive a deleted payment", () => {
    expect(invoiceStatus({ ...base, status: "PAID", payments: [] })).toBe("ISSUED");
  });
});

describe("nextInvoiceNumber", () => {
  it("starts the year's series at 001", () => {
    expect(nextInvoiceNumber([], 2026)).toBe("INV-2026-001");
  });

  it("continues past the highest number ever used, whatever the prefix", () => {
    expect(nextInvoiceNumber(["INV-2026-001", "INV-2026-014", "INV-2025-009"], 2026)).toBe("INV-2026-015");
    expect(nextInvoiceNumber(["2026-7", "hand typed 12"], 2026)).toBe("INV-2026-013");
  });
});

describe("dueDateFrom", () => {
  it("adds the net days, across a month end", () => {
    expect(dueDateFrom("2026-09-16", 30)).toBe("2026-10-16");
    expect(dueDateFrom("2026-01-31", 30)).toBe("2026-03-02");
    expect(dueDateFrom("2026-09-16", 0)).toBe("2026-09-16");
  });

  it("is null without an issue date or without terms", () => {
    expect(dueDateFrom(null, 30)).toBeNull();
    expect(dueDateFrom("2026-09-16", null)).toBeNull();
    expect(dueDateFrom("not a date", 30)).toBeNull();
  });
});

describe("daysOverdue and ageingBucket", () => {
  it("counts only what is still owed", () => {
    expect(daysOverdue({ dueDate: "2026-08-01", outstanding: 500 }, "2026-09-16")).toBe(46);
    expect(daysOverdue({ dueDate: "2026-08-01", outstanding: 0 }, "2026-09-16")).toBeNull();
    expect(daysOverdue({ dueDate: "2026-10-01", outstanding: 500 }, "2026-09-16")).toBeNull();
    expect(daysOverdue({ dueDate: null, outstanding: 500 }, "2026-09-16")).toBeNull();
  });

  it("buckets the way a receivables report reads", () => {
    expect(ageingBucket(null)).toBe("current");
    expect(ageingBucket(0)).toBe("current");
    expect(ageingBucket(1)).toBe("1-30");
    expect(ageingBucket(30)).toBe("1-30");
    expect(ageingBucket(31)).toBe("31-60");
    expect(ageingBucket(90)).toBe("61-90");
    expect(ageingBucket(91)).toBe("90+");
  });
});

describe("receivablesSummary", () => {
  const TODAY = "2026-09-16";

  it("counts drafts and voids without ever owing them", () => {
    const summary = receivablesSummary(
      [
        { status: "DRAFT", total: 5000, paid: 0, outstanding: 5000, dueDate: "2026-01-01" },
        { status: "VOID", total: 9000, paid: 0, outstanding: 9000, dueDate: "2026-01-01" },
        { status: "ISSUED", total: 1000, paid: 0, outstanding: 1000, dueDate: "2026-10-01" },
      ],
      TODAY,
      AWG,
    );
    expect(summary).toMatchObject({ count: 1, drafts: 1, billed: 1000, outstanding: 1000, overdue: 0 });
  });

  it("puts overdue money in its ageing bucket", () => {
    const summary = receivablesSummary(
      [
        { status: "ISSUED", total: 1000, paid: 0, outstanding: 1000, dueDate: "2026-09-10" },
        { status: "PART_PAID", total: 2000, paid: 500, outstanding: 1500, dueDate: "2026-07-01" },
        { status: "PAID", total: 400, paid: 400, outstanding: 0, dueDate: "2026-01-01" },
      ],
      TODAY,
      AWG,
    );
    expect(summary.billed).toBe(3400);
    expect(summary.paid).toBe(900);
    expect(summary.outstanding).toBe(2500);
    expect(summary.overdue).toBe(2500);
    expect(summary.ageing).toEqual({ current: 0, "1-30": 1000, "31-60": 0, "61-90": 1500, "90+": 0 });
  });

  it("sums to the cent over many rows", () => {
    const rows = Array.from({ length: 3 }, () => ({
      status: "ISSUED" as const,
      total: 33.33,
      paid: 0,
      outstanding: 33.33,
      dueDate: "2026-10-01",
    }));
    expect(receivablesSummary(rows, TODAY, AWG).outstanding).toBe(99.99);
  });
});
