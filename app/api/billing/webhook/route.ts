/**
 * Stripe Billing webhook — AEC-flow's own subscriptions (decision D-5).
 *
 * Public by necessity (Stripe has no session): proxy.ts lets exactly this path
 * through, and the Stripe-Signature check below is the gate instead. The body is
 * read RAW (`req.text()`) because the signature covers the exact bytes.
 *
 * Events: checkout.session.completed, customer.subscription.created / updated /
 * deleted, invoice.payment_failed. Idempotent by event id; out-of-order safe.
 * Rules in lib/billing/webhook.ts, storage in lib/data/billing.ts. The practice
 * an event belongs to is set as the request's company (companyOverride) before
 * any further query, like /officedash.
 *
 * Answers:
 *   200 — applied, duplicate, ignored, or for no known practice (Stripe must not retry those);
 *   400 — bad signature or body; 404 — billing not configured on this deploy;
 *   500 — applying failed (Stripe retries with backoff).
 */
import { NextResponse } from "next/server";
import { billingConfig } from "@/lib/billing/config";
import { verifyStripeSignature } from "@/lib/billing/signature";
import { handleBillingEvent, type StripeEvent } from "@/lib/billing/webhook";
import { prismaBillingStore } from "@/lib/data/billing";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 512 * 1024;

function log(fields: Record<string, unknown>) {
  console.log(`[aecflow-billing] ${JSON.stringify(fields)}`);
}

export async function POST(req: Request) {
  const cfg = billingConfig();
  if (!cfg || !cfg.webhookSecret) return new NextResponse(null, { status: 404 });

  const payload = await req.text();
  if (payload.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });

  const sig = verifyStripeSignature(payload, req.headers.get("stripe-signature"), cfg.webhookSecret);
  if (!sig.ok) {
    log({ rejected: sig.reason });
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  try {
    const result = await handleBillingEvent(event, prismaBillingStore(cfg.secretKey));
    log({ event: event.id, type: event.type, ...result });
    return NextResponse.json({ received: true, outcome: result.outcome });
  } catch (e) {
    log({ event: event.id, type: event.type, error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
