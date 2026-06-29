"use server";

/**
 * Beta-tester self-signup. Creates a STAFF user gated behind a shared beta
 * access code, stamps a 12-month free-access window onto the account, and
 * records the report-back agreement. Never throws to the client — returns a
 * tagged result the signup form can act on. The client logs the user in with
 * `signIn` after a successful create (NextAuth credentials sign-in is client-side).
 */

import bcrypt from "bcryptjs";
import { addMonths } from "date-fns";
import { prisma } from "@/lib/db";

/** Free beta-access length, in months. */
export const BETA_ACCESS_MONTHS = 12;

export type SignupResult = { ok: true } | { ok: false; error: string };

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function registerBetaTester(input: {
  name: string;
  email: string;
  company?: string;
  password: string;
  code: string;
  agreed: boolean;
}): Promise<SignupResult> {
  try {
    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase();
    const company = input.company?.trim() || null;
    const password = input.password ?? "";
    const expectedCode = process.env.BETA_SIGNUP_CODE;

    if (!name) return { ok: false, error: "Please enter your name." };
    if (!email || !isValidEmail(email)) {
      return { ok: false, error: "Please enter a valid email address." };
    }
    if (password.length < 8) {
      return { ok: false, error: "Password must be at least 8 characters." };
    }
    if (!input.agreed) {
      return { ok: false, error: "Please agree to share feedback during the beta." };
    }
    if (!expectedCode) {
      return { ok: false, error: "Beta signup isn't configured yet. Please contact the team." };
    }
    if (input.code?.trim() !== expectedCode) {
      return { ok: false, error: "That beta access code isn't valid." };
    }

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      return { ok: false, error: "An account with this email already exists — try signing in." };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date();
    const accessUntil = addMonths(now, BETA_ACCESS_MONTHS);

    await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: "STAFF",
        status: "ACTIVE",
        // Beta-program metadata lives in the preferences JSON blob — no schema
        // change needed. `track & display` for now; not enforced at login yet.
        preferences: {
          betaTester: true,
          company,
          betaSignedUpAt: now.toISOString(),
          betaAccessUntil: accessUntil.toISOString(),
          betaFeedbackAgreed: true,
        },
      },
    });

    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Could not create your account.";
    return { ok: false, error };
  }
}
