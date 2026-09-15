"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { issuePasswordReset } from "@/lib/server/password-reset";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { RATE_LIMITS, clientIpFrom, tooManyAttemptsMessage } from "@/lib/account-security/rate-limit-policy";

export type ForgotPasswordResult = { ok: true } | { ok: false; error: string };

/**
 * Request a reset link. The ONLY refusal a caller can see is the per-IP limit,
 * which says nothing about any account. Everything that depends on whether the
 * address exists runs in `after()`, once the response has already gone, so the
 * reply is the same in content and in timing either way.
 */
export async function requestPasswordResetAction(email: string): Promise<ForgotPasswordResult> {
  const h = await headers();
  const ip = clientIpFrom((name) => h.get(name));

  const perIp = await hitRateLimit(RATE_LIMITS.resetRequestIp, ip);
  if (!perIp.allowed) {
    return { ok: false, error: tooManyAttemptsMessage("reset requests", perIp.retryAfterSeconds) };
  }

  after(() => issuePasswordReset(email, ip));
  return { ok: true };
}
