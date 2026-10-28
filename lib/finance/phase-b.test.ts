/**
 * Invoicing Phase B (0.38.0), the pure half: the discount before tax, the SENT
 * status, reversed payments counting for nothing, receipt numbers and re-issue
 * numbers. Every figure is checked to the cent through lib/finance/calc.ts.
 */
import { describe, expect, it } from "vitest";
import {
  discountAmount,
  discountProblem,
  DiscountError,
  invoiceBalance,
  invoiceStatus,
  discountedTotals,
  livePayments,
  nextReceiptNumber,
  reissueNumber,
} from "./calc";
import { fromMajor, toMajor } from "@/lib/proposals/engine/money";
import { parseInvoiceInput } from "./schema";
import { buildTaxReport } from "./tax-report";
import { OPEN_STATUSES } from "./types";

const AWG = "AWG";
const EXCL = { percent: 0, mode: "EXCLUSIVE" as const };

describe("discount before tax", () => {
  it("no discount leaves every figure exactly as before", () => {
    const lines = [{ amount: 1000 }, { amount: 250, taxable: false }];
    const plain = discountedTotals(lines, { percent: 7, mode: "EXCLUSIVE" }, AWG);
    const none = discountedTotals(lines, { percent: 7, mode: "EXCLUSIVE" }, AWG, { type: null, value: 10 });
    expect(none).toEqual(plain);
    expect(plain).toEqual({ subtotal: 1250, discountTotal: 0, taxableSubtotal: 1000, taxTotal: 70, tax2Total: 0, total: 1320 });
  });

  it("PERCENT comes off the subtotal and the tax is charged on what is left (exclusive)", () => {
    const t = discountedTotals([{ amount: 1000 }], { percent: 7, mode: "EXCLUSIVE" }, AWG, { type: "PERCENT", value: 10 });
    expect(t).toEqual({ subtotal: 1000, discountTotal: 100, taxableSubtotal: 900, taxTotal: 63, tax2Total: 0, total: 963 });
  });

  it("AMOUNT comes off as typed", () => {
    const t = discountedTotals([{ amount: 1000 }], { percent: 7, mode: "EXCLUSIVE" }, AWG, { type: "AMOUNT", value: 250 });
    expect(t).toMatchObject({ discountTotal: 250, taxableSubtotal: 750, taxTotal: 52.5, total: 802.5 });
  });

  it("rounds a percentage half-up to the cent", () => {
    // 33.33 × 15% = 4.9995 → 5.00
    const t = discountedTotals([{ amount: 33.33 }], EXCL, AWG, { type: "PERCENT", value: 15 });
    expect(t.discountTotal).toBe(5);
    expect(t.total).toBe(28.33);
    // 0.1 + 0.2 lines, 50% → 0.15 exactly, no float drift
    expect(discountedTotals([{ amount: 0.1 }, { amount: 0.2 }], EXCL, AWG, { type: "PERCENT", value: 50 }).total).toBe(0.15);
  });

  it("splits the discount between taxed and untaxed lines in proportion, to the cent", () => {
    // 100.00 taxed + 33.33 untaxed; 10% = 13.33, split 10.00 : 3.33.
    const t = discountedTotals(
      [{ amount: 100 }, { amount: 33.33, taxable: false }],
      { percent: 7, mode: "EXCLUSIVE" },
      AWG,
      { type: "PERCENT", value: 10 },
    );
    expect(t.discountTotal).toBe(13.33);
    expect(t.taxableSubtotal).toBe(90);
    expect(t.taxTotal).toBe(6.3);
    // subtotal − discount + tax
    expect(t.total).toBe(toMajor(fromMajor(133.33 - 13.33 + 6.3, AWG)));
  });

  it("a 100% discount leaves no base, no tax and nothing to pay", () => {
    const t = discountedTotals(
      [{ amount: 500 }, { amount: 120, taxable: false }],
      { percent: 3, mode: "EXCLUSIVE", percent2: 4 },
      AWG,
      { type: "PERCENT", value: 100 },
    );
    expect(t).toEqual({ subtotal: 620, discountTotal: 620, taxableSubtotal: 0, taxTotal: 0, tax2Total: 0, total: 0 });
  });

  it("a discount larger than the subtotal is refused, never clamped", () => {
    expect(() => discountedTotals([{ amount: 100 }], EXCL, AWG, { type: "AMOUNT", value: 100.01 })).toThrow(DiscountError);
    expect(discountProblem([{ amount: 100 }], { type: "AMOUNT", value: 100.01 }, AWG)).toBe(
      "The discount cannot be more than the subtotal",
    );
    // Exactly the subtotal is allowed.
    expect(discountedTotals([{ amount: 100 }], EXCL, AWG, { type: "AMOUNT", value: 100 }).total).toBe(0);
  });

  it("refuses a negative discount and a percentage over 100", () => {
    expect(() => discountAmount(fromMajor(100, AWG), { type: "PERCENT", value: 100.5 })).toThrow(
      "A discount percentage runs from 0 to 100",
    );
    expect(() => discountAmount(fromMajor(100, AWG), { type: "AMOUNT", value: -1 })).toThrow("A discount cannot be negative");
    expect(discountProblem([{ amount: 100 }], { type: "PERCENT", value: 20 }, AWG)).toBeNull();
  });

  it("two taxes are both charged on the discounted base, never on each other", () => {
    // 1000 less 10% = 900; BBO 3% = 27, BAVP 4% = 36.
    const t = discountedTotals([{ amount: 1000 }], { percent: 3, mode: "EXCLUSIVE", percent2: 4 }, AWG, {
      type: "PERCENT",
      value: 10,
    });
    expect(t).toEqual({ subtotal: 1000, discountTotal: 100, taxableSubtotal: 900, taxTotal: 27, tax2Total: 36, total: 963 });
  });

  it("INCLUSIVE: the discount comes off the gross amounts and the tax is backed out of what is left", () => {
    // 1070 gross at 7% inclusive, less 70 → 1000 gross; contains 65.42 tax.
    const t = discountedTotals([{ amount: 1070 }], { percent: 7, mode: "INCLUSIVE" }, AWG, { type: "AMOUNT", value: 70 });
    expect(t.discountTotal).toBe(70);
    expect(t.total).toBe(1000);
    expect(t.taxableSubtotal).toBe(1000);
    expect(t.taxTotal).toBe(65.42);
  });

  it("INCLUSIVE with two taxes: the parts still add back to one combined contained tax", () => {
    const t = discountedTotals([{ amount: 214 }], { percent: 3, mode: "INCLUSIVE", percent2: 4 }, AWG, {
      type: "PERCENT",
      value: 50,
    });
    // 107 gross at 7% contains 7.00: 3.00 + 4.00.
    expect(t).toMatchObject({ discountTotal: 107, total: 107, taxTotal: 3, tax2Total: 4 });
  });

  it("the zod gate refuses an impossible discount with a sentence", () => {
    const base = {
      clientName: "Client",
      currency: "AWG",
      lines: [{ description: "Fee", amount: 100 }],
    };
    const bad = parseInvoiceInput({ ...base, discountType: "AMOUNT", discountValue: 150 });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.issues.map((i) => i.message)).toContain("The discount cannot be more than the subtotal");
    const good = parseInvoiceInput({ ...base, discountType: "PERCENT", discountValue: "12.5" });
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.value).toMatchObject({ discountType: "PERCENT", discountValue: 12.5 });
    const none = parseInvoiceInput({ ...base, discountType: "", discountValue: "" });
    expect(none.ok && none.value.discountType).toBe(null);
  });

  it("the tax report's untaxed figure is net of the discount", () => {
    const totals = discountedTotals([{ amount: 1000 }, { amount: 200, taxable: false }], { percent: 7, mode: "EXCLUSIVE" }, AWG, {
      type: "PERCENT",
      value: 10,
    });
    const report = buildTaxReport(
      [
        {
          id: "i",
          number: "INV-1",
          status: "ISSUED",
          currency: AWG,
          clientName: "C",
          issueDate: "2026-09-10",
          ...totals,
          taxName: "BBO",
          taxPercent: 7,
          taxMode: "EXCLUSIVE",
          payments: [],
        },
      ],
      { from: null, to: null },
    );
    const row = report.invoiced[0];
    // 1200 − 120 = 1080 net of discount; 900 taxed at 7% = 63; 180 untaxed.
    expect(row.lines[0]).toMatchObject({ base: 900, tax: 63 });
    expect(row.untaxed).toBe(180);
    expect(row.gross).toBe(1143);
  });
});

