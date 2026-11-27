import { describe, expect, it } from "vitest";
import {
  APPROVAL_REQUIRED_REFUSAL,
  DEFAULT_APPROVAL_THRESHOLDS,
  canApproveProposals,
  checkApproval,
  describeTripped,
  discountPercent,
  feeLimitIn,
  figuresChanged,
  isAwaitingApproval,
  parseApprovalThresholds,
  sendRefusal,
  type ApprovalFigures,
} from "./approval";

const thr = DEFAULT_APPROVAL_THRESHOLDS; // 10% / 50,000 AWG

function fig(over: Partial<ApprovalFigures> = {}): ApprovalFigures {
  return { currency: "AWG", subtotal: 20_000, discountTotal: 0, grandTotal: 20_000, ...over };
}

describe("parseApprovalThresholds", () => {
  it("defaults to 10% and 50,000 AWG", () => {
    expect(parseApprovalThresholds(undefined)).toEqual({ maxDiscountPercent: 10, maxFee: 50_000, currency: "AWG" });
  });
  it("takes the fallback currency when none was stored", () => {
    expect(parseApprovalThresholds({}, "usd").currency).toBe("USD");
  });
  it("clamps bad values", () => {
    expect(parseApprovalThresholds({ maxDiscountPercent: 250, maxFee: -5, currency: "eur" })).toEqual({
      maxDiscountPercent: 100,
      maxFee: 0,
      currency: "EUR",
    });
    expect(parseApprovalThresholds({ maxDiscountPercent: "abc", maxFee: "12.345" })).toMatchObject({
      maxDiscountPercent: 10,
      maxFee: 12.35,
    });
  });
});

describe("checkApproval — discount rule", () => {
  it("does not trip at exactly the limit", () => {
    const c = checkApproval(fig({ discountTotal: 2_000, grandTotal: 18_000 }), thr);
    expect(c.required).toBe(false);
  });
  it("trips one cent above the limit", () => {
    const c = checkApproval(fig({ discountTotal: 2_000.01, grandTotal: 17_999.99 }), thr);
    expect(c.required).toBe(true);
    expect(c.tripped).toEqual([{ rule: "discount", percent: 10, limit: 10 }]);
  });
  it("reports the percentage to one decimal", () => {
    expect(discountPercent(fig({ discountTotal: 3_000 }))).toBe(15);
    expect(discountPercent(fig({ subtotal: 30_000, discountTotal: 3_500 }))).toBe(11.7);
  });
  it("treats a discount on a zero subtotal as over any limit", () => {
    expect(checkApproval(fig({ subtotal: 0, discountTotal: 10, grandTotal: 0 }), thr).required).toBe(true);
  });
  it("no discount never trips", () => {
    expect(checkApproval(fig(), thr).required).toBe(false);
  });
});

describe("checkApproval — fee rule", () => {
  it("does not trip at exactly 50,000", () => {
    expect(checkApproval(fig({ subtotal: 50_000, grandTotal: 50_000 }), thr).required).toBe(false);
  });
  it("trips above 50,000", () => {
    const c = checkApproval(fig({ subtotal: 50_000.01, grandTotal: 50_000.01 }), thr);
    expect(c.tripped).toEqual([
      { rule: "fee", amount: 50_000.01, currency: "AWG", limit: 50_000, limitCurrency: "AWG" },
    ]);
  });
  it("either rule is enough, and both are reported", () => {
    const c = checkApproval(fig({ subtotal: 80_000, discountTotal: 16_000, grandTotal: 64_000 }), thr);
    expect(c.tripped.map((r) => r.rule)).toEqual(["discount", "fee"]);
  });
  it("converts the limit into a pegged currency (50,000 AWG = 27,932.96 USD)", () => {
    expect(feeLimitIn("USD", thr)).toEqual({ minor: 2_793_296, currency: "USD" });
    expect(checkApproval({ currency: "USD", subtotal: 28_000, discountTotal: 0, grandTotal: 28_000 }, thr).required).toBe(true);
    expect(checkApproval({ currency: "USD", subtotal: 27_000, discountTotal: 0, grandTotal: 27_000 }, thr).required).toBe(false);
  });
  it("skips the fee rule when there is no rate, but still applies the discount rule", () => {
    const big = { currency: "XCD", subtotal: 9_000_000, discountTotal: 0, grandTotal: 9_000_000 };
    const c = checkApproval(big, thr);
    expect(c).toEqual({ required: false, tripped: [], feeCompared: false });
    expect(checkApproval({ ...big, discountTotal: 2_000_000, grandTotal: 7_000_000 }, thr).required).toBe(true);
  });
});

describe("who approves", () => {
  it("Director, Admin and the founder; never Staff or Manager", () => {
    expect(canApproveProposals("DIRECTOR", false)).toBe(true);
    expect(canApproveProposals("ADMIN", false)).toBe(true);
    expect(canApproveProposals("STAFF", true)).toBe(true);
    expect(canApproveProposals("STAFF", false)).toBe(false);
    expect(canApproveProposals("MANAGER", false)).toBe(false);
    expect(canApproveProposals("VIEWER", false)).toBe(false);
  });
});

describe("sending and invalidation", () => {
  const over = checkApproval(fig({ discountTotal: 3_000, grandTotal: 17_000 }), thr);
  const under = checkApproval(fig(), thr);

  it("refuses to send over a limit without an approval", () => {
    expect(sendRefusal(over, null)).toBe(APPROVAL_REQUIRED_REFUSAL);
    expect(sendRefusal(over, "u1")).toBeNull();
    expect(sendRefusal(under, null)).toBeNull();
  });
  it("is awaiting approval only before sending", () => {
    expect(isAwaitingApproval("DRAFT", over, null)).toBe(true);
    expect(isAwaitingApproval("APPROVED_FOR_ISSUE", over, null)).toBe(true);
    expect(isAwaitingApproval("REVISED", over, null)).toBe(true);
    expect(isAwaitingApproval("DRAFT", over, "u1")).toBe(false);
    expect(isAwaitingApproval("SENT", over, null)).toBe(false);
    expect(isAwaitingApproval("DRAFT", under, null)).toBe(false);
  });
  it("any change to fee, discount or currency counts as a change", () => {
    const a = fig({ discountTotal: 3_000, grandTotal: 17_000 });
    expect(figuresChanged(a, { ...a })).toBe(false);
    expect(figuresChanged(a, { ...a, grandTotal: 17_000.000001 })).toBe(false); // float noise
    expect(figuresChanged(a, { ...a, grandTotal: 17_000.01 })).toBe(true);
    expect(figuresChanged(a, { ...a, discountTotal: 2_999 })).toBe(true);
    expect(figuresChanged(a, { ...a, subtotal: 20_001 })).toBe(true);
    expect(figuresChanged(a, { ...a, currency: "USD" })).toBe(true);
  });
  it("describes the tripped rules", () => {
    const c = checkApproval(fig({ subtotal: 80_000, discountTotal: 12_000, grandTotal: 68_000 }), thr);
    expect(describeTripped(c.tripped, (n, cur) => `${cur} ${n}`)).toBe("discount 15% > 10%; fee AWG 68000 > AWG 50000");
  });
});
