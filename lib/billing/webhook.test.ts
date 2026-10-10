import { describe, expect, it } from "vitest";
import { handleBillingEvent, type BillingStore, type CompanyBillingRef, type StripeEvent, type SubscriptionWrite } from "./webhook";
import type { StripeSubscription } from "./stripe";

type Row = CompanyBillingRef & Omit<SubscriptionWrite, "stripeCustomerId" | "stripeSubscriptionId" | "subscriptionStatus"> & { eventAt: Date | null };

/** In-memory BillingStore with the same rules as the Prisma one. */
function memoryStore(companies: Array<Partial<Row> & { id: string }>, subs: Record<string, StripeSubscription> = {}) {
  const rows = new Map<string, Row>(
    companies.map((c) => [
      c.id,
      { stripeCustomerId: null, stripeSubscriptionId: null, subscriptionStatus: null, eventAt: null, ...c } as Row,
    ]),
  );
  const events = new Map<string, { type: string; companyId: string | null }>();
  const resolved: string[] = [];
  let updates = 0;
  const store: BillingStore = {
    async hasEvent(id) {
      return events.has(id);
    },
    async recordEvent({ id, type, companyId }) {
      if (!events.has(id)) events.set(id, { type, companyId });
    },
    async findCompanyById(id) {
      return rows.get(id) ?? null;
    },
    async findCompanyByCustomerId(cus) {
      return [...rows.values()].find((r) => r.stripeCustomerId === cus) ?? null;
    },
    async updateCompany(id, data, eventAt) {
      const r = rows.get(id)!;
      if (r.eventAt && r.eventAt > eventAt) return false;
      updates++;
      Object.assign(r, data, { eventAt });
      return true;
    },
    async fetchSubscription(id) {
      const s = subs[id];
      if (!s) throw new Error("no such subscription");
      return s;
    },
    onCompanyResolved(id) {
      resolved.push(id);
    },
  };
  return { store, rows, events, resolved, updates: () => updates };
}

const sub = (over: Partial<StripeSubscription> = {}): StripeSubscription => ({
  id: "sub_1",
  status: "active",
  customer: "cus_1",
  cancel_at_period_end: false,
  metadata: { companyId: "co_1" },
  items: { data: [{ current_period_end: 1_762_000_000, quantity: 1, price: { id: "price_m" } }] },
  ...over,
});

const ev = (id: string, type: string, object: unknown, created = 1_760_000_000): StripeEvent => ({
  id,
  type,
  created,
  data: { object: object as Record<string, unknown> },
});

