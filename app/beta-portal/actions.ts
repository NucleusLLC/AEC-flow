"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { RATE_LIMITS, clientIpFrom, tooManyAttemptsMessage } from "@/lib/account-security/rate-limit-policy";
import { sendBetaCodeEmail, sendEmail } from "@/lib/server/email";
import { fmt } from "@/lib/i18n/format";
import { getServerT } from "@/lib/i18n/server";

export async function requestBetaCode(input: { email: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  let outcome = "invalid";
  try {
    const t = await getServerT();
    const email = input.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: t("Please enter a valid email address.") };
    }
    const h = await headers();
    for (const [rule, subject] of [
      [RATE_LIMITS.codeRequestIp, clientIpFrom((n) => h.get(n))],
      [RATE_LIMITS.codeRequestEmail, email],
    ] as const) {
      const limit = await hitRateLimit(rule, subject);
      if (!limit.allowed) {
        outcome = "rate-limited";
        const message = tooManyAttemptsMessage("code requests", limit.retryAfterSeconds);
        const count = Math.max(1, Math.ceil(limit.retryAfterSeconds / 60));
        const translated = count === 1
          ? t("Too many code requests. Try again in {count} minute.")
          : t("Too many code requests. Try again in {count} minutes.");
        return { ok: false, error: translated ? fmt(translated, { count }) : message };
      }
    }
    outcome = "accepted";
    let code = await prisma.betaCode.findFirst({ where: { status: "issued", claimedEmail: email } });
    if (!code) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const available = await prisma.betaCode.findFirst({ where: { status: "available" }, orderBy: { createdAt: "asc" } });
        if (!available) break;
        const issued = await prisma.betaCode.updateMany({
          where: { id: available.id, status: "available" },
          data: { status: "issued", claimedEmail: email },
        });
        if (issued.count === 1) { code = available; break; }
      }
    }
    outcome = code ? "issued" : "pool-empty";
    await sendBetaCodeEmail({ to: email, ...(code ? { code: code.code } : {}) });
    const notify = process.env.BETA_NOTIFY_EMAIL?.trim();
    if (notify) {
      const text = `${email} — ${code ? `code issued ${code.keyPrefix}` : "pool empty"}`;
      await sendEmail({ to: notify, subject: "Beta code request", text, html: text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") });
    }
    return { ok: true };
  } catch {
    outcome = "failed";
    // Provider/database failures must not reveal pool or account state.
    return { ok: true };
  } finally {
    console.info(`[aecflow-beta-code-request] ${JSON.stringify({ kind: "server", route: "/beta-portal", outcome })}`);
  }
}
