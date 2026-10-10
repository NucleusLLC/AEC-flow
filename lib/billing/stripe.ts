/**
 * A small Stripe REST client for AEC-flow's own subscription billing — fetch, no
 * SDK (node_modules is shared between worktrees, and four calls do not justify a
 * dependency). The API version is PINNED so a change on Stripe's side cannot
 * move a field under us.
 *
 * Since 2025-03-31.basil a subscription's `current_period_end` lives on each
 * subscription ITEM, not on the subscription; and an invoice's subscription id
 * lives under `parent.subscription_details`. `subscriptionSnapshot` and
 * `invoiceSubscriptionId` read both shapes.
 *
 * SERVER-ONLY: it carries the secret key. Kept under lib/billing/ (not
 * lib/payments/, which is the client-invoice Stripe Connect integration).
 */
import { mapStripeStatus, type BillingStatus } from "./status";

export const STRIPE_API_VERSION = "2025-09-30.clover";
const STRIPE_API = "https://api.stripe.com/v1";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class StripeError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "StripeError";
  }
}

type Params = Record<string, string | number | boolean | null | undefined>;

/** application/x-www-form-urlencoded, Stripe's bracket notation already in the keys. */
export function encodeForm(params: Params): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    out.append(k, String(v));
  }
  return out.toString();
}

export async function stripeRequest<T>(
  secretKey: string,
  method: "GET" | "POST",
  path: string,
  params: Params = {},
  opts: { idempotencyKey?: string; fetchImpl?: FetchLike } = {},
): Promise<T> {
  const f = opts.fetchImpl ?? fetch;
  const body = encodeForm(params);
  const url = method === "GET" && body ? `${STRIPE_API}${path}?${body}` : `${STRIPE_API}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    "Stripe-Version": STRIPE_API_VERSION,
  };
  if (method === "POST") headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  const res = await f(url, { method, headers, body: method === "POST" ? body : undefined, cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string } } & T;
  if (!res.ok) {
    throw new StripeError(json.error?.message || `Stripe request failed (${res.status})`, res.status, json.error?.code);
  }
  return json as T;
}

// ── The four calls ────────────────────────────────────────────────────────────

export async function createCustomer(
  secretKey: string,
  input: { companyId: string; name: string; email?: string | null },
  fetchImpl?: FetchLike,
): Promise<{ id: string }> {
  return stripeRequest<{ id: string }>(
    secretKey,
    "POST",
    "/customers",
    { name: input.name, email: input.email ?? undefined, "metadata[companyId]": input.companyId },
    // One customer per practice even if "Subscribe" is double-clicked.
    { idempotencyKey: `aecflow-customer-${input.companyId}`, fetchImpl },
  );
}

export async function createCheckoutSession(
  secretKey: string,
  input: { companyId: string; customerId: string; priceId: string; successUrl: string; cancelUrl: string },
  fetchImpl?: FetchLike,
): Promise<{ id: string; url: string }> {
  return stripeRequest<{ id: string; url: string }>(
    secretKey,
    "POST",
    "/checkout/sessions",
    {
      mode: "subscription",
      customer: input.customerId,
      client_reference_id: input.companyId,
      "line_items[0][price]": input.priceId,
      "line_items[0][quantity]": 1,
      // The webhook finds the practice from this even if the customer link is lost.
      "subscription_data[metadata][companyId]": input.companyId,
      "metadata[companyId]": input.companyId,
      allow_promotion_codes: true,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    },
    { fetchImpl },
  );
}

export async function createPortalSession(
  secretKey: string,
  input: { customerId: string; returnUrl: string },
  fetchImpl?: FetchLike,
): Promise<{ id: string; url: string }> {
  return stripeRequest<{ id: string; url: string }>(
    secretKey,
    "POST",
    "/billing_portal/sessions",
    { customer: input.customerId, return_url: input.returnUrl },
    { fetchImpl },
  );
}

export async function retrieveSubscription(secretKey: string, id: string, fetchImpl?: FetchLike): Promise<StripeSubscription> {
  if (!/^sub_[A-Za-z0-9]+$/.test(id)) throw new StripeError("Not a subscription id", 400);
  return stripeRequest<StripeSubscription>(secretKey, "GET", `/subscriptions/${id}`, {}, { fetchImpl });
}

// ── Reading Stripe objects ──────────────────────────────────────────────────

export type StripeSubscription = {
  id: string;
  status: string;
  customer: string | { id: string };
  cancel_at_period_end?: boolean;
  current_period_end?: number | null; // pre-basil API versions only
  metadata?: Record<string, string> | null;
  items?: { data?: Array<{ current_period_end?: number | null; quantity?: number | null; price?: { id?: string } | null }> };
};

export type SubscriptionSnapshot = {
  subscriptionId: string;
  customerId: string | null;
  companyIdFromMetadata: string | null;
  status: BillingStatus;
  rawStatus: string;
  priceId: string | null;
  quantity: number | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

export function idOf(v: string | { id?: string } | null | undefined): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  return v.id ?? null;
}

/** The fields AEC-flow stores, from a subscription object of either API shape. */
export function subscriptionSnapshot(sub: StripeSubscription): SubscriptionSnapshot {
  const item = sub.items?.data?.[0];
  const end = item?.current_period_end ?? sub.current_period_end ?? null;
  return {
    subscriptionId: sub.id,
    customerId: idOf(sub.customer),
    companyIdFromMetadata: sub.metadata?.companyId?.trim() || null,
    status: mapStripeStatus(sub.status),
    rawStatus: sub.status,
    priceId: item?.price?.id ?? null,
    quantity: item?.quantity ?? null,
    currentPeriodEnd: typeof end === "number" && end > 0 ? new Date(end * 1000) : null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
  };
}

export type StripeInvoice = {
  id: string;
  customer: string | { id: string } | null;
  subscription?: string | { id: string } | null; // pre-basil
  parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
};

export function invoiceSubscriptionId(inv: StripeInvoice): string | null {
  return idOf(inv.parent?.subscription_details?.subscription ?? null) ?? idOf(inv.subscription ?? null);
}
