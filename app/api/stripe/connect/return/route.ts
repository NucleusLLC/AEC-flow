/**
 * GET /api/stripe/connect/return — Stripe sends the admin back here when they
 * leave the hosted onboarding (finished or not). Read the account's state from
 * Stripe, store it, and go back to Settings → Integrations.
 *
 * Returning here does NOT mean onboarding is complete — only charges_enabled
 * says the practice can take cards. account.updated keeps it current afterwards.
 * Signed-in admins only (proxy.ts gates /api/*; the role is checked here).
 */
import { NextResponse } from "next/server";
import { requireActor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";
import { getOnlinePaymentsStatus, saveConnectStatus } from "@/lib/data/pay-now";
import { connectStatusFromAccount, retrieveAccount, stripeConfig } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const to = (q: string) => NextResponse.redirect(new URL(`/settings?tab=integrations${q}`, req.url), 303);
  const actor = await requireActor().catch(() => null);
  if (!actor) return NextResponse.redirect(new URL("/login?callbackUrl=/settings", req.url), 303);
  if (!canManagePasswords(actor.role, actor.isFounder)) return to("");
  const cfg = stripeConfig();
  if (!cfg) return to("");
  try {
    const status = await getOnlinePaymentsStatus(actor.companyId);
    if (status.accountId) {
      const account = await retrieveAccount(cfg, status.accountId);
      await saveConnectStatus(actor.companyId, connectStatusFromAccount(account));
    }
    return to("&stripe=returned");
  } catch (e) {
    console.error("[stripe-connect] return: could not read the account", e);
    return to("&stripe=error");
  }
}
