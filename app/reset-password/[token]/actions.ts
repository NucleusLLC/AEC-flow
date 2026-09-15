"use server";

import { headers } from "next/headers";
import { redeemPasswordReset, type RedeemResult } from "@/lib/server/password-reset";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { RATE_LIMITS, clientIpFrom, tooManyAttemptsMessage } from "@/lib/account-security/rate-limit-policy";

export async function resetPasswordAction(
  token: string,
  password: string,
  confirmation: string,
): Promise<RedeemResult> {
  const h = await headers();
  const ip = clientIpFrom((name) => h.get(name));

  const perIp = await hitRateLimit(RATE_LIMITS.resetSubmitIp, ip);
  if (!perIp.allowed) {
    return { ok: false, error: tooManyAttemptsMessage("attempts", perIp.retryAfterSeconds) };
  }

  try {
    return await redeemPasswordReset(token, password, confirmation, ip);
  } catch (e) {
    console.error("password reset redeem failed", e);
    return { ok: false, error: "Something went wrong setting your password. Please try again." };
  }
}
