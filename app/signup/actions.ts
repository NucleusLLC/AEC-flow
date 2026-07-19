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
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { seedCompany } from "@/lib/data/company-seed";

/** Free beta-access length, in months. (Local: a "use server" file may only
 * export async functions, so this stays module-private.) */
const BETA_ACCESS_MONTHS = 6;

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
  // Declared outside the try so the catch can hand a reserved code back to the pool.
  let claimedCodeId: string | null = null;
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
    // ── Beta code resolution ────────────────────────────────────────────────
    // Two paths during the transition to per-tester codes:
    //   1. A POOL code (AECFLOW-BETA-XXXX-YYYY) — single-use, and it IS the Nucleus licence key.
    //   2. The legacy shared BETA_SIGNUP_CODE — everyone types the same string, so it yields no
    //      per-tester attribution. Still accepted so nobody mid-signup is locked out, but every
    //      use is flagged in preferences and the account gets no licence key.
    // Retire path 2 by unsetting BETA_SIGNUP_CODE once the pool is distributed.
    const submitted = input.code?.trim().toUpperCase() ?? "";
    const sharedCode = expectedCode?.trim().toUpperCase();
    if (!submitted) {
      return { ok: false, error: "Please enter your beta access code." };
    }

    let poolCode: { id: string; code: string; keyPrefix: string } | null = null;
    const found = await prisma.betaCode.findUnique({
      where: { code: submitted },
      select: { id: true, code: true, keyPrefix: true, status: true },
    });
    if (found) {
      // A real pool code that's already spent is a dead end — say so plainly rather than
      // falling through to "isn't valid", which would send the tester hunting for a typo.
      if (found.status !== "available") {
        return { ok: false, error: "That beta access code has already been used." };
      }
      poolCode = { id: found.id, code: found.code, keyPrefix: found.keyPrefix };
    } else if (!sharedCode || submitted !== sharedCode) {
      return { ok: false, error: "That beta access code isn't valid." };
    }
    const usedSharedCode = poolCode === null;

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

    // Reserve the code BEFORE creating anything. The guard on `status: "available"` makes this
    // atomic: if two people submit the same code at once, exactly one update matches a row.
    // Reserving first means a crash mid-signup burns a code (recoverable — revoke and re-mint)
    // rather than issuing the same licence key to two testers (not recoverable).
    if (poolCode) {
      const claimed = await prisma.betaCode.updateMany({
        where: { id: poolCode.id, status: "available" },
        data: { status: "claimed", claimedEmail: email, claimedAt: now },
      });
      if (claimed.count !== 1) {
        return { ok: false, error: "That beta access code has already been used." };
      }
      claimedCodeId = poolCode.id;
    }

    // Signup origin. This runs on Vercel, so the real client IP/country only exist on the request
    // headers — and for a tester who signs up but never returns, this is the ONLY signal we will
    // ever have about where they are. Nucleus mirrors these into beta_testers via sync-aecflow.
    const h = await headers();
    const signupIp = h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const signupCountry = h.get("x-vercel-ip-country") || null;
    const userAgent = h.get("user-agent")?.slice(0, 300) || null;

    // Each signup gets its OWN isolated company (tenant); the beta window becomes
    // the company's time-based license.
    const co = await prisma.company.create({
      data: {
        name: company || `${name}'s company`,
        plan: "BETA",
        seatLimit: 5,
        expiresAt: accessUntil,
        modules: [],
        // The redeemed code IS the Nucleus licence key. Storing the plaintext here (and only its
        // sha256 in Nucleus) is the same split CAD-Flow uses. Shared-code signups get no key —
        // there is nothing unique to bind — so they stay unlicensed until backfilled.
        licenseKey: poolCode?.code ?? null,
        licenseKeyPrefix: poolCode?.keyPrefix ?? null,
      },
      select: { id: true },
    });

    await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        companyId: co.id,
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
          betaSignupIp: signupIp,
          betaSignupCountry: signupCountry,
          betaUserAgent: userAgent,
          // Which gate let them in. `sharedCode` accounts have no licence key and need the
          // backfill; pool accounts are attributable in Nucleus by keyPrefix from day one.
          betaCodeSource: usedSharedCode ? "sharedCode" : "pool",
          betaKeyPrefix: poolCode?.keyPrefix ?? null,
        },
      },
    });

    // Link the claimed code back to the tenant it created (audit trail: code -> company -> user).
    if (claimedCodeId) {
      await prisma.betaCode.update({
        where: { id: claimedCodeId },
        data: { companyId: co.id },
      });
    }

    // Give the new company a little sample data so it isn't empty on first login.
    await seedCompany(co.id);

    return { ok: true };
  } catch (e) {
    // Signup failed after the code was reserved — return it to the pool so it isn't lost.
    // Best-effort: if this cleanup itself fails, the code stays claimed and can be revoked by hand,
    // which is strictly safer than risking a double-issue.
    if (claimedCodeId) {
      try {
        await prisma.betaCode.updateMany({
          where: { id: claimedCodeId, status: "claimed" },
          data: { status: "available", claimedEmail: null, claimedAt: null, companyId: null },
        });
      } catch {
        /* leave it claimed; a burned code is recoverable, a double-issued key is not */
      }
    }
    const error = e instanceof Error ? e.message : "Could not create your account.";
    return { ok: false, error };
  }
}
