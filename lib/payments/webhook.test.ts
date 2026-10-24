import { describe, expect, it } from "vitest";
import {
  handleStripeEvent,
  paymentFromCheckoutSession,
  type InvoiceForPayment,
  type StripeEvent,
  type StripePaymentInput,
  type WebhookDeps,
} from "./webhook";

const ACCOUNT = "acct_practiceA";
const CREATED = Date.UTC(2026, 9, 10, 15, 30) / 1000;

function session(over: Record<string, unknown> = {}) {
  return {
    id: "cs_test_1",
    object: "checkout.session",
    payment_status: "paid",
    amount_total: 123450,
    currency: "awg",
    payment_intent: "pi_123",
    client_reference_id: "inv_1",
    metadata: { aecflow_invoice_id: "inv_1", aecflow_company_id: "co_A" },
    ...over,
  };
}

function event(over: Partial<StripeEvent> = {}, obj: Record<string, unknown> = session()): StripeEvent {
  return { id: "evt_1", type: "checkout.session.completed", created: CREATED, account: ACCOUNT, data: { object: obj }, ...over };
}

/**
 * A fake database with the one rule that matters: the PaymentIntent is UNIQUE.
 * Invoices are per company, and recording happens inside the invoice's company.
 */
function fakeDb(invoices: InvoiceForPayment[] = [{ invoiceId: "inv_1", companyId: "co_A", currency: "AWG", stripeAccountId: ACCOUNT }]) {
  const payments: (StripePaymentInput & { companyId: string; invoiceId: string })[] = [];
  const accounts = new Map<string, { chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean } | null>([[ACCOUNT, null]]);
  const deps: WebhookDeps = {
    findInvoiceForPayment: async (id) => invoices.find((i) => i.invoiceId === id) ?? null,
    recordPayment: async ({ companyId, invoiceId }, input) => {
      if (payments.some((p) => p.stripePaymentIntentId === input.stripePaymentIntentId)) return "duplicate";
      payments.push({ ...input, companyId, invoiceId });
      return "recorded";
    },
    updateAccountStatus: async (id, status) => {
      if (!accounts.has(id)) return false;
      accounts.set(id, status);
      return true;
    },
    forgetAccount: async (id) => accounts.delete(id),
  };
  return { deps, payments, accounts };
}

describe("checkout session → payment row", () => {
  it("maps a paid session to a STRIPE payment: amount from minor units, PaymentIntent as reference", () => {
    const r = paymentFromCheckoutSession(session(), "AWG", CREATED);
    expect(r).toEqual({
      ok: true,
      payment: {
        paidAt: "2026-10-10",
        amount: 1234.5,
        method: "STRIPE",
        reference: "pi_123",
        notes: "Paid online by card (Stripe Checkout cs_test_1)",
        stripePaymentIntentId: "pi_123",
      },
    });
  });

  it("accepts an expanded payment_intent object", () => {
    const r = paymentFromCheckoutSession(session({ payment_intent: { id: "pi_x" } }), "AWG", CREATED);
    expect(r.ok && r.payment.stripePaymentIntentId).toBe("pi_x");
  });

  it("refuses unpaid sessions, missing intents, bad amounts and a currency that is not the invoice's", () => {
    expect(paymentFromCheckoutSession(session({ payment_status: "unpaid" }), "AWG").ok).toBe(false);
    expect(paymentFromCheckoutSession(session({ payment_intent: null }), "AWG").ok).toBe(false);
    expect(paymentFromCheckoutSession(session({ amount_total: 0 }), "AWG").ok).toBe(false);
    expect(paymentFromCheckoutSession(session({ amount_total: 12.5 }), "AWG").ok).toBe(false);
    expect(paymentFromCheckoutSession(session({ currency: "usd" }), "AWG").ok).toBe(false);
  });
});

describe("handleStripeEvent", () => {
  it("records a completed checkout on the right invoice, inside the invoice's company", async () => {
    const db = fakeDb();
    expect(await handleStripeEvent(event(), db.deps)).toEqual({ result: "recorded" });
    expect(db.payments).toHaveLength(1);
    expect(db.payments[0]).toMatchObject({ companyId: "co_A", invoiceId: "inv_1", amount: 1234.5, method: "STRIPE" });
  });

  it("is idempotent: a replayed event (or the async-success twin) never records twice", async () => {
    const db = fakeDb();
    await handleStripeEvent(event(), db.deps);
    expect(await handleStripeEvent(event(), db.deps)).toEqual({ result: "duplicate" });
    expect(await handleStripeEvent(event({ id: "evt_2", type: "checkout.session.async_payment_succeeded" }), db.deps)).toEqual({
      result: "duplicate",
    });
    expect(db.payments).toHaveLength(1);
  });

  it("never puts one practice's money on another practice's invoice", async () => {
    const db = fakeDb();
    const r = await handleStripeEvent(event({ account: "acct_someoneElse" }), db.deps);
    expect(r.result).toBe("ignored");
    expect(db.payments).toHaveLength(0);
  });

  it("ignores platform (non-Connect) events, unknown invoices and unpaid sessions", async () => {
    const db = fakeDb();
    expect((await handleStripeEvent(event({ account: null }), db.deps)).result).toBe("ignored");
    expect(
      (await handleStripeEvent(event({}, session({ metadata: {}, client_reference_id: "inv_nope" })), db.deps)).result,
    ).toBe("ignored");
    expect((await handleStripeEvent(event({}, session({ payment_status: "unpaid" })), db.deps)).result).toBe("ignored");
    expect(db.payments).toHaveLength(0);
  });

  it("falls back to client_reference_id when metadata is missing", async () => {
    const db = fakeDb();
    expect((await handleStripeEvent(event({}, session({ metadata: undefined })), db.deps)).result).toBe("recorded");
  });

  it("reports a draft or voided invoice as ignored, not as an error Stripe would retry", async () => {
    const db = fakeDb();
    db.deps.recordPayment = async () => "refused";
    const r = await handleStripeEvent(event(), db.deps);
    expect(r).toEqual({ result: "ignored", reason: "invoice refuses payments (draft or void)" });
  });

  it("lets a database failure propagate so the route answers 500 and Stripe retries", async () => {
    const db = fakeDb();
    db.deps.recordPayment = async () => {
      throw new Error("db down");
    };
    await expect(handleStripeEvent(event(), db.deps)).rejects.toThrow("db down");
  });

  it("refreshes the connect status on account.updated", async () => {
    const db = fakeDb();
    const r = await handleStripeEvent(
      { id: "evt_3", type: "account.updated", account: ACCOUNT, data: { object: { id: ACCOUNT, charges_enabled: true, payouts_enabled: true, details_submitted: true } } },
      db.deps,
    );
    expect(r).toEqual({ result: "updated" });
    expect(db.accounts.get(ACCOUNT)).toEqual({ chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true });
    expect(
      (await handleStripeEvent({ id: "e", type: "account.updated", data: { object: { id: "acct_unknown" } } }, db.deps)).result,
    ).toBe("ignored");
  });

  it("forgets the account when the practice deauthorizes the platform", async () => {
    const db = fakeDb();
    const r = await handleStripeEvent(
      { id: "evt_4", type: "account.application.deauthorized", account: ACCOUNT, data: { object: {} } },
      db.deps,
    );
    expect(r).toEqual({ result: "updated" });
    expect(db.accounts.has(ACCOUNT)).toBe(false);
  });

  it("acknowledges and ignores every other event type", async () => {
    const db = fakeDb();
    expect((await handleStripeEvent(event({ type: "charge.refunded" }), db.deps)).result).toBe("ignored");
  });
});
