/**
 * AEC-flow's own subscription: what a practice's Stripe status means here.
 *
 * Decision D-5 (10 OCT 2026): each practice pays Nucleus LLC for AEC-flow through
 * Stripe Billing on the Nucleus Stripe account. This module is pure — no Prisma,
 * no fetch — so the rules are tested on their own (status.test.ts).
 *
 * NOTHING IS ENFORCED YET. `BILLING_ENFORCED` is false: an unpaid practice keeps
 * working and only sees a banner (past due / canceled). `accessFor` already says
 * what each status WOULD allow, so switching enforcement on later is one constant
 * and one call site, not a redesign.
 */

/** Off until the owner decides to lock out unpaid practices. Read by `effectiveAccess`. */
export const BILLING_ENFORCED = false;

/** The statuses AEC-flow distinguishes. "none" = never subscribed. */
export type BillingStatus = "none" | "trialing" | "active" | "past_due" | "canceled";

export const BILLING_STATUSES: readonly BillingStatus[] = ["none", "trialing", "active", "past_due", "canceled"];

/**
 * Stripe's subscription.status → ours. Stripe has eight values; the ones that
 * mean "money is owed but the subscription still exists" (past_due, unpaid)
 * fold into past_due, and the ones that mean "no live subscription" fold into
 * canceled. An incomplete subscription (first payment not yet through) has
 * never been paid for, so it reads as none. Anything unknown is none.
 */
export function mapStripeStatus(raw: string | null | undefined): BillingStatus {
  switch ((raw ?? "").trim().toLowerCase()) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "paused":
      return "canceled";
    default:
      return "none";
  }
}

/** Reads a stored status column back into the union (unknown → none). */
export function parseBillingStatus(v: string | null | undefined): BillingStatus {
  return (BILLING_STATUSES as readonly string[]).includes(v ?? "") ? (v as BillingStatus) : "none";
}

/**
 * What a status allows, WHEN enforcement is on:
 *  - "full"   — use the app normally (trialing, active, and the founder company always);
 *  - "warn"   — full use, with a payment warning (past_due: Stripe is still retrying);
 *  - "locked" — would be sent to the billing page (canceled, never subscribed).
 *
 * The founder company (Company.isFounder) is Nucleus's own and never pays.
 */
export type BillingAccess = "full" | "warn" | "locked";

export function accessFor(status: BillingStatus, isFounder = false): BillingAccess {
  if (isFounder) return "full";
  switch (status) {
    case "trialing":
    case "active":
      return "full";
    case "past_due":
      return "warn";
    default:
      return "locked";
  }
}

/** What actually applies today: `accessFor`, softened to "warn" while enforcement is off. */
export function effectiveAccess(status: BillingStatus, isFounder = false, enforced = BILLING_ENFORCED): BillingAccess {
  const a = accessFor(status, isFounder);
  return !enforced && a === "locked" ? "warn" : a;
}

/**
 * Which banner to show across the app: only for a practice that HAD a
 * subscription and is now behind or has ended it. Never for "none" (the beta
 * practices have never been asked to pay) and never for the founder company.
 */
export function bannerFor(status: BillingStatus, isFounder = false): "past_due" | "canceled" | null {
  if (isFounder) return null;
  if (status === "past_due") return "past_due";
  if (status === "canceled") return "canceled";
  return null;
}

/** Whether "Subscribe" should be offered (no live subscription to manage). */
export function canSubscribe(status: BillingStatus): boolean {
  return status === "none" || status === "canceled";
}
