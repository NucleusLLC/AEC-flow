/**
 * What a verified Stripe event does to AEC-flow.
 *
 * The route (app/api/stripe/webhook/route.ts) verifies the signature, parses the
 * body and hands the event here with its database operations injected — so this
 * file holds every decision and none of the I/O, and webhook.test.ts drives it
 * with fakes.
 *
 * EVENTS HANDLED (all are CONNECT events: they happen on a practice's own Stripe
 * account and arrive with `event.account` = that account's id):
 *
 *   checkout.session.completed            paid by card → record the payment.
 *   checkout.session.async_payment_succeeded
 *                                         a delayed method cleared → same.
 *   account.updated                       onboarding progressed → refresh status.
 *   account.application.deauthorized      the practice disconnected us → forget it.
 *
 * Everything else is acknowledged and ignored.
 *
 * TRUST. The payload is signed, so its metadata was written by us when the
 * session was created. Even so, a payment is recorded only when the invoice's
 * company is connected to THE SAME account the event came from: an event from
 * one practice's account can never put money on another practice's invoice.
 *
 * IDEMPOTENT. Stripe delivers at least once and retries on any non-2xx. The
 * payment row's `stripePaymentIntentId` is UNIQUE, and `recordPayment` reports a
 * replay as "duplicate" rather than writing a second row.
 */
import { minorToMajor } from "@/lib/payments/pay-link";
import { connectStatusFromAccount, type ConnectStatus } from "@/lib/payments/stripe";

export type StripeEvent = {
  id: string;
  type: string;
  created?: number;
  account?: string | null;
  data: { object: Record<string, unknown> };
};

export type CheckoutSessionLike = {
  id?: unknown;
  payment_status?: unknown;
  amount_total?: unknown;
  currency?: unknown;
  payment_intent?: unknown;
  client_reference_id?: unknown;
  metadata?: unknown;
  created?: unknown;
};

/** What the webhook hands the existing payment-recording path (lib/data/invoices.ts). */
export type StripePaymentInput = {
  paidAt: string;
  amount: number;
  method: "STRIPE";
  reference: string;
  notes: string;
  stripePaymentIntentId: string;
};

export type InvoiceForPayment = {
  invoiceId: string;
  companyId: string;
  currency: string;
  /** The account the invoice's company is connected to now. */
  stripeAccountId: string | null;
};

export type WebhookDeps = {
  findInvoiceForPayment(invoiceId: string): Promise<InvoiceForPayment | null>;
  recordPayment(
    target: { companyId: string; invoiceId: string },
    input: StripePaymentInput,
  ): Promise<"recorded" | "duplicate" | "refused">;
  updateAccountStatus(accountId: string, status: ConnectStatus): Promise<boolean>;
  forgetAccount(accountId: string): Promise<boolean>;
};

export type WebhookOutcome =
  | { result: "recorded" | "duplicate" | "updated" }
  | { result: "ignored"; reason: string };

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function ymdFromUnix(sec: number): string {
  return new Date(sec * 1000).toISOString().slice(0, 10);
}

/** The invoice a Checkout Session was created for (metadata first, then client_reference_id). */
export function invoiceIdOf(session: CheckoutSessionLike): string | null {
  const meta = (session.metadata ?? {}) as Record<string, unknown>;
  return str(meta.aecflow_invoice_id) ?? str(session.client_reference_id);
}

/**
 * Map a paid Checkout Session to a payment row, or say why not. Pure.
 * The amount is what Stripe actually charged (`amount_total`, minor units),
 * converted back by money.ts; its currency must be the invoice's.
 */
export function paymentFromCheckoutSession(
  session: CheckoutSessionLike,
  invoiceCurrency: string,
  eventCreated?: number,
): { ok: true; payment: StripePaymentInput } | { ok: false; reason: string } {
  if (session.payment_status !== "paid") return { ok: false, reason: `payment_status is ${String(session.payment_status)}` };
  const pi =
    str(session.payment_intent) ??
    str((session.payment_intent as { id?: unknown } | null | undefined)?.id);
  if (!pi) return { ok: false, reason: "no payment intent on the session" };
  const amountMinor = session.amount_total;
  if (typeof amountMinor !== "number" || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    return { ok: false, reason: "no positive amount_total" };
  }
  const currency = str(session.currency)?.toUpperCase();
  if (!currency || currency !== invoiceCurrency.toUpperCase()) {
    return { ok: false, reason: `currency ${currency ?? "?"} is not the invoice's ${invoiceCurrency}` };
  }
  const when =
    typeof eventCreated === "number"
      ? eventCreated
      : typeof session.created === "number"
        ? session.created
        : Math.floor(Date.now() / 1000);
  return {
    ok: true,
    payment: {
      paidAt: ymdFromUnix(when),
      amount: minorToMajor(amountMinor, currency),
      method: "STRIPE",
      reference: pi,
      notes: str(session.id)
        ? `Paid online by card (Stripe Checkout ${str(session.id)})`
        : "Paid online by card (Stripe Checkout)",
      stripePaymentIntentId: pi,
    },
  };
}

export async function handleStripeEvent(event: StripeEvent, deps: WebhookDeps): Promise<WebhookOutcome> {
  const obj = event.data?.object ?? {};
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const account = str(event.account);
      if (!account) return { result: "ignored", reason: "not a connected-account event" };
      const session = obj as CheckoutSessionLike;
      const invoiceId = invoiceIdOf(session);
      if (!invoiceId) return { result: "ignored", reason: "not an AEC-flow invoice session" };
      const invoice = await deps.findInvoiceForPayment(invoiceId);
      if (!invoice) return { result: "ignored", reason: "invoice not found" };
      if (!invoice.stripeAccountId || invoice.stripeAccountId !== account) {
        return { result: "ignored", reason: "event account is not the invoice's practice" };
      }
      const mapped = paymentFromCheckoutSession(session, invoice.currency, event.created);
      if (!mapped.ok) return { result: "ignored", reason: mapped.reason };
      const r = await deps.recordPayment(
        { companyId: invoice.companyId, invoiceId: invoice.invoiceId },
        mapped.payment,
      );
      if (r === "refused") return { result: "ignored", reason: "invoice refuses payments (draft or void)" };
      return { result: r };
    }
    case "account.updated": {
      const id = str((obj as { id?: unknown }).id);
      if (!id) return { result: "ignored", reason: "no account id" };
      const found = await deps.updateAccountStatus(id, connectStatusFromAccount(obj));
      return found ? { result: "updated" } : { result: "ignored", reason: "account not linked to a practice" };
    }
    case "account.application.deauthorized": {
      const id = str(event.account);
      if (!id) return { result: "ignored", reason: "no account id" };
      const found = await deps.forgetAccount(id);
      return found ? { result: "updated" } : { result: "ignored", reason: "account not linked to a practice" };
    }
    default:
      return { result: "ignored", reason: `unhandled event type ${event.type}` };
  }
}
