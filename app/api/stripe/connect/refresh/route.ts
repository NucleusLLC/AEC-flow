/**
 * GET /api/stripe/connect/refresh — Stripe sends the admin here when an
 * onboarding link has expired or was already used. Make a fresh one and go
 * straight back to Stripe. Signed-in admins only.
 */
import { NextResponse } from "next/server";
import { requireActor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";
import { onboardingUrlFor } from "@/lib/server/stripe-connect";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const settings = (q: string) => NextResponse.redirect(new URL(`/settings?tab=integrations${q}`, req.url), 303);
  const actor = await requireActor().catch(() => null);
  if (!actor) return NextResponse.redirect(new URL("/login?callbackUrl=/settings", req.url), 303);
  if (!canManagePasswords(actor.role, actor.isFounder)) return settings("");
  try {
    return NextResponse.redirect(await onboardingUrlFor(actor.companyId, actor.email), 303);
  } catch (e) {
    console.error("[stripe-connect] refresh: could not make a new onboarding link", e);
    return settings("&stripe=error");
  }
}
