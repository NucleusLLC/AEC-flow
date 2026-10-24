/**
 * A small Stripe REST client — Stripe Connect for "Pay online".
 *
 * WHY NO SDK. Four calls are needed (create an account, an onboarding link, read
 * an account, create a Checkout Session) plus webhook verification
 * (stripe-signature.ts). The `stripe` package would go into the node_modules
 * shared by every worktree of this repo and pin its own API version; four
 * form-encoded `fetch` calls are smaller than that dependency and keep the API
 * version in ONE constant, below, that a reviewer can see.
 *
 * THE MONEY GOES TO THE PRACTICE. Nucleus LLC's Stripe account is the Connect
 * PLATFORM; each practice connects its own Standard account (Stripe dashboard,
 * Stripe-hosted onboarding, the practice is the merchant of record and bears its
 * own fees, refunds and disputes). Checkout runs as a DIRECT CHARGE on that
 * account — every call for it carries the `Stripe-Account` header — so the
 * payment lands in the practice's balance and pays out to the practice's bank.
 * Nothing passes through Nucleus. There is no platform fee for now
 * (PLATFORM_FEE_BASIS_POINTS = 0); when there is one it travels as
 * `payment_intent_data[application_fee_amount]`.
 *
 * SERVER-SIDE ONLY in practice (it needs STRIPE_SECRET_KEY), but deliberately
 * free of "server-only" and Prisma so the tests can drive it with a fake fetch.
 */

/**
 * Pinned explicitly, sent on every request. 2026-09-30.endive is the current
 * version as of this change. Endive removed `payment_method_types` from Checkout
 * Sessions, so none is sent: the connected account's own payment-method settings
 * (dynamic payment methods) decide what the client is offered.
 */
export const STRIPE_API_VERSION = "2026-09-30.endive";

const API = "https://api.stripe.com";

/**
 * The platform's cut of each payment, in basis points (1/100 of a percent).
 * ZERO by the owner's decision: the practice receives the whole payment, less
 * Stripe's own fees on its account.
 */
export const PLATFORM_FEE_BASIS_POINTS = 0;

export function platformFeeMinor(amountMinor: number): number {
  if (PLATFORM_FEE_BASIS_POINTS <= 0) return 0;
  return Math.floor((amountMinor * PLATFORM_FEE_BASIS_POINTS) / 10_000);
}

export type StripeConfig = { secretKey: string; webhookSecret: string };

/**
 * Both keys, or null. With either missing the whole feature stays off: no
 * Settings button, no link on the invoice, no /pay checkout. Half-configured
 * (a secret key but no webhook secret) would take money the app never records.
 */
export function stripeConfig(env: Record<string, string | undefined> = process.env): StripeConfig | null {
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secretKey || !webhookSecret) return null;
  return { secretKey, webhookSecret };
}

export class StripeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
  ) {
    super(message);
    this.name = "StripeApiError";
  }
}

type Param = string | number | boolean | null | undefined | Param[] | { [k: string]: Param };

/**
 * Stripe's form encoding: nested objects as `a[b][c]=v`, arrays as `a[0][b]=v`.
 * Null and undefined are left out entirely.
 */
export function formEncode(params: Record<string, Param>): string {
  const pairs: string[] = [];
  const walk = (prefix: string, v: Param) => {
    if (v === null || v === undefined) return;
    if (Array.isArray(v)) {
      v.forEach((x, i) => walk(`${prefix}[${i}]`, x));
      return;
    }
    if (typeof v === "object") {
      for (const [k, x] of Object.entries(v)) walk(prefix ? `${prefix}[${k}]` : k, x);
      return;
    }
    pairs.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(v))}`);
  };
  for (const [k, v] of Object.entries(params)) walk(k, v);
  return pairs.join("&");
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export async function stripeRequest<T>(
  cfg: Pick<StripeConfig, "secretKey">,
  method: "GET" | "POST",
  path: string,
  params: Record<string, Param> = {},
  opts: { account?: string; idempotencyKey?: string; fetchImpl?: FetchLike } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.secretKey}`,
    "Stripe-Version": STRIPE_API_VERSION,
  };
  if (opts.account) headers["Stripe-Account"] = opts.account;
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  const body = formEncode(params);
  let url = `${API}${path}`;
  const init: RequestInit = { method, headers, cache: "no-store" };
  if (method === "GET") {
    if (body) url += `?${body}`;
  } else {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = body;
  }
  const res = await (opts.fetchImpl ?? fetch)(url, init);
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: string } };
  if (!res.ok) {
    throw new StripeApiError(
      json.error?.message || `Stripe answered ${res.status}.`,
      res.status,
      json.error?.code ?? null,
    );
  }
  return json as T;
}

