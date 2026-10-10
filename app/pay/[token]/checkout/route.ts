/**
 * POST /pay/<token>/checkout — the Pay button. Creates a Stripe Checkout Session
 * as a DIRECT CHARGE on the practice's connected account for the invoice's
 * CURRENT outstanding balance, and sends the browser to it (303).
 *
 * PUBLIC like the page (proxy.ts lets /pay/* through). Rate-limited per IP: each
 * attempt is a call to Stripe on the practice's account.
 *
 * The amount is computed here, on the server, from the stored invoice — never
 * taken from the form — and converted to minor units by money.ts
 * (lib/payments/pay-link.ts `checkoutAmount`). The payment itself is recorded by
 * the webhook when Stripe says it was paid, not by the success page.
 */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getInvoice } from "@/lib/data/invoices";
import { practiceForPayment, resolvePayToken } from "@/lib/data/pay-now";
import { checkoutAmount, isOnlinePayable, isPayTokenShape, publicBaseUrl } from "@/lib/payments/pay-link";
import { createInvoiceCheckoutSession, stripeConfig } from "@/lib/payments/stripe";
import { runAsCompany } from "@/lib/server/request-company";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { RATE_LIMITS, clientIpFrom } from "@/lib/account-security/rate-limit-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** How long the Checkout page stays usable. Stripe's minimum is 30 minutes. */
const SESSION_MINUTES = 60;

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cfg = stripeConfig();
  if (!cfg || !isPayTokenShape(token)) return new NextResponse(null, { status: 404 });

  const back = (query: string) => NextResponse.redirect(new URL(`/pay/${token}${query}`, req.url), 303);

  const h = await headers();
  const limit = await hitRateLimit(RATE_LIMITS.payCheckoutIp, clientIpFrom((n) => h.get(n)));
  if (!limit.allowed) return back("?busy=1");

  const hit = await resolvePayToken(token);
  if (!hit) return new NextResponse(null, { status: 404 });

  try {
    // No session here, and React `cache` does not hold across a route handler,
    // so the company is carried by runAsCompany rather than companyOverride().
    const url = await runAsCompany(hit.companyId, async () => {
      const [invoice, practice] = await Promise.all([getInvoice(hit.invoiceId), practiceForPayment(hit.companyId)]);
      if (!invoice || !practice.stripeAccountId || !isOnlinePayable(invoice)) return null;
      const amount = checkoutAmount(invoice.outstanding, invoice.currency);
      const base = publicBaseUrl(process.env);
      const session = await createInvoiceCheckoutSession(cfg, {
        account: practice.stripeAccountId,
        companyId: hit.companyId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        practiceName: practice.name,
        amountMinor: amount.minor,
        currency: amount.currency,
        customerEmail: invoice.contactEmail,
        successUrl: `${base}/pay/${token}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${base}/pay/${token}?cancelled=1`,
        expiresAt: Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60,
      });
      return session.url;
    });
    if (!url) return back("?unavailable=1");
    return NextResponse.redirect(url, 303);
  } catch (e) {
    console.error("[pay-checkout] could not start a checkout", e);
    return back("?error=1");
  }
}
