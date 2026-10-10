/**
 * Stripe Connect onboarding for a practice. SERVER-ONLY.
 *
 * Kept out of the "use server" actions file on purpose: every export of such a
 * file becomes a callable server action, and this takes the company id as an
 * argument. Callers (the Settings action, the onboarding refresh route) resolve
 * the company from the signed-in admin first.
 */
import "server-only";
import { getOnlinePaymentsStatus, linkStripeAccount } from "@/lib/data/pay-now";
import { createAccountLink, createStandardAccount, stripeConfig } from "@/lib/payments/stripe";
import { publicBaseUrl } from "@/lib/payments/pay-link";

export const NOT_CONFIGURED = "Online payments are not set up on this server yet.";

/**
 * The Stripe-hosted onboarding link for this practice, creating its Standard
 * connected account the first time. Account Links are single-use and expire
 * within minutes, so one is made per click — never stored.
 */
export async function onboardingUrlFor(companyId: string, email: string | null): Promise<string> {
  const cfg = stripeConfig();
  if (!cfg) throw new Error(NOT_CONFIGURED);
  const status = await getOnlinePaymentsStatus(companyId);
  let accountId = status.accountId;
  if (!accountId) {
    const account = await createStandardAccount(cfg, { companyId, email });
    accountId = account.id;
    await linkStripeAccount(companyId, accountId);
  }
  const base = publicBaseUrl(process.env);
  const link = await createAccountLink(cfg, {
    account: accountId,
    refreshUrl: `${base}/api/stripe/connect/refresh`,
    returnUrl: `${base}/api/stripe/connect/return`,
  });
  return link.url;
}
