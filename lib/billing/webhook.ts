/**
 * What each Stripe billing event does to a practice's subscription record.
 *
 * Storage is injected (`BillingStore`), so the rules — which company an event
 * belongs to, idempotency, out-of-order protection — are tested without a
 * database (webhook.test.ts). lib/data/billing.ts is the Prisma implementation.
 *
 * IDEMPOTENT BY EVENT ID: an event already recorded is acknowledged and skipped.
 * It is recorded only AFTER it was applied, so a failure part-way returns 500,
 * Stripe retries, and the retry does the work. Two deliveries racing each other
 * are harmless: both write the same values.
 *
 * OUT OF ORDER: Stripe does not promise order. Each write carries the event's
 * `created` time and the store refuses to overwrite a newer one, so a late
 * "subscription.updated: active" cannot undo an earlier-processed "deleted".
 */
import type { BillingStatus } from "./status";
import {
  idOf,
  invoiceSubscriptionId,
  subscriptionSnapshot,
  type StripeInvoice,
  type StripeSubscription,
  type SubscriptionSnapshot,
} from "./stripe";

export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
] as const;

export type StripeEvent = {
  id: string;
  type: string;
  created: number;
  livemode?: boolean;
  data: { object: Record<string, unknown> };
};

export type CompanyBillingRef = {
  id: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
};

export type SubscriptionWrite = {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: BillingStatus;
  subscriptionPriceId?: string | null;
  subscriptionCurrentPeriodEnd?: Date | null;
  subscriptionCancelAtPeriodEnd?: boolean;
};

export interface BillingStore {
  /** Has this event id been applied already? */
  hasEvent(eventId: string): Promise<boolean>;
  /** Record it as applied (a duplicate insert is ignored). */
  recordEvent(event: { id: string; type: string; companyId: string | null }): Promise<void>;
  findCompanyById(id: string): Promise<CompanyBillingRef | null>;
  findCompanyByCustomerId(customerId: string): Promise<CompanyBillingRef | null>;
  /**
   * Write billing fields, unless the company already holds a write from a LATER
   * event (`eventAt` newer than this one). Returns false when skipped as stale.
   */
  updateCompany(companyId: string, data: SubscriptionWrite, eventAt: Date): Promise<boolean>;
  /** Fetch a subscription from Stripe (checkout.session.completed only carries its id). */
  fetchSubscription(id: string): Promise<StripeSubscription>;
  /** Called once the event's company is known, before any write (tenant override). */
  onCompanyResolved?(companyId: string): void;
}

export type HandleResult =
  | { outcome: "duplicate" }
  | { outcome: "ignored"; reason: string }
  | { outcome: "applied"; companyId: string }
  | { outcome: "stale"; companyId: string }
  | { outcome: "no_company"; reason: string };

function writeFromSnapshot(s: SubscriptionSnapshot): SubscriptionWrite {
  return {
    ...(s.customerId ? { stripeCustomerId: s.customerId } : {}),
    stripeSubscriptionId: s.subscriptionId,
    subscriptionStatus: s.status,
    subscriptionPriceId: s.priceId,
    subscriptionCurrentPeriodEnd: s.currentPeriodEnd,
    subscriptionCancelAtPeriodEnd: s.cancelAtPeriodEnd,
  };
}

/** The practice an event belongs to: our own id first (metadata / client_reference_id), then the customer. */
async function resolveCompany(
  store: BillingStore,
  companyIdHint: string | null,
  customerId: string | null,
): Promise<CompanyBillingRef | null> {
  if (companyIdHint) {
    const c = await store.findCompanyById(companyIdHint);
    // A hint naming a company already linked to a DIFFERENT customer is not trusted.
    if (c && (!c.stripeCustomerId || !customerId || c.stripeCustomerId === customerId)) return c;
  }
  if (customerId) return store.findCompanyByCustomerId(customerId);
  return null;
}

