"use server";

/**
 * The client's answer from the public acceptance page /p/<token>. PUBLIC: no session
 * (proxy.ts lets /p/* through), so the token is the only key.
 *
 * Order matters:
 *   1. Rate-limit by IP FIRST, before the token is even looked at, so a guessing script is
 *      bounded whether its guesses hit or not.
 *   2. Shape-check and resolve the token (raw lookup by hash → link id + company only).
 *   3. Everything else inside `runAsCompany`, so the tenant extension scopes every query to
 *      the practice the link belongs to. React `cache` cannot carry the company through a
 *      server action, which is why this is not `companyOverride()`.
 *
 * An unknown, malformed, expired, revoked or already-used link all answer the same
 * `invalid` result with the same English message — the page then renders the one generic
 * "no longer valid" view.
 */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { RATE_LIMITS, clientIpFrom } from "@/lib/account-security/rate-limit-policy";
import { runAsCompany } from "@/lib/server/request-company";
import {
  loadPublicAcceptance,
  recordClientDecision,
  resolveAcceptanceToken,
} from "@/lib/data/proposal-acceptance";
import {
  LINK_INVALID_MESSAGE,
  clipHeader,
  isClientDecision,
  isWellFormedAcceptanceToken,
  parseAcceptanceForm,
  parseDeclineForm,
  proposalLanguage,
  type FormIssues,
  type ProposalDecisionResult,
} from "@/lib/proposals/acceptance";
import { translate } from "@/lib/i18n/dictionaries";

export async function submitProposalDecisionAction(
  token: string,
  decision: string,
  raw: Record<string, unknown>,
): Promise<ProposalDecisionResult> {
  const invalid: ProposalDecisionResult = { ok: false, invalid: true, error: LINK_INVALID_MESSAGE };
  const h = await headers();
  const ip = clientIpFrom((n) => h.get(n));
  const limit = await hitRateLimit(RATE_LIMITS.proposalDecisionIp, ip);

  if (!isClientDecision(decision) || !isWellFormedAcceptanceToken(token)) return invalid;
  const hit = await resolveAcceptanceToken(token);
  if (!hit) return invalid;

  const form = raw && typeof raw === "object" ? raw : {};
  return runAsCompany(hit.companyId, async () => {
    const view = await loadPublicAcceptance(hit.linkId);
    if (view.state !== "open" || !view.proposal) return invalid;
    const lang = proposalLanguage(view.proposal.input.languageCode);
    const t = (s: string) => translate(lang, s);

    if (!limit.allowed) {
      return { ok: false, error: t("Too many attempts. Please try again in a few minutes.") };
    }

    const translateIssues = (issues: FormIssues): FormIssues =>
      Object.fromEntries(Object.entries(issues).map(([k, v]) => [k, v ? t(v) : v]));
    const meta = {
      ip: ip === "unknown" ? null : clipHeader(ip, 64),
      userAgent: clipHeader(h.get("user-agent"), 400),
    };

    let outcome;
    if (decision === "ACCEPTED") {
      const parsed = parseAcceptanceForm(form);
      if (!parsed.ok) {
        return { ok: false, error: t("Please check the highlighted fields."), issues: translateIssues(parsed.issues) };
      }
      outcome = await recordClientDecision(hit.linkId, { decision, form: parsed.value }, meta);
    } else {
      const parsed = parseDeclineForm(form);
      if (!parsed.ok) {
        return { ok: false, error: t("Please check the highlighted fields."), issues: translateIssues(parsed.issues) };
      }
      outcome = await recordClientDecision(hit.linkId, { decision, form: parsed.value }, meta);
    }

    if (!outcome.ok) {
      return outcome.reason === "invalid"
        ? invalid
        : { ok: false, error: t("Something went wrong. Please try again.") };
    }
    revalidatePath(`/p/${token}`);
    revalidatePath(`/design/service-proposals/${view.proposal.id}`);
    return { ok: true };
  });
}
