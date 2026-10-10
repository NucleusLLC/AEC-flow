import { describe, expect, it } from "vitest";
import {
  checkoutAmount,
  CheckoutAmountError,
  isCardCurrencySupported,
  isOnlinePayable,
  isPayTokenShape,
  minorToMajor,
  newPayToken,
  PAY_TOKEN_BYTES,
  payUrl,
  publicBaseUrl,
} from "./pay-link";

describe("pay token", () => {
  it("is 32 random bytes as base64url: 43 URL-safe characters", () => {
    const t = newPayToken();
    expect(t).toHaveLength(43);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(t, "base64url")).toHaveLength(PAY_TOKEN_BYTES);
    expect(isPayTokenShape(t)).toBe(true);
  });

  it("is different every time", () => {
    const seen = new Set(Array.from({ length: 200 }, () => newPayToken()));
    expect(seen.size).toBe(200);
  });

  it("uses the injected source of randomness", () => {
    expect(newPayToken((n) => Buffer.alloc(n, 0xff))).toBe("_".repeat(42) + "8");
  });

  it("refuses anything not shaped like one before a lookup", () => {
    for (const bad of [undefined, null, 42, "", "abc", "a".repeat(42), "a".repeat(44), "a".repeat(42) + "=", "a".repeat(42) + "/", "../" + "a".repeat(40)]) {
      expect(isPayTokenShape(bad)).toBe(false);
    }
  });

  it("builds the public link on the app's address", () => {
    expect(payUrl(publicBaseUrl({}), "TOKEN")).toBe("https://aec-flow.com/pay/TOKEN");
    expect(payUrl(publicBaseUrl({ NEXTAUTH_URL: "https://x.test/" }), "T")).toBe("https://x.test/pay/T");
    expect(publicBaseUrl({ NEXTAUTH_URL: " ", NEXT_PUBLIC_APP_URL: "https://y.test//" })).toBe("https://y.test");
  });
});

describe("when an invoice can be paid online", () => {
  it("only ISSUED or PART_PAID with money still owing", () => {
    expect(isOnlinePayable({ status: "ISSUED", outstanding: 10 })).toBe(true);
    expect(isOnlinePayable({ status: "PART_PAID", outstanding: 0.01 })).toBe(true);
    for (const status of ["DRAFT", "PAID", "CREDITED", "VOID"]) {
      expect(isOnlinePayable({ status, outstanding: 10 })).toBe(false);
    }
    expect(isOnlinePayable({ status: "ISSUED", outstanding: 0 })).toBe(false);
  });
});

describe("checkout amount (via money.ts)", () => {
  it("converts the outstanding balance to minor units, currency lower-cased for Stripe", () => {
    expect(checkoutAmount(1234.5, "AWG")).toEqual({ minor: 123450, currency: "awg" });
    expect(checkoutAmount(0.01, "usd")).toEqual({ minor: 1, currency: "usd" });
  });

  it("is exact where floating point is not", () => {
    // 0.1 + 0.2 and 2.675 are the classic traps; fromMajor scales then rounds half-up.
    expect(checkoutAmount(0.1 + 0.2, "EUR").minor).toBe(30);
    expect(checkoutAmount(2.675, "EUR").minor).toBe(268);
    expect(checkoutAmount(19999.99, "AWG").minor).toBe(1999999);
  });

  it("refuses nothing owed", () => {
    expect(() => checkoutAmount(0, "AWG")).toThrow(CheckoutAmountError);
    expect(() => checkoutAmount(-5, "AWG")).toThrow(CheckoutAmountError);
    expect(() => checkoutAmount(0.004, "AWG")).toThrow(CheckoutAmountError);
  });

  it("supports AWG and the other two-decimal currencies; refuses zero- and three-decimal ones", () => {
    for (const c of ["AWG", "USD", "EUR", "ANG", "XCG", "GBP"]) expect(isCardCurrencySupported(c)).toBe(true);
    for (const c of ["JPY", "KRW", "ISK", "KWD", "BHD", "", "US", "usd1"]) expect(isCardCurrencySupported(c)).toBe(false);
    expect(() => checkoutAmount(100, "JPY")).toThrow(/JPY/);
  });

  it("round-trips Stripe's minor units back to the stored major amount", () => {
    expect(minorToMajor(123450, "awg")).toBe(1234.5);
    expect(minorToMajor(1, "AWG")).toBe(0.01);
    expect(() => minorToMajor(1.5, "AWG")).toThrow();
  });
});
