/**
 * Email-verification tokens: generation, hashing, shape check and the link.
 *
 * Same shape as `reset-token.ts` and deliberately a SEPARATE module rather than a
 * shared one with a "kind" argument: a bug that let a verification token be
 * redeemed as a password reset would hand an account to anybody who could receive
 * one, and keeping the two stores and helpers apart is what makes that
 * impossible rather than merely unlikely.
 *
 * Free of Prisma and of requests, so it is unit-tested directly.
 */
import { createHash, randomBytes } from "node:crypto";

/**
 * How long a verification link lasts. SEVEN DAYS, not the reset link's hour:
 * a reset is something you just asked for and are waiting on, while this arrives
 * unbidden at signup and may be opened on Monday by someone who signed up on
 * Friday. The worst case also differs — a leaked verification link proves an
 * address, it does not grant an account — so the longer window costs little.
 */
export const VERIFICATION_TOKEN_TTL_HOURS = 24 * 7;

export function generateVerificationToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashVerificationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** True only for something shaped like a token we issued (43 base64url chars). */
export function isWellFormedVerificationToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function verificationTokenExpiry(now: Date): Date {
  return new Date(now.getTime() + VERIFICATION_TOKEN_TTL_HOURS * 3600_000);
}

/**
 * The link emailed to the user. The origin comes from CONFIGURATION, never from
 * the request's Host header — a forged Host would otherwise make the app email a
 * genuine token pointing at somebody else's domain.
 */
export function verificationLink(
  env: { NEXTAUTH_URL?: string; NEXT_PUBLIC_APP_URL?: string },
  token: string,
): string {
  const base = (env.NEXTAUTH_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim() || "https://aec-flow.com")
    .replace(/\/+$/, "");
  return `${base}/verify-email/${token}`;
}

/**
 * Should this account be asked to confirm its address?
 *
 * Pure, and the single place the question is answered, so the banner, the resend
 * action and any future gate cannot disagree about who is unverified.
 *
 * A user with no password has never signed in (an invited member who has not
 * accepted yet); asking them to verify is noise on a screen they cannot reach.
 */
export function needsVerification(user: {
  emailVerifiedAt?: Date | string | null;
  status?: string | null;
}): boolean {
  if (!user) return false;
  if (user.status === "INACTIVE") return false;
  return !user.emailVerifiedAt;
}
