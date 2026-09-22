/**
 * Confirming the address an account signed up with: issuing the link, and redeeming it.
 *
 * SERVER-ONLY (Prisma, email). Called from `app/signup/actions.ts`, the resend
 * action in `app/(app)/account/actions.ts` and `app/verify-email/[token]/page.tsx`.
 *
 * ─── WHAT THIS IS FOR ────────────────────────────────────────────────────────
 * Every account here can reset its own password by email, so an address typed at
 * signup is already a way in. A typo'd address is a member who can never recover
 * their account; somebody else's address is worse, because that somebody can.
 * Verification is what turns "the address they claimed" into "an address they can
 * actually read".
 *
 * ─── WHAT IT DOES NOT DO ─────────────────────────────────────────────────────
 * It does not block sign-in. Locking a beta tester out of a product they are
 * already using, because a queued email is slow or went to spam, would cost more
 * than the risk it removes. The banner asks; nothing here enforces.
 *
 * ─── THE ENUMERATION RULE ────────────────────────────────────────────────────
 * `issueEmailVerification` never returns anything the caller can branch on and
 * never throws — same rule as the password-reset issuer. A resend for an unknown
 * or already-verified account does nothing, quietly.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/server/email";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { RATE_LIMITS } from "@/lib/account-security/rate-limit-policy";
import {
  VERIFICATION_TOKEN_TTL_HOURS,
  generateVerificationToken,
  hashVerificationToken,
  isWellFormedVerificationToken,
  verificationLink,
  verificationTokenExpiry,
} from "@/lib/account-security/verification-token";

export type VerifyResult =
  | { ok: true; email: string; already: boolean }
  | { ok: false };

/**
 * Issue and email a verification link for an account that has not confirmed its
 * address. Silent in every other case. Never throws — a failure here must not
 * take down the signup that called it.
 */
export async function issueEmailVerification(userId: string, ip: string | null): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, status: true, emailVerifiedAt: true },
    });
    if (!user || user.status === "INACTIVE" || user.emailVerifiedAt) return;

    // Per-address flood limit, so a resend button cannot be held down. Silent:
    // this path already only reaches real accounts.
    const allowed = await hitRateLimit(RATE_LIMITS.verifyRequestEmail, user.email);
    if (!allowed.allowed) return;

    const token = generateVerificationToken();
    const now = new Date();

    // Any earlier link is retired first: one live link per account means a leaked
    // older email stops working the moment a new one is asked for.
    await prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    });

    const row = await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashVerificationToken(token),
        expiresAt: verificationTokenExpiry(now),
        requestedIp: ip,
      },
      select: { id: true },
    });

    const sent = await sendVerificationEmail({
      to: user.email,
      name: user.name,
      verifyUrl: verificationLink(process.env, token),
      expiresInHours: VERIFICATION_TOKEN_TTL_HOURS,
    });

    // The email body is a live credential, so it is never written to email_logs.
    // This row is the only place a failed send is visible.
    await prisma.emailVerificationToken.update({
      where: { id: row.id },
      data: {
        emailStatus: sent.ok ? "SENT" : "FAILED",
        emailError: sent.ok ? null : (sent.error ?? "unknown").slice(0, 500),
      },
    });
  } catch (e) {
    console.error("issueEmailVerification failed", e);
  }
}

/**
 * Redeem a verification link.
 *
 * Claiming and marking happen in one transaction, guarded on `usedAt: null` and an
 * unexpired `expiresAt`, so two simultaneous clicks cannot both match the row.
 *
 * An ALREADY-VERIFIED account opening an old link is reported as `already: true`
 * rather than as a failure: the person did what was asked, twice, and telling them
 * the link is broken would be both untrue and alarming.
 */
export async function redeemEmailVerification(token: unknown, ip: string | null): Promise<VerifyResult> {
  if (!isWellFormedVerificationToken(token)) return { ok: false };
  const tokenHash = hashVerificationToken(token);
  const now = new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.emailVerificationToken.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          userId: true,
          usedAt: true,
          expiresAt: true,
          user: { select: { email: true, status: true, emailVerifiedAt: true } },
        },
      });
      if (!row || row.user.status === "INACTIVE") return { ok: false } as VerifyResult;

      if (row.user.emailVerifiedAt) {
        return { ok: true, email: row.user.email, already: true } as VerifyResult;
      }

      const claimed = await tx.emailVerificationToken.updateMany({
        where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now, usedIp: ip },
      });
      if (claimed.count !== 1) return { ok: false } as VerifyResult;

      await tx.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: now } });
      // Anything else outstanding for this account is now pointless.
      await tx.emailVerificationToken.updateMany({
        where: { userId: row.userId, usedAt: null },
        data: { usedAt: now },
      });
      return { ok: true, email: row.user.email, already: false } as VerifyResult;
    });
  } catch (e) {
    console.error("redeemEmailVerification failed", e);
    return { ok: false };
  }
}