// ── Connect: the practice's own account ────────────────────────────────────

export type StripeAccount = {
  id: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
};

export type ConnectStatus = { chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean };

export function connectStatusFromAccount(a: Partial<StripeAccount> | null | undefined): ConnectStatus {
  return {
    chargesEnabled: a?.charges_enabled === true,
    payoutsEnabled: a?.payouts_enabled === true,
    detailsSubmitted: a?.details_submitted === true,
  };
}

/**
 * A new connected account with the properties of a STANDARD account, expressed
 * the way Stripe now recommends (controller properties rather than the legacy
 * `type=standard`): full Stripe dashboard, the account pays its own fees, Stripe
 * collects the requirements and bears negative balances. The company id goes in
 * metadata so the account can be traced back from the Stripe dashboard.
 */
export function createStandardAccount(
  cfg: Pick<StripeConfig, "secretKey">,
  input: { companyId: string; email?: string | null },
  fetchImpl?: FetchLike,
): Promise<StripeAccount> {
  return stripeRequest<StripeAccount>(
    cfg,
    "POST",
    "/v1/accounts",
    {
      controller: {
        stripe_dashboard: { type: "full" },
        fees: { payer: "account" },
        losses: { payments: "stripe" },
        requirement_collection: "stripe",
      },
      email: input.email || undefined,
      metadata: { aecflow_company_id: input.companyId },
    },
    { fetchImpl },
  );
}

/** A single-use Stripe-hosted onboarding link (expires in minutes). */
export function createAccountLink(
  cfg: Pick<StripeConfig, "secretKey">,
  input: { account: string; refreshUrl: string; returnUrl: string },
  fetchImpl?: FetchLike,
): Promise<{ url: string; expires_at: number }> {
  return stripeRequest(
    cfg,
    "POST",
    "/v1/account_links",
    {
      account: input.account,
      refresh_url: input.refreshUrl,
      return_url: input.returnUrl,
      type: "account_onboarding",
    },
    { fetchImpl },
  );
}

export async function retrieveAccount(
  cfg: Pick<StripeConfig, "secretKey">,
  accountId: string,
  fetchImpl?: FetchLike,
): Promise<StripeAccount> {
  if (!/^acct_[A-Za-z0-9]+$/.test(accountId)) throw new StripeApiError("Not a Stripe account id.", 400, null);
  return stripeRequest<StripeAccount>(cfg, "GET", `/v1/accounts/${accountId}`, {}, { fetchImpl });
}

// ── Checkout: a direct charge on the practice's account ───────────────────

export type InvoiceCheckoutInput = {
  /** The practice's connected account — the Stripe-Account header. */
  account: string;
  companyId: string;
  invoiceId: string;
  invoiceNumber: string;
  practiceName: string;
  /** From lib/payments/pay-link.ts `checkoutAmount` — never computed here. */
  amountMinor: number;
  /** Lower-case ISO code, as `checkoutAmount` returns it. */
  currency: string;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
  /** Unix seconds; Stripe accepts 30 minutes to 24 hours ahead. */
  expiresAt: number;
};

export function checkoutSessionParams(input: InvoiceCheckoutInput): Record<string, Param> {
  const fee = platformFeeMinor(input.amountMinor);
  const meta = {
    aecflow_invoice_id: input.invoiceId,
    aecflow_company_id: input.companyId,
    aecflow_invoice_number: input.invoiceNumber,
  };
  const email = input.customerEmail?.trim();
  return {
    mode: "payment",
    client_reference_id: input.invoiceId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: input.currency,
          unit_amount: input.amountMinor,
          product_data: {
            name: `Invoice ${input.invoiceNumber}`,
            description: input.practiceName || undefined,
          },
        },
      },
    ],
    metadata: meta,
    payment_intent_data: {
      description: `Invoice ${input.invoiceNumber}`,
      metadata: meta,
      // Zero today (PLATFORM_FEE_BASIS_POINTS); sent only once there is a fee.
      application_fee_amount: fee > 0 ? fee : undefined,
    },
    customer_email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    expires_at: input.expiresAt,
  };
}

export function createInvoiceCheckoutSession(
  cfg: Pick<StripeConfig, "secretKey">,
  input: InvoiceCheckoutInput,
  fetchImpl?: FetchLike,
): Promise<{ id: string; url: string | null }> {
  return stripeRequest(cfg, "POST", "/v1/checkout/sessions", checkoutSessionParams(input), {
    account: input.account,
    fetchImpl,
  });
}