export async function handleBillingEvent(event: StripeEvent, store: BillingStore): Promise<HandleResult> {
  if (!event?.id || !event.type) return { outcome: "ignored", reason: "malformed event" };
  if (!(HANDLED_EVENTS as readonly string[]).includes(event.type)) {
    return { outcome: "ignored", reason: `unhandled type ${event.type}` };
  }
  if (await store.hasEvent(event.id)) return { outcome: "duplicate" };

  const eventAt = new Date((event.created || Math.floor(Date.now() / 1000)) * 1000);
  const obj = event.data?.object ?? {};
  let company: CompanyBillingRef | null = null;
  let write: SubscriptionWrite | null = null;

  switch (event.type) {
    case "checkout.session.completed": {
      if (obj.mode !== "subscription") return { outcome: "ignored", reason: "not a subscription checkout" };
      const customerId = idOf(obj.customer as string | { id: string } | null);
      const subId = idOf(obj.subscription as string | { id: string } | null);
      const hint =
        (typeof obj.client_reference_id === "string" && obj.client_reference_id) ||
        ((obj.metadata as Record<string, string> | null)?.companyId ?? null);
      company = await resolveCompany(store, hint || null, customerId);
      if (!company) return { outcome: "no_company", reason: "checkout session names no known practice" };
      store.onCompanyResolved?.(company.id);
      if (subId) {
        const snap = subscriptionSnapshot(await store.fetchSubscription(subId));
        write = writeFromSnapshot(snap);
        if (customerId) write.stripeCustomerId = customerId;
      } else {
        write = customerId ? { stripeCustomerId: customerId } : {};
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const snap = subscriptionSnapshot(obj as unknown as StripeSubscription);
      company = await resolveCompany(store, snap.companyIdFromMetadata, snap.customerId);
      if (!company) return { outcome: "no_company", reason: "subscription names no known practice" };
      store.onCompanyResolved?.(company.id);
      // A practice holds one subscription. An event for a different, older one
      // (e.g. the deletion of a replaced subscription) must not overwrite it.
      if (
        company.stripeSubscriptionId &&
        company.stripeSubscriptionId !== snap.subscriptionId &&
        event.type !== "customer.subscription.created" &&
        company.subscriptionStatus !== "canceled"
      ) {
        return { outcome: "ignored", reason: "event for a subscription the practice no longer holds" };
      }
      write = writeFromSnapshot(snap);
      if (event.type === "customer.subscription.deleted") write.subscriptionStatus = "canceled";
      break;
    }
    case "invoice.payment_failed": {
      const inv = obj as unknown as StripeInvoice;
      const subId = invoiceSubscriptionId(inv);
      if (!subId) return { outcome: "ignored", reason: "invoice is not for a subscription" };
      company = await resolveCompany(store, null, idOf(inv.customer));
      if (!company) return { outcome: "no_company", reason: "invoice customer is no known practice" };
      store.onCompanyResolved?.(company.id);
      if (company.stripeSubscriptionId && company.stripeSubscriptionId !== subId) {
        return { outcome: "ignored", reason: "invoice for a subscription the practice no longer holds" };
      }
      // Stripe also sends subscription.updated (→ past_due); this makes the banner
      // appear even if that one is delayed. A canceled subscription stays canceled.
      if (company.subscriptionStatus === "canceled") {
        await store.recordEvent({ id: event.id, type: event.type, companyId: company.id });
        return { outcome: "ignored", reason: "subscription already canceled" };
      }
      write = { stripeSubscriptionId: subId, subscriptionStatus: "past_due" };
      break;
    }
  }

  if (!company || !write) return { outcome: "ignored", reason: "nothing to apply" };
  const applied = await store.updateCompany(company.id, write, eventAt);
  await store.recordEvent({ id: event.id, type: event.type, companyId: company.id });
  return applied ? { outcome: "applied", companyId: company.id } : { outcome: "stale", companyId: company.id };
}
