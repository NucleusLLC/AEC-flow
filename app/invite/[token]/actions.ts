"use server";

import { headers } from "next/headers";
import { acceptInvitation } from "@/lib/data/invitations";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { RATE_LIMITS, clientIpFrom, tooManyAttemptsMessage } from "@/lib/account-security/rate-limit-policy";

export async function acceptInviteAction(token: string, name: string, password: string) {
  const h = await headers();
  const perIp = await hitRateLimit(RATE_LIMITS.inviteAcceptIp, clientIpFrom((n) => h.get(n)));
  if (!perIp.allowed) {
    return { ok: false as const, error: tooManyAttemptsMessage("attempts", perIp.retryAfterSeconds) };
  }
  return acceptInvitation(token, name, password);
}
