import { describe, expect, it } from "vitest";
import {
  BILLING_ENFORCED,
  accessFor,
  bannerFor,
  canSubscribe,
  effectiveAccess,
  mapStripeStatus,
  parseBillingStatus,
} from "./status";
import { billingConfig, intervalOfPrice, isBillingConfigured, priceFor } from "./config";

describe("Stripe status → AEC-flow status", () => {
  it.each([
    ["trialing", "trialing"],
    ["active", "active"],
    ["past_due", "past_due"],
    ["unpaid", "past_due"],
    ["canceled", "canceled"],
    ["incomplete_expired", "canceled"],
    ["paused", "canceled"],
    ["incomplete", "none"],
    ["", "none"],
    [null, "none"],
    ["something_new", "none"],
    [" ACTIVE ", "active"],
  ])("%s → %s", (raw, want) => {
    expect(mapStripeStatus(raw as string | null)).toBe(want);
  });

  it("reads stored values back, unknown as none", () => {
    expect(parseBillingStatus("past_due")).toBe("past_due");
    expect(parseBillingStatus(null)).toBe("none");
    expect(parseBillingStatus("unpaid")).toBe("none");
  });
});

describe("accessFor", () => {
  it("full for trialing / active, warn for past_due, locked otherwise", () => {
    expect(accessFor("trialing")).toBe("full");
    expect(accessFor("active")).toBe("full");
    expect(accessFor("past_due")).toBe("warn");
    expect(accessFor("canceled")).toBe("locked");
    expect(accessFor("none")).toBe("locked");
  });

  it("the founder practice is always full", () => {
    for (const s of ["none", "trialing", "active", "past_due", "canceled"] as const) expect(accessFor(s, true)).toBe("full");
  });

  it("enforcement is OFF: nobody is locked today", () => {
    expect(BILLING_ENFORCED).toBe(false);
    expect(effectiveAccess("canceled")).toBe("warn");
    expect(effectiveAccess("none")).toBe("warn");
    expect(effectiveAccess("active")).toBe("full");
    // …and switching it on is what would lock.
    expect(effectiveAccess("canceled", false, true)).toBe("locked");
    expect(effectiveAccess("canceled", true, true)).toBe("full");
  });
});

describe("banner and subscribe", () => {
  it("banner only for past_due and canceled, never for the founder", () => {
    expect(bannerFor("past_due")).toBe("past_due");
    expect(bannerFor("canceled")).toBe("canceled");
    expect(bannerFor("none")).toBeNull();
    expect(bannerFor("active")).toBeNull();
    expect(bannerFor("trialing")).toBeNull();
    expect(bannerFor("past_due", true)).toBeNull();
  });

  it("subscribe is offered with no live subscription", () => {
    expect(canSubscribe("none")).toBe(true);
    expect(canSubscribe("canceled")).toBe(true);
    expect(canSubscribe("active")).toBe(false);
    expect(canSubscribe("past_due")).toBe(false);
    expect(canSubscribe("trialing")).toBe(false);
  });
});

describe("billing config", () => {
  it("is hidden without the secret key or the monthly price", () => {
    expect(billingConfig({})).toBeNull();
    expect(billingConfig({ STRIPE_SECRET_KEY: "sk_test_x" })).toBeNull();
    expect(billingConfig({ STRIPE_PRICE_ID_MONTHLY: "price_m" })).toBeNull();
    expect(isBillingConfigured({ STRIPE_SECRET_KEY: " ", STRIPE_PRICE_ID_MONTHLY: "price_m" })).toBe(false);
  });

  it("reads prices and maps a price back to its interval", () => {
    const cfg = billingConfig({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_ID_MONTHLY: "price_m", STRIPE_PRICE_ID_YEARLY: "price_y" })!;
    expect(priceFor(cfg, "monthly")).toBe("price_m");
    expect(priceFor(cfg, "yearly")).toBe("price_y");
    expect(intervalOfPrice(cfg, "price_y")).toBe("yearly");
    expect(intervalOfPrice(cfg, "price_other")).toBeNull();
    const monthlyOnly = billingConfig({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_ID_MONTHLY: "price_m" })!;
    expect(priceFor(monthlyOnly, "yearly")).toBeNull();
    expect(monthlyOnly.webhookSecret).toBeNull();
  });
});
