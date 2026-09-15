/**
 * Fixed-window rate limiting backed by the `auth_rate_limits` table.
 *
 * SERVER-ONLY (Prisma). Rules and the pure decision live in
 * `lib/account-security/rate-limit-policy.ts`.
 *
 * WHY POSTGRES. The app runs on Vercel functions with no shared memory and no
 * Redis; an in-process counter would reset on every cold start and differ per
 * instance. One atomic upsert per attempt is cheap at this traffic.
 *
 * FAILS OPEN. If the counter cannot be read or written (the table missing because
 * the SQL has not been applied yet, a pool hiccup), the attempt is ALLOWED and the
 * error logged. A broken limiter must not become a site-wide lockout of sign-in.
 */
import "server-only";
import { prisma } from "@/lib/db";
import {
  decide,
  rateLimitKey,
  type RateLimitDecision,
  type RateLimitRule,
} from "@/lib/account-security/rate-limit-policy";

/** Rows older than this are dead weight; every rule's window is far shorter. */
const PRUNE_AFTER_SECONDS = 24 * 60 * 60;

/**
 * Count one attempt against `rule` for `subject` and decide whether it may proceed.
 *
 * The upsert is a single statement, so two concurrent attempts cannot both read a
 * stale count. In `DO UPDATE SET` every expression sees the OLD row, which is why
 * the two CASEs can test the old window independently.
 */
export async function hitRateLimit(rule: RateLimitRule, subject: string): Promise<RateLimitDecision> {
  const key = rateLimitKey(rule, subject);
  const windowSeconds = rule.windowSeconds;
  try {
    const rows = await prisma.$queryRaw<{ count: number; retry_after: number }[]>`
      WITH now_utc AS (SELECT (now() AT TIME ZONE 'UTC')::timestamp(3) AS t)
      INSERT INTO "auth_rate_limits" ("key", "count", "windowStart")
      SELECT ${key}, 1, t FROM now_utc
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "auth_rate_limits"."windowStart" <= (SELECT t FROM now_utc) - make_interval(secs => ${windowSeconds}::double precision)
          THEN 1 ELSE "auth_rate_limits"."count" + 1 END,
        "windowStart" = CASE
          WHEN "auth_rate_limits"."windowStart" <= (SELECT t FROM now_utc) - make_interval(secs => ${windowSeconds}::double precision)
          THEN (SELECT t FROM now_utc) ELSE "auth_rate_limits"."windowStart" END
      RETURNING
        "count",
        EXTRACT(EPOCH FROM ("windowStart" + make_interval(secs => ${windowSeconds}::double precision) - (SELECT t FROM now_utc)))::float8 AS retry_after`;
    const row = rows[0];
    if (!row) return { allowed: true };

    // Opportunistic cleanup, roughly one call in fifty. Never awaited into the
    // decision and never allowed to fail it.
    if (Math.random() < 0.02) {
      prisma.$executeRaw`
        DELETE FROM "auth_rate_limits"
        WHERE "windowStart" < (now() AT TIME ZONE 'UTC') - make_interval(secs => ${PRUNE_AFTER_SECONDS}::double precision)`
        .catch((e: unknown) => console.error("auth rate-limit prune failed", e));
    }

    return decide(rule, Number(row.count), Number(row.retry_after));
  } catch (e) {
    console.error(`auth rate-limit check failed for ${rule.prefix} (allowing)`, e);
    return { allowed: true };
  }
}

/** Forget a subject's counter — e.g. after a successful sign-in. Best-effort. */
export async function clearRateLimit(rule: RateLimitRule, subject: string): Promise<void> {
  try {
    await prisma.authRateLimit.deleteMany({ where: { key: rateLimitKey(rule, subject) } });
  } catch (e) {
    console.error(`auth rate-limit clear failed for ${rule.prefix}`, e);
  }
}
