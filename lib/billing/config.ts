/**
 * Billing configuration, from the environment. Everything billing-related is
 * HIDDEN unless both the Stripe secret key and the monthly price id are set, so
 * a deploy without them looks exactly as it did before billing existed.
 *
 *   STRIPE_SECRET_KEY                — sk_live_… / sk_test_… (Nucleus LLC's Stripe account)
 *   STRIPE_PRICE_ID_MONTHLY          — price_… for the monthly plan (required)
 *   STRIPE_PRICE_ID_YEARLY           — price_… for the yearly plan (optional)
 *   STRIPE_BILLING_WEBHOOK_SECRET    — whsec_… of the /api/billing/webhook endpoint
 *
 * Deliberately separate from any Stripe Connect settings (client invoice Pay-now
 * lives elsewhere): this is the practice paying Nucleus, not a client paying a
 * practice.
 */
export type BillingInterval = "monthly" | "yearly";

export type BillingConfig = {
  secretKey: string;
  monthlyPriceId: string;
  yearlyPriceId: string | null;
  webhookSecret: string | null;
};

type Env = Record<string, string | undefined>;

export function billingConfig(env: Env = process.env): BillingConfig | null {
  const secretKey = (env.STRIPE_SECRET_KEY ?? "").trim();
  const monthlyPriceId = (env.STRIPE_PRICE_ID_MONTHLY ?? "").trim();
  if (!secretKey || !monthlyPriceId) return null;
  return {
    secretKey,
    monthlyPriceId,
    yearlyPriceId: (env.STRIPE_PRICE_ID_YEARLY ?? "").trim() || null,
    webhookSecret: (env.STRIPE_BILLING_WEBHOOK_SECRET ?? "").trim() || null,
  };
}

export function isBillingConfigured(env: Env = process.env): boolean {
  return billingConfig(env) !== null;
}

/** The price for an interval, or null when that interval is not offered. */
export function priceFor(cfg: BillingConfig, interval: BillingInterval): string | null {
  return interval === "yearly" ? cfg.yearlyPriceId : cfg.monthlyPriceId;
}

/** Which interval a stored price id belongs to (for display). */
export function intervalOfPrice(cfg: BillingConfig | null, priceId: string | null | undefined): BillingInterval | null {
  if (!cfg || !priceId) return null;
  if (priceId === cfg.monthlyPriceId) return "monthly";
  if (cfg.yearlyPriceId && priceId === cfg.yearlyPriceId) return "yearly";
  return null;
}

/** Absolute base URL for Stripe's success / cancel / return links. */
export function appBaseUrl(env: Env = process.env): string {
  return ((env.NEXTAUTH_URL ?? "").trim() || (env.NEXT_PUBLIC_APP_URL ?? "").trim() || "https://aec-flow.com").replace(/\/+$/, "");
}