describe("billing webhook", () => {
  it("checkout.session.completed links the customer and records the subscription", async () => {
    const m = memoryStore([{ id: "co_1" }], { sub_1: sub() });
    const r = await handleBillingEvent(
      ev("evt_1", "checkout.session.completed", { mode: "subscription", client_reference_id: "co_1", customer: "cus_1", subscription: "sub_1" }),
      m.store,
    );
    expect(r).toEqual({ outcome: "applied", companyId: "co_1" });
    const row = m.rows.get("co_1")!;
    expect(row).toMatchObject({ stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", subscriptionStatus: "active", subscriptionPriceId: "price_m" });
    expect(row.subscriptionCurrentPeriodEnd?.getTime()).toBe(1_762_000_000_000);
    expect(m.resolved).toEqual(["co_1"]); // tenant override set before writing
  });

  it("is idempotent by event id: a redelivery changes nothing", async () => {
    const m = memoryStore([{ id: "co_1", stripeCustomerId: "cus_1" }]);
    const e = ev("evt_2", "customer.subscription.updated", sub({ status: "past_due" }));
    expect((await handleBillingEvent(e, m.store)).outcome).toBe("applied");
    expect(await handleBillingEvent(e, m.store)).toEqual({ outcome: "duplicate" });
    expect(m.updates()).toBe(1);
    expect(m.events.size).toBe(1);
  });

  it("does not record an event whose handling failed, so Stripe's retry does the work", async () => {
    const m = memoryStore([{ id: "co_1" }], {}); // sub_1 cannot be fetched
    const e = ev("evt_3", "checkout.session.completed", { mode: "subscription", client_reference_id: "co_1", customer: "cus_1", subscription: "sub_1" });
    await expect(handleBillingEvent(e, m.store)).rejects.toThrow();
    expect(m.events.has("evt_3")).toBe(false);
  });

  it("a late, older event cannot undo a newer one", async () => {
    const m = memoryStore([{ id: "co_1", stripeCustomerId: "cus_1" }]);
    await handleBillingEvent(ev("evt_new", "customer.subscription.deleted", sub({ status: "canceled" }), 2000), m.store);
    const r = await handleBillingEvent(ev("evt_old", "customer.subscription.updated", sub({ status: "active" }), 1000), m.store);
    expect(r).toEqual({ outcome: "stale", companyId: "co_1" });
    expect(m.rows.get("co_1")!.subscriptionStatus).toBe("canceled");
  });

  it("subscription.deleted reads as canceled whatever the object says", async () => {
    const m = memoryStore([{ id: "co_1", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", subscriptionStatus: "active" }]);
    await handleBillingEvent(ev("evt_4", "customer.subscription.deleted", sub({ status: "active" })), m.store);
    expect(m.rows.get("co_1")!.subscriptionStatus).toBe("canceled");
  });

  it("finds the practice by customer when the metadata is missing", async () => {
    const m = memoryStore([{ id: "co_7", stripeCustomerId: "cus_7" }]);
    const r = await handleBillingEvent(ev("evt_5", "customer.subscription.created", sub({ customer: "cus_7", metadata: {} })), m.store);
    expect(r).toEqual({ outcome: "applied", companyId: "co_7" });
  });

  it("does not trust a companyId hint that names a practice linked to another customer", async () => {
    const m = memoryStore([
      { id: "co_1", stripeCustomerId: "cus_1" },
      { id: "co_2", stripeCustomerId: "cus_2" },
    ]);
    const r = await handleBillingEvent(ev("evt_6", "customer.subscription.updated", sub({ customer: "cus_2", metadata: { companyId: "co_1" } })), m.store);
    expect(r).toEqual({ outcome: "applied", companyId: "co_2" });
    expect(m.rows.get("co_1")!.subscriptionStatus).toBeNull();
  });

  it("ignores an event for a subscription the practice no longer holds", async () => {
    const m = memoryStore([{ id: "co_1", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_new", subscriptionStatus: "active" }]);
    const r = await handleBillingEvent(ev("evt_7", "customer.subscription.deleted", sub({ id: "sub_old" })), m.store);
    expect(r.outcome).toBe("ignored");
    expect(m.rows.get("co_1")!.subscriptionStatus).toBe("active");
  });

  it("invoice.payment_failed marks past_due (either invoice shape), never over canceled", async () => {
    const m = memoryStore([{ id: "co_1", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", subscriptionStatus: "active" }]);
    await handleBillingEvent(
      ev("evt_8", "invoice.payment_failed", { id: "in_1", customer: "cus_1", parent: { subscription_details: { subscription: "sub_1" } } }),
      m.store,
    );
    expect(m.rows.get("co_1")!.subscriptionStatus).toBe("past_due");

    const c = memoryStore([{ id: "co_1", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1", subscriptionStatus: "canceled" }]);
    const r = await handleBillingEvent(ev("evt_9", "invoice.payment_failed", { id: "in_2", customer: "cus_1", subscription: "sub_1" }), c.store);
    expect(r.outcome).toBe("ignored");
    expect(c.rows.get("co_1")!.subscriptionStatus).toBe("canceled");
  });

  it("acknowledges what it does not handle and what names no practice", async () => {
    const m = memoryStore([]);
    expect((await handleBillingEvent(ev("evt_10", "charge.succeeded", {}), m.store)).outcome).toBe("ignored");
    expect((await handleBillingEvent(ev("evt_11", "checkout.session.completed", { mode: "payment" }), m.store)).outcome).toBe("ignored");
    expect((await handleBillingEvent(ev("evt_12", "customer.subscription.updated", sub({ customer: "cus_x", metadata: {} })), m.store)).outcome).toBe(
      "no_company",
    );
  });
});
