"use server";

/**
 * Settings › Billing — start a Stripe Checkout (subscribe) or open the Stripe
 * Customer Portal (manage). Admin / Director / founder only (canManagePasswords),
 * checked here on the server whatever the page drew.
 *
 * Each returns a Stripe-hosted URL; the browser goes there. The subscription
 * itself is recorded only by the webhook, never from the redirect back.
 */
import { requireActor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";
import { appBaseUrl, billingConfig, priceFor, type BillingInterval } from "@/lib/billing/config";
import { canSubscribe } from "@/lib/billing/status";
import { createCheckoutSession, createCustomer, createPortalSession } from "@/lib/billing/stripe";
import { getCompanyBilling, saveStripeCustomerId } from "@/lib/data/billing";

type Result = { ok: true; url: string } | { ok: false; error: string };

async function billingAdmin() {
  const cfg = billingConfig();
  if (!cfg) return { error: "Billing is not available yet." } as const;
  const actor = await requireActor().catch(() => null);
  if (!actor) return { error: "You must be signed in." } as const;
  if (!canManagePasswords(actor.role, actor.isFounder)) {
    return { error: "Only an administrator or director can manage billing." } as const;
  }
  const company = await getCompanyBilling(actor.companyId);
  if (!company) return { error: "Your practice could not be found." } as const;
  return { cfg, actor, company } as const;
}

export async function startCheckoutAction(interval: BillingInterval): Promise<Result> {
  const ctx = await billingAdmin();
  if ("error" in ctx) return { ok: false, error: ctx.error ?? "Billing is not available yet." };
  const { cfg, actor, company } = ctx;
  if (company.isFounder) return { ok: false, error: "Your practice does not pay for AEC-flow." };
  if (!canSubscribe(company.status)) return { ok: false, error: "Your practice already has a subscription. Use Manage billing." };
  const priceId = priceFor(cfg, interval === "yearly" ? "yearly" : "monthly");
  if (!priceId) return { ok: false, error: "That billing period is not offered." };

  try {
    let customerId = company.stripeCustomerId;
    if (!customerId) {
      const created = await createCustomer(cfg.secretKey, { companyId: company.id, name: company.name, email: actor.email });
      customerId = await saveStripeCustomerId(company.id, created.id);
    }
    const base = appBaseUrl();
    const session = await createCheckoutSession(cfg.secretKey, {
      companyId: company.id,
      customerId,
      priceId,
      successUrl: `${base}/settings/billing?checkout=success`,
      cancelUrl: `${base}/settings/billing?checkout=cancel`,
    });
    if (!session.url) return { ok: false, error: "Stripe did not return a checkout page. Please try again." };
    return { ok: true, url: session.url };
  } catch (e) {
    console.error("[aecflow-billing] checkout failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "Stripe could not start the checkout. Please try again." };
  }
}

export async function openPortalAction(): Promise<Result> {
  const ctx = await billingAdmin();
  if ("error" in ctx) return { ok: false, error: ctx.error ?? "Billing is not available yet." };
  const { cfg, company } = ctx;
  if (!company.stripeCustomerId) return { ok: false, error: "There is no billing account yet. Subscribe first." };
  try {
    const session = await createPortalSession(cfg.secretKey, {
      customerId: company.stripeCustomerId,
      returnUrl: `${appBaseUrl()}/settings/billing`,
    });
    return { ok: true, url: session.url };
  } catch (e) {
    console.error("[aecflow-billing] portal failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "Stripe could not open the billing portal. Please try again." };
  }
}