describe("SENT", () => {
  const sent = { status: "SENT" as const, total: 100, currency: AWG, credits: [] };

  it("is open, like ISSUED", () => {
    expect(OPEN_STATUSES).toEqual(["ISSUED", "SENT", "PART_PAID"]);
  });

  it("stays SENT with nothing paid, and money derives PART_PAID / PAID from it exactly as from ISSUED", () => {
    expect(invoiceStatus({ ...sent, payments: [] })).toBe("SENT");
    expect(invoiceStatus({ ...sent, payments: [{ amount: 40 }] })).toBe("PART_PAID");
    expect(invoiceStatus({ ...sent, payments: [{ amount: 100 }] })).toBe("PAID");
    expect(invoiceStatus({ ...sent, status: "ISSUED", payments: [] })).toBe("ISSUED");
  });

  it("a reversed payment sends it back to SENT", () => {
    expect(invoiceStatus({ ...sent, payments: [{ amount: 100, reversedAt: "2026-10-01T00:00:00Z" }] })).toBe("SENT");
  });
});

describe("reversed payments count for nothing", () => {
  it("are left out of the balance", () => {
    const payments = [{ amount: 60 }, { amount: 40, reversedAt: "2026-10-02T10:00:00Z" }];
    expect(livePayments(payments)).toEqual([{ amount: 60 }]);
    expect(invoiceBalance({ total: 100, currency: AWG, payments })).toMatchObject({ paid: 60, outstanding: 40, settled: false });
  });
});

describe("receipt numbers", () => {
  it("are RCT-{year}-{NNN}, one past the highest ever used, reversed ones included", () => {
    expect(nextReceiptNumber([], 2026)).toBe("RCT-2026-001");
    expect(nextReceiptNumber(["RCT-2025-007", "RCT-2026-003"], 2026)).toBe("RCT-2026-008");
    expect(nextReceiptNumber(["RCT-2026-999"], 2026)).toBe("RCT-2026-1000");
  });
});

describe("re-issue numbers", () => {
  it("are <root>-2, then -3, never reusing one", () => {
    expect(reissueNumber("INV-2026-004", ["INV-2026-004"])).toBe("INV-2026-004-2");
    expect(reissueNumber("INV-2026-004", ["INV-2026-004", "INV-2026-004-2"])).toBe("INV-2026-004-3");
    // A deleted -3 draft is still in the list of every number ever used.
    expect(reissueNumber("INV-2026-004", ["INV-2026-004-2", "INV-2026-004-3"])).toBe("INV-2026-004-4");
  });

  it("ignores numbers that merely start the same way", () => {
    expect(reissueNumber("INV-2026-004", ["INV-2026-0045", "INV-2026-004-2a", "INV-2026-004-x"])).toBe("INV-2026-004-2");
  });
});
