"use server";

/**
 * Settings → Integrations → Online payments: connect the practice's own Stripe
 * account to AEC-flow (Stripe Connect, Standard account, Stripe-hosted
 * onboarding through Account Links).
 *
 * The same gate as every practice-wide setting (canManagePasswords: ADMIN,
 * DIRECTOR or the founder), re-derived from the database here — the button
 * being hidden on screen is presentation only.
 */
import { revalidatePath } from "next/cache";
import { requireActor, type Actor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";
import {
  getOnlinePaymentsStatus,
  saveConnectStatus,
  unlinkStripeAccount,
  type OnlinePaymentsStatus,
} from "@/lib/data/pay-now";
import { connectStatusFromAccount, retrieveAccount, stripeConfig } from "@/lib/payments/stripe";
import { NOT_CONFIGURED, onboardingUrlFor } from "@/lib/server/stripe-connect";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const FORBIDDEN = "Only an Admin or a Director can change the practice's settings.";

async function admin(): Promise<Actor> {
  const actor = await requireActor();
  if (!canManagePasswords(actor.role, actor.isFounder)) throw new Error(FORBIDDEN);
  return actor;
}

function fail(e: unknown, fallback: string): { ok: false; error: string } {
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

/** Connect Stripe / Continue onboarding: returns the Stripe URL to send the browser to. */
export async function startStripeOnboardingAction(): Promise<Result<{ url: string }>> {
  try {
    const actor = await admin();
    const url = await onboardingUrlFor(actor.companyId, actor.email);
    return { ok: true, data: { url } };
  } catch (e) {
    return fail(e, "Could not start Stripe onboarding.");
  }
}

/** Ask Stripe for the account's current state and store it. */
export async function refreshStripeStatusAction(): Promise<Result<OnlinePaymentsStatus>> {
  try {
    const actor = await admin();
    const cfg = stripeConfig();
    if (!cfg) throw new Error(NOT_CONFIGURED);
    const status = await getOnlinePaymentsStatus(actor.companyId);
    if (status.accountId) {
      const account = await retrieveAccount(cfg, status.accountId);
      await saveConnectStatus(actor.companyId, connectStatusFromAccount(account));
    }
    revalidatePath("/settings");
    return { ok: true, data: await getOnlinePaymentsStatus(actor.companyId) };
  } catch (e) {
    return fail(e, "Could not read the Stripe account.");
  }
}

/**
 * Stop taking online payments. Only AEC-flow's link is removed: the practice's
 * Stripe account, its balance and its history stay theirs, untouched.
 */
export async function disconnectStripeAction(): Promise<Result<OnlinePaymentsStatus>> {
  try {
    const actor = await admin();
    await unlinkStripeAccount(actor.companyId);
    revalidatePath("/settings");
    return { ok: true, data: await getOnlinePaymentsStatus(actor.companyId) };
  } catch (e) {
    return fail(e, "Could not disconnect Stripe.");
  }
}
