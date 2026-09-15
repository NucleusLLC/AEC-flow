/**
 * Rate-limit rules for the pre-session auth endpoints, and the pure pieces of
 * applying them. No Prisma, no request objects — the counter itself lives in
 * `lib/server/rate-limit.ts`; everything here is arithmetic and string handling
 * so it can be unit-tested without a database.
 *
 * WHY THESE NUMBERS. Every limit is keyed on something an attacker controls
 * cheaply, so each one answers a specific abuse:
 *   - login by IP     — password spraying from one address across many accounts.
 *   - login by email  — guessing one account's password from many addresses.
 *                       Generous enough that a real person mistyping never meets
 *                       it, and a successful sign-in clears it.
 *   - signup by IP    — scripted account (and company) creation.
 *   - reset request   — by IP to stop the form being used as a mail cannon; by
 *                       email to stop one inbox being flooded. The email limit is
 *                       applied SILENTLY so it cannot reveal whether an account exists.
 *   - reset submit    — bounds token guessing (already hopeless at 256 bits).
 *   - invite accept   — same, for invitation tokens.
 */

export type RateLimitRule = {
  /** Key namespace, e.g. `login:email`. Stable: changing it resets every counter. */
  prefix: string;
  /** Attempts allowed inside one window. The (limit + 1)th is refused. */
  limit: number;
  windowSeconds: number;
};

export const RATE_LIMITS = {
  loginIp: { prefix: "login:ip", limit: 30, windowSeconds: 15 * 60 },
  loginEmail: { prefix: "login:email", limit: 10, windowSeconds: 15 * 60 },
  signupIp: { prefix: "signup:ip", limit: 5, windowSeconds: 60 * 60 },
  resetRequestIp: { prefix: "reset-request:ip", limit: 5, windowSeconds: 15 * 60 },
  resetRequestEmail: { prefix: "reset-request:email", limit: 3, windowSeconds: 60 * 60 },
  resetSubmitIp: { prefix: "reset-submit:ip", limit: 10, windowSeconds: 15 * 60 },
  inviteAcceptIp: { prefix: "invite-accept:ip", limit: 10, windowSeconds: 15 * 60 },
} as const satisfies Record<string, RateLimitRule>;

/** Longest subject kept in a key — a hostile "email" can be arbitrarily long. */
const MAX_SUBJECT = 320;

/**
 * The counter key for a rule and a subject (an IP or an email address). Subjects
 * are trimmed and lower-cased so `Greg@X.com ` and `greg@x.com` share a counter —
 * otherwise changing the case of an address would reset its limit.
 */
export function rateLimitKey(rule: RateLimitRule, subject: string): string {
  const s = (subject ?? "").trim().toLowerCase().slice(0, MAX_SUBJECT) || "unknown";
  return `${rule.prefix}:${s}`;
}

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/**
 * Decide from the counter's state AFTER this attempt was counted. `retryAfter` is
 * the seconds left in the window; it is floored at 1 so a refusal never tells the
 * user to "try again in 0 minutes".
 */
export function decide(rule: RateLimitRule, count: number, retryAfterSeconds: number): RateLimitDecision {
  if (count <= rule.limit) return { allowed: true };
  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterSeconds)) };
}

/** "Too many sign-in attempts. Try again in 12 minutes." */
export function tooManyAttemptsMessage(what: string, retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many ${what}. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/**
 * The caller's IP from request headers. On Vercel `x-vercel-forwarded-for` is set
 * by the platform; `x-forwarded-for` is the fallback, and only its FIRST entry is
 * the client. With neither, every such caller shares the `unknown` bucket — the
 * safe failure, since it can only make limiting stricter, never absent.
 */
export function clientIpFrom(get: (name: string) => string | null | undefined): string {
  for (const name of ["x-vercel-forwarded-for", "x-forwarded-for", "x-real-ip"]) {
    const first = get(name)?.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return "unknown";
}
