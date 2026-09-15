/**
 * Password-reset tokens: generation, hashing, shape check and the link.
 *
 * SERVER-ONLY in practice (node:crypto) but free of Prisma and requests, so it is
 * unit-tested directly. The flow that uses it is `lib/server/password-reset.ts`.
 *
 * The token is 32 random bytes, base64url — 256 bits, so guessing is not a threat
 * model worth a second thought. Only its sha256 is stored: a leaked database row
 * cannot be turned back into a working link. sha256 rather than bcrypt is correct
 * here: bcrypt exists to slow guessing of LOW-entropy secrets; this one is not.
 */
import { createHash, randomBytes } from "node:crypto";

/** How long a link stays usable. Short, because an inbox is not a vault. */
export const RESET_TOKEN_TTL_MINUTES = 60;

export function generateResetToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * True only for something shaped like a token we issued (43 base64url chars).
 * Checked before any database lookup so junk from a URL never reaches a query.
 */
export function isWellFormedResetToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function resetTokenExpiry(now: Date): Date {
  return new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * 60_000);
}

/**
 * The link emailed to the user. The origin comes from CONFIGURATION, never from
 * the request's Host header: a forged Host would otherwise make the app email a
 * genuine token pointing at an attacker's domain. Same precedence as invitations.
 */
export function resetLink(env: { NEXTAUTH_URL?: string; NEXT_PUBLIC_APP_URL?: string }, token: string): string {
  const base = (env.NEXTAUTH_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim() || "https://aec-flow.com").replace(/\/+$/, "");
  return `${base}/reset-password/${token}`;
}
