import { describe, expect, it, vi } from "vitest";
import {
  checkoutSessionParams,
  connectStatusFromAccount,
  createAccountLink,
  createInvoiceCheckoutSession,
  createStandardAccount,
  formEncode,
  platformFeeMinor,
  PLATFORM_FEE_BASIS_POINTS,
  retrieveAccount,
  STRIPE_API_VERSION,
  StripeApiError,
  stripeConfig,
  type FetchLike,
  type InvoiceCheckoutInput,
} from "./stripe";

const CFG = { secretKey: "sk_test_123" };

function fakeFetch(body: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  };
  return { impl: vi.fn(impl), calls };
}

const INPUT: InvoiceCheckoutInput = {
  account: "acct_practice1",
  companyId: "co_1",
  invoiceId: "inv_1",
  invoiceNumber: "INV-2026-007",
  practiceName: "ZenArch",
  amountMinor: 123450,
  currency: "awg",
  customerEmail: "client@example.com",
  successUrl: "https://aec-flow.com/pay/T/success?session_id={CHECKOUT_SESSION_ID}",
  cancelUrl: "https://aec-flow.com/pay/T?cancelled=1",
  expiresAt: 1_760_003_600,
};

describe("configuration", () => {
  it("is off unless BOTH keys are set", () => {
    expect(stripeConfig({})).toBeNull();
    expect(stripeConfig({ STRIPE_SECRET_KEY: "sk" })).toBeNull();
    expect(stripeConfig({ STRIPE_WEBHOOK_SECRET: "wh" })).toBeNull();
    expect(stripeConfig({ STRIPE_SECRET_KEY: " ", STRIPE_WEBHOOK_SECRET: "wh" })).toBeNull();
    expect(stripeConfig({ STRIPE_SECRET_KEY: "sk", STRIPE_WEBHOOK_SECRET: "wh" })).toEqual({ secretKey: "sk", webhookSecret: "wh" });
  });

  it("pins an explicit API version", () => {
    expect(STRIPE_API_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.[a-z]+$/);
  });

  it("takes no platform fee", () => {
    expect(PLATFORM_FEE_BASIS_POINTS).toBe(0);
    expect(platformFeeMinor(123450)).toBe(0);
  });
});

describe("form encoding", () => {
  it("flattens nested objects and arrays the way Stripe reads them, dropping null/undefined", () => {
    const s = formEncode({ a: 1, b: { c: "x y", d: undefined }, e: [{ f: true }], g: null });
    expect(decodeURIComponent(s)).toBe("a=1&b[c]=x y&e[0][f]=true");
    expect(s).toContain("b%5Bc%5D=x%20y");
  });
});

describe("REST calls", () => {
  it("creates the Checkout Session as a DIRECT CHARGE on the practice's account", async () => {
    const f = fakeFetch({ id: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1" });
    const r = await createInvoiceCheckoutSession(CFG, INPUT, f.impl);
    expect(r.url).toContain("checkout.stripe.com");
    const { url, init } = f.calls[0];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(init.method).toBe("POST");
    const h = init.headers as Record<string, string>;
    expect(h["Stripe-Account"]).toBe("acct_practice1");
    expect(h["Stripe-Version"]).toBe(STRIPE_API_VERSION);
    expect(h.Authorization).toBe("Bearer sk_test_123");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("mode")).toBe("payment");
    expect(body.get("line_items[0][price_data][unit_amount]")).toBe("123450");
    expect(body.get("line_items[0][price_data][currency]")).toBe("awg");
    expect(body.get("line_items[0][quantity]")).toBe("1");
    expect(body.get("metadata[aecflow_invoice_id]")).toBe("inv_1");
    expect(body.get("payment_intent_data[metadata][aecflow_invoice_id]")).toBe("inv_1");
    expect(body.get("client_reference_id")).toBe("inv_1");
    expect(body.get("success_url")).toBe(INPUT.successUrl);
    // Endive removed payment_method_types; a zero fee is not sent at all.
    expect([...body.keys()].some((k) => k.startsWith("payment_method_types"))).toBe(false);
    expect(body.has("payment_intent_data[application_fee_amount]")).toBe(false);
  });

  it("drops an email Stripe would reject", () => {
    expect(checkoutSessionParams({ ...INPUT, customerEmail: "not an email" }).customer_email).toBeUndefined();
    expect(checkoutSessionParams({ ...INPUT, customerEmail: null }).customer_email).toBeUndefined();
  });

  it("creates a Standard-equivalent connected account on the PLATFORM (no Stripe-Account header)", async () => {
    const f = fakeFetch({ id: "acct_new" });
    await createStandardAccount(CFG, { companyId: "co_1", email: "admin@practice.aw" }, f.impl);
    const { url, init } = f.calls[0];
    expect(url).toBe("https://api.stripe.com/v1/accounts");
    expect((init.headers as Record<string, string>)["Stripe-Account"]).toBeUndefined();
    const body = new URLSearchParams(String(init.body));
    expect(body.get("controller[stripe_dashboard][type]")).toBe("full");
    expect(body.get("controller[fees][payer]")).toBe("account");
    expect(body.get("controller[losses][payments]")).toBe("stripe");
    expect(body.get("controller[requirement_collection]")).toBe("stripe");
    expect(body.get("metadata[aecflow_company_id]")).toBe("co_1");
  });

  it("asks for an onboarding Account Link", async () => {
    const f = fakeFetch({ url: "https://connect.stripe.com/setup/x", expires_at: 1 });
    await createAccountLink(CFG, { account: "acct_1", refreshUrl: "https://r", returnUrl: "https://t" }, f.impl);
    const body = new URLSearchParams(String(f.calls[0].init.body));
    expect(body.get("type")).toBe("account_onboarding");
    expect(body.get("account")).toBe("acct_1");
  });

  it("reads an account with GET and refuses a malformed id before calling Stripe", async () => {
    const f = fakeFetch({ id: "acct_1", charges_enabled: true });
    await retrieveAccount(CFG, "acct_1", f.impl);
    expect(f.calls[0].init.method).toBe("GET");
    expect(f.calls[0].url).toBe("https://api.stripe.com/v1/accounts/acct_1");
    await expect(retrieveAccount(CFG, "acct_1/../x", f.impl)).rejects.toBeInstanceOf(StripeApiError);
    expect(f.calls).toHaveLength(1);
  });

  it("surfaces Stripe's error message and status", async () => {
    const f = fakeFetch({ error: { message: "Invalid currency", code: "parameter_invalid" } }, 400);
    await expect(createInvoiceCheckoutSession(CFG, INPUT, f.impl)).rejects.toMatchObject({
      message: "Invalid currency",
      status: 400,
      code: "parameter_invalid",
    });
  });

  it("reads the connect flags strictly", () => {
    expect(connectStatusFromAccount({ id: "a", charges_enabled: true, payouts_enabled: false, details_submitted: true })).toEqual({
      chargesEnabled: true,
      payoutsEnabled: false,
      detailsSubmitted: true,
    });
    expect(connectStatusFromAccount(null)).toEqual({ chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false });
  });
});
