import { describe, expect, it, vi } from "vitest";
import {
  STRIPE_API_VERSION,
  StripeError,
  createCheckoutSession,
  createCustomer,
  createPortalSession,
  invoiceSubscriptionId,
  retrieveSubscription,
  subscriptionSnapshot,
  type FetchLike,
} from "./stripe";

function mockFetch(body: unknown, status = 200) {
  return vi.fn<FetchLike>(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

describe("Stripe REST wrapper (fetch mocked, no network)", () => {
  it("creates a Checkout session in subscription mode for the practice", async () => {
    const f = mockFetch({ id: "cs_1", url: "https://checkout.stripe.com/c/cs_1" });
    const res = await createCheckoutSession(
      "sk_test_x",
      { companyId: "co_1", customerId: "cus_1", priceId: "price_m", successUrl: "https://a/s", cancelUrl: "https://a/c" },
      f,
    );
    expect(res.url).toContain("checkout.stripe.com");
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(init?.method).toBe("POST");
    const h = init?.headers as Record<string, string>;
    expect(h.Authorization).toBe("Bearer sk_test_x");
    expect(h["Stripe-Version"]).toBe(STRIPE_API_VERSION);
    const form = new URLSearchParams(String(init?.body));
    expect(form.get("mode")).toBe("subscription");
    expect(form.get("customer")).toBe("cus_1");
    expect(form.get("client_reference_id")).toBe("co_1");
    expect(form.get("line_items[0][price]")).toBe("price_m");
    expect(form.get("line_items[0][quantity]")).toBe("1");
    expect(form.get("subscription_data[metadata][companyId]")).toBe("co_1");
  });

  it("creates one customer per practice (idempotency key) and a portal session", async () => {
    const f = mockFetch({ id: "cus_9" });
    await createCustomer("sk_test_x", { companyId: "co_1", name: "ZenArch", email: "a@b.c" }, f);
    const init = f.mock.calls[0][1];
    expect((init?.headers as Record<string, string>)["Idempotency-Key"]).toBe("aecflow-customer-co_1");
    expect(new URLSearchParams(String(init?.body)).get("metadata[companyId]")).toBe("co_1");

    const p = mockFetch({ id: "bps_1", url: "https://billing.stripe.com/p/session/x" });
    await createPortalSession("sk_test_x", { customerId: "cus_9", returnUrl: "https://aec-flow.com/settings/billing" }, p);
    expect(p.mock.calls[0][0]).toBe("https://api.stripe.com/v1/billing_portal/sessions");
  });

  it("throws a StripeError with Stripe's message on failure", async () => {
    const f = mockFetch({ error: { message: "No such price", code: "resource_missing" } }, 400);
    await expect(createCustomer("sk_test_x", { companyId: "co_1", name: "X" }, f)).rejects.toMatchObject({
      name: "StripeError",
      status: 400,
      code: "resource_missing",
      message: "No such price",
    });
  });

  it("refuses a malformed subscription id before calling Stripe", async () => {
    const f = mockFetch({});
    await expect(retrieveSubscription("sk_test_x", "../customers", f)).rejects.toBeInstanceOf(StripeError);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("reading Stripe objects", () => {
  it("takes current_period_end from the item (basil+) or the subscription (older)", () => {
    const basil = subscriptionSnapshot({
      id: "sub_1",
      status: "active",
      customer: "cus_1",
      cancel_at_period_end: true,
      metadata: { companyId: "co_1" },
      items: { data: [{ current_period_end: 1_760_000_000, quantity: 1, price: { id: "price_m" } }] },
    });
    expect(basil).toMatchObject({
      subscriptionId: "sub_1",
      customerId: "cus_1",
      companyIdFromMetadata: "co_1",
      status: "active",
      priceId: "price_m",
      cancelAtPeriodEnd: true,
    });
    expect(basil.currentPeriodEnd?.toISOString()).toBe(new Date(1_760_000_000_000).toISOString());

    const old = subscriptionSnapshot({ id: "sub_2", status: "unpaid", customer: { id: "cus_2" }, current_period_end: 1_700_000_000 });
    expect(old.status).toBe("past_due");
    expect(old.customerId).toBe("cus_2");
    expect(old.currentPeriodEnd?.getTime()).toBe(1_700_000_000_000);
    expect(old.priceId).toBeNull();
  });

  it("finds an invoice's subscription in either shape", () => {
    expect(invoiceSubscriptionId({ id: "in_1", customer: "cus_1", parent: { subscription_details: { subscription: "sub_1" } } })).toBe("sub_1");
    expect(invoiceSubscriptionId({ id: "in_2", customer: "cus_1", subscription: "sub_2" })).toBe("sub_2");
    expect(invoiceSubscriptionId({ id: "in_3", customer: "cus_1" })).toBeNull();
  });
});
