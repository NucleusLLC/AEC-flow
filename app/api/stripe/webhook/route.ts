/**
 * POST /api/stripe/webhook — Stripe tells AEC-flow what happened on a practice's
 * connected account. PUBLIC (proxy.ts lets it through): Stripe has no session,
 * and the signature is the authentication.
 *
 * Order of work:
 *  1. Read the RAW body (the signature is over the exact bytes) and verify the
 *     `Stripe-Signature` header with STRIPE_WEBHOOK_SECRET (lib/payments/
 *     stripe-signature.ts). A bad signature is a 400 and nothing is read.
 *  2. Parse the event and let lib/payments/webhook.ts decide what it means.
 *  3. Database work for a payment runs INSIDE the invoice's company
 *     (`runAsCompany`), so the tenant extension scopes every query exactly as it
 *     would for a signed-in member of that practice.
 *
 * Answers 200 for anything handled or deliberately ignored, so Stripe stops
 * retrying; 500 only for a failure worth retrying (the database was down).
 * Replays are harmless: the PaymentIntent is unique on the payment row.
 *
 * With Stripe not configured the route answers 404, as if it did not exist.
 */
import { NextResponse } from "next/server";
import { stripeConfig } from "@/lib/payments/stripe";
import { StripeSignatureError, verifyStripeSignature } from "@/lib/payments/stripe-signature";
import { handleStripeEvent, type StripeEvent } from "@/lib/payments/webhook";
import { runAsCompany } from "@/lib/server/request-company";
import { recordStripePayment } from "@/lib/data/invoices";
import {
  findInvoiceForPayment,
  saveConnectStatusByAccount,
  unlinkStripeAccountById,
} from "@/lib/data/pay-now";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Stripe events are a few KB; anything far larger is not one. */
const MAX_BODY_BYTES = 512 * 1024;

export async function POST(req: Request) {
  const cfg = stripeConfig();
  if (!cfg) return new NextResponse(null, { status: 404 });

  const payload = await req.text();
  if (payload.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });

  try {
    verifyStripeSignature({
      payload,
      header: req.headers.get("stripe-signature"),
      secret: cfg.webhookSecret,
    });
  } catch (e) {
    if (e instanceof StripeSignatureError) {
      return NextResponse.json({ error: "invalid signature" }, { status: 400 });
    }
    throw e;
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
    if (!event || typeof event.type !== "string" || !event.data) throw new Error("not an event");
  } catch {
    return NextResponse.json({ error: "malformed event" }, { status: 400 });
  }

  try {
    const outcome = await handleStripeEvent(event, {
      findInvoiceForPayment,
      recordPayment: ({ companyId, invoiceId }, input) =>
        runAsCompany(companyId, () => recordStripePayment(invoiceId, input)),
      updateAccountStatus: saveConnectStatusByAccount,
      forgetAccount: unlinkStripeAccountById,
    });
    if (outcome.result === "ignored" && outcome.reason.startsWith("invoice refuses")) {
      // Money was taken for an invoice that was voided (or is a draft) meanwhile.
      // It sits in the practice's Stripe account; they must refund it there.
      console.error(`[stripe-webhook] ${event.id} ${event.type}: PAID BUT NOT RECORDED — ${outcome.reason}`);
    } else if (outcome.result === "ignored") {
      console.warn(`[stripe-webhook] ${event.id} ${event.type}: ignored — ${outcome.reason}`);
    }
    return NextResponse.json({ received: true, result: outcome.result });
  } catch (e) {
    console.error(`[stripe-webhook] ${event.id} ${event.type}: failed`, e);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
