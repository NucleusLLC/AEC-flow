/**
 * "Forgot password": issuing a reset link and redeeming it.
 *
 * SERVER-ONLY (Prisma, bcrypt, email). Called from the server actions in
 * `app/forgot-password/actions.ts` and `app/reset-password/[token]/actions.ts`.
 *
 * ─── THE ENUMERATION RULE ─────────────────────────────────────────────────────
 * Requesting a reset must look identical whether or not the address has an
 * account: same message, and — because the action hands this work to `after()` —
 * the same response time. Nothing in `issuePasswordReset` returns a value or
 * throws for the caller to branch on. Keep it that way.
 *
 * ─── THE TENANT RULE ──────────────────────────────────────────────────────────
 * `User` is not in TENANT_MODELS and this runs with no session, exactly like
 * sign-in in `lib/auth.ts`. Lookups here are by email or by token hash — both
 * globally unique — so no company filter applies, and none can be added.
 *
 * ─── KNOWN GAP ────────────────────────────────────────────────────────────────
 * Sessions are NextAuth JWTs, which nothing can revoke. A reset stops the OLD
 * password from signing in again, but a session already issued on it lives until
 * the token expires. Revocation needs a per-user session version checked in the
 * jwt callback — a separate change.
 */
import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/server/email";
import { clearRateLimit, hitRateLimit } from "@/lib/server/rate-limit";
import { RATE_LIMITS } from "@/lib/account-security/rate-limit-policy";
import {
  RESET_TOKEN_TTL_MINUTES,
  generateResetToken,
  hashResetToken,
  isWellFormedResetToken,
  resetLink,
  resetTokenExpiry,
} from "@/lib/account-security/reset-token";
import { validatePasswordConfirmation } from "@/lib/password-policy";

/** Same cost as every other hash in the app — see lib/server/password.ts. */
const BCRYPT_COST = 10;

function isPlausibleEmail(email: string): boolean {
  return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Issue and email a reset link, if — and only if — the address belongs to an
 * active account that has a password. Every other case does nothing, silently.
 * Never throws.
 */
export async function issuePasswordReset(rawEmail: unknown, ip: string): Promise<void> {
  try {
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
    if (!isPlausibleEmail(email)) return;

    // Per-address flood limit. Silent on purpose: telling the requester "too many
    // requests for this address" would confirm the address is being tracked.
    const perEmail = await hitRateLimit(RATE_LIMITS.resetRequestEmail, email);
    if (!perEmail.allowed) return;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, status: true, passwordHash: true },
    });
    // No account, a deactivated one, or an invited user who never set a password
    // (they finish joining through their invitation, not through here).
    if (!user || user.status === "INACTIVE" || !user.passwordHash) return;

    const now = new Date();
    const token = generateResetToken();

    // Only the newest link works: retire any still-open ones first.
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    });
    const row = await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(token),
        expiresAt: resetTokenExpiry(now),
        requestedIp: ip,
      },
      select: { id: true },
    });

    const sent = await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl: resetLink(process.env, token),
      expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
    });
    await prisma.passwordResetToken.update({
      where: { id: row.id },
      data: sent.ok
        ? { emailStatus: "SENT" }
        : { emailStatus: "FAILED", emailError: sent.error.slice(0, 2_000) },
    });
    if (!sent.ok) console.error(`password reset email failed for user ${user.id}: ${sent.error}`);
  } catch (e) {
    console.error("password reset issue failed", e);
  }
}

/** Is this link still redeemable? Used to decide what the reset page shows. */
export async function isResetTokenUsable(token: unknown): Promise<boolean> {
  if (!isWellFormedResetToken(token)) return false;
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    select: { usedAt: true, expiresAt: true, user: { select: { status: true } } },
  });
  return !!row && !row.usedAt && row.expiresAt > new Date() && row.user.status !== "INACTIVE";
}

export type RedeemResult = { ok: true; email: string } | { ok: false; error: string; expired?: boolean };

const LINK_UNUSABLE = "This reset link has expired or has already been used. Request a new one.";

/**
 * Set a new password with a reset link. The password is validated BEFORE the token
 * is touched, so a too-short password does not burn the link.
 *
 * Claim, write and retire happen in one transaction: the `updateMany` guarded on
 * `usedAt: null` and an unexpired `expiresAt` is what makes the link single-use
 * under concurrency — two simultaneous submits cannot both match the row.
 */
export async function redeemPasswordReset(
  token: unknown,
  password: unknown,
  confirmation: unknown,
  ip: string,
): Promise<RedeemResult> {
  const policy = validatePasswordConfirmation(password, confirmation);
  if (!policy.ok) return { ok: false, error: policy.error };
  if (!isWellFormedResetToken(token)) return { ok: false, error: LINK_UNUSABLE, expired: true };

  const passwordHash = await bcrypt.hash(password as string, BCRYPT_COST);
  const tokenHash = hashResetToken(token);
  const now = new Date();

  const email = await prisma.$transaction(async (tx) => {
    const row = await tx.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, user: { select: { email: true, status: true } } },
    });
    if (!row || row.user.status === "INACTIVE") return null;

    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now, usedIp: ip },
    });
    if (claimed.count !== 1) return null;

    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    // Any other link issued to this account is now pointless — and a liability.
    await tx.passwordResetToken.updateMany({
      where: { userId: row.userId, usedAt: null },
      data: { usedAt: now },
    });
    return row.user.email;
  });

  if (!email) return { ok: false, error: LINK_UNUSABLE, expired: true };

  // Someone who was locked out by failed sign-ins has just proved they own the
  // inbox; let them straight in with the new password.
  await clearRateLimit(RATE_LIMITS.loginEmail, email);
  return { ok: true, email };
}
