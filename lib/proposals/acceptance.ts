/**
 * Service Proposal client acceptance by secure link (Release C) — the pure rules.
 *
 * PURE apart from node:crypto (random bytes, sha256): no Prisma, no request, no env read
 * except through an argument. Tested in acceptance.test.ts. The flow that uses it is
 * lib/data/proposal-acceptance.ts; the public page is app/p/[token].
 *
 * THE TOKEN mirrors the password-reset token (lib/account-security/reset-token.ts): 32
 * random bytes, base64url — 43 characters, 256 bits — and ONLY its sha256 is stored, so a
 * leaked database row cannot be turned back into a working link. sha256 rather than bcrypt
 * is right for a high-entropy secret. Unlike the /pay link (which must survive reprints of
 * an invoice and is stored as is), an acceptance link is handed out once and can be
 * re-created at will, so there is no reason to keep the token itself.
 *
 * WHICH PROPOSALS A CLIENT MAY ANSWER. Only one that has been issued and is still awaiting
 * the client: SENT or UNDER_CLIENT_REVIEW — the two statuses from which the status machine
 * (engine/status.ts) allows both ACCEPTED and REJECTED. Anything else (a draft, a revision
 * requested, accepted, superseded, withdrawn, expired) kills an open link. A link also
 * remembers the revision and version it was created for, so a proposal that somehow came
 * back to SENT under a new version would still not be accepted through an old link.
 *
 * WHAT A LINK LOOKS LIKE FROM OUTSIDE. Three states: open (the form), decided (read-only:
 * who answered and when) and invalid. Unknown, malformed, expired and revoked tokens are
 * all the same "invalid" — the public page cannot tell a guess from a dead link, and must
 * not.
 */
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { canTransition, type ServiceProposalStatus } from "./engine/status";
import { isLang, type Lang } from "@/lib/i18n/types";

export const ACCEPTANCE_TOKEN_BYTES = 32;
/** base64url of 32 bytes, no padding. */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

/** Default life of a link. A client normally answers within a couple of weeks. */
export const ACCEPTANCE_LINK_TTL_DAYS = 30;

export function generateAcceptanceToken(random: (n: number) => Buffer = randomBytes): string {
  return random(ACCEPTANCE_TOKEN_BYTES).toString("base64url");
}

export function hashAcceptanceToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Cheap shape check before any database lookup, so junk from a URL never reaches a query. */
export function isWellFormedAcceptanceToken(token: unknown): token is string {
  return typeof token === "string" && TOKEN_SHAPE.test(token);
}

/**
 * The public link. The origin comes from CONFIGURATION, never from the request's Host
 * header — a forged Host would otherwise make the app hand out a genuine token pointing at
 * someone else's domain. Same precedence as the invitation, reset and pay links.
 */
export function acceptanceUrl(
  env: { NEXTAUTH_URL?: string; NEXT_PUBLIC_APP_URL?: string },
  token: string,
): string {
  const base = (env.NEXTAUTH_URL?.trim() || env.NEXT_PUBLIC_APP_URL?.trim() || "https://aec-flow.com").replace(
    /\/+$/,
    "",
  );
  return `${base}/p/${token}`;
}

/** Statuses in which the client may still answer the proposal. */
export const CLIENT_ACCEPTABLE_STATUSES: readonly ServiceProposalStatus[] = ["SENT", "UNDER_CLIENT_REVIEW"];

export function isClientAcceptable(status: ServiceProposalStatus): boolean {
  return CLIENT_ACCEPTABLE_STATUSES.includes(status);
}

export type ClientDecision = "ACCEPTED" | "DECLINED";

export function isClientDecision(v: unknown): v is ClientDecision {
  return v === "ACCEPTED" || v === "DECLINED";
}

/**
 * The proposal status a client's answer moves the proposal to. A decline is the status
 * machine's REJECTED — it exists and is reachable from both acceptable statuses (asserted
 * in the test), so a decline is a real transition, not only a note.
 */
export function decisionTargetStatus(decision: ClientDecision): ServiceProposalStatus {
  return decision === "ACCEPTED" ? "ACCEPTED" : "REJECTED";
}

/** True when the status machine lets this answer be applied to a proposal in `status`. */
export function canApplyDecision(status: ServiceProposalStatus, decision: ClientDecision): boolean {
  return isClientAcceptable(status) && canTransition(status, decisionTargetStatus(decision));
}

/**
 * When a new link stops working: ACCEPTANCE_LINK_TTL_DAYS from now, or the end (UTC) of the
 * proposal's "valid until" day if that comes first — an offer cannot be accepted after it
 * lapsed. Null when the validity date has already passed: no link should be created then.
 */
export function acceptanceLinkExpiry(now: Date, validUntil?: string | null): Date | null {
  const byTtl = new Date(now.getTime() + ACCEPTANCE_LINK_TTL_DAYS * 24 * 60 * 60 * 1000);
  if (!validUntil) return byTtl;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(validUntil);
  if (!m) return byTtl;
  const endOfDay = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999));
  if (endOfDay.getTime() <= now.getTime()) return null;
  return endOfDay < byTtl ? endOfDay : byTtl;
}

export type AcceptanceLinkFacts = {
  expiresAt: Date;
  revokedAt: Date | null;
  decision: string | null;
  revision: number;
  versionLabel: string | null;
};

export type ProposalFacts = {
  status: ServiceProposalStatus;
  revision: number;
  versionLabel: string | null;
  deletedAt: Date | null;
};

export type LinkState = "open" | "decided" | "invalid";

/**
 * What the public page shows for a link.
 *
 *  - A revoked link is invalid, answered or not: revoking is the practice taking the page down.
 *  - An answered link stays readable (who answered, when) even after it would have expired
 *    and after the proposal moved on — that page is the client's receipt.
 *  - An unanswered link is open only while it is unexpired AND the proposal is still awaiting
 *    the client at the same revision and version it was created for.
 */
export function acceptanceLinkState(
  link: AcceptanceLinkFacts | null,
  proposal: ProposalFacts | null,
  now: Date,
): LinkState {
  if (!link || link.revokedAt) return "invalid";
  if (!proposal || proposal.deletedAt) return "invalid";
  if (link.decision) return isClientDecision(link.decision) ? "decided" : "invalid";
  if (link.expiresAt.getTime() <= now.getTime()) return "invalid";
  if (!isClientAcceptable(proposal.status)) return "invalid";
  if (proposal.revision !== link.revision) return "invalid";
  if ((proposal.versionLabel ?? null) !== (link.versionLabel ?? null)) return "invalid";
  return "open";
}

/** Whether the practice may still revoke a link (an answered one is a record, not a link). */
export function isRevocable(link: Pick<AcceptanceLinkFacts, "revokedAt" | "decision" | "expiresAt">, now: Date): boolean {
  return !link.revokedAt && !link.decision && link.expiresAt.getTime() > now.getTime();
}

// ── The client's form ─────────────────────────────────────────────────────────

/** Collapse runs of whitespace and trim — what "the same name" means when comparing. */
export function normaliseName(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** The typed signature must be the signer's own name (case and spacing aside). */
export function signatureMatchesName(signature: string, name: string): boolean {
  return normaliseName(signature).toLocaleLowerCase() === normaliseName(name).toLocaleLowerCase();
}

/** A form checkbox arrives as "on" (or "true"); anything else is unticked. */
const checkbox = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());

const optionalText = (max: number, tooLong: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? normaliseName(v) : ""),
    z.string().max(max, tooLong),
  ).transform((v) => (v ? v : null));

export const ACCEPTANCE_ERRORS = {
  name: "Enter your full name.",
  nameLong: "Your name is too long.",
  titleLong: "Position is too long.",
  companyLong: "Company is too long.",
  onBehalf: "Tick the box to confirm you accept on behalf of the client.",
  signature: "Type your full name as your signature.",
  signatureMismatch: "The signature must be your full name, exactly as entered above.",
  reasonLong: "The reason is too long.",
} as const;

export const acceptanceFormSchema = z
  .object({
    name: z.preprocess(
      (v) => (typeof v === "string" ? normaliseName(v) : ""),
      z.string().min(2, ACCEPTANCE_ERRORS.name).max(120, ACCEPTANCE_ERRORS.nameLong),
    ),
    title: optionalText(120, ACCEPTANCE_ERRORS.titleLong),
    company: optionalText(160, ACCEPTANCE_ERRORS.companyLong),
    onBehalf: checkbox.refine((v) => v === true, ACCEPTANCE_ERRORS.onBehalf),
    signature: z.preprocess(
      (v) => (typeof v === "string" ? normaliseName(v) : ""),
      z.string().min(2, ACCEPTANCE_ERRORS.signature).max(120, ACCEPTANCE_ERRORS.signature),
    ),
  })
  .refine((v) => signatureMatchesName(v.signature, v.name), {
    message: ACCEPTANCE_ERRORS.signatureMismatch,
    path: ["signature"],
  });

export type AcceptanceForm = z.infer<typeof acceptanceFormSchema>;

export const declineFormSchema = z.object({
  name: optionalText(120, ACCEPTANCE_ERRORS.nameLong),
  reason: z
    .preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string().max(2000, ACCEPTANCE_ERRORS.reasonLong))
    .transform((v) => (v ? v : null)),
});

export type DeclineForm = z.infer<typeof declineFormSchema>;

export type FormIssues = Partial<Record<string, string>>;

function issuesOf(error: z.ZodError): FormIssues {
  const out: FormIssues = {};
  for (const i of error.issues) {
    const key = String(i.path[0] ?? "form");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}

export function parseAcceptanceForm(
  raw: Record<string, unknown>,
): { ok: true; value: AcceptanceForm } | { ok: false; issues: FormIssues } {
  const r = acceptanceFormSchema.safeParse(raw);
  return r.success ? { ok: true, value: r.data } : { ok: false, issues: issuesOf(r.error) };
}

export function parseDeclineForm(
  raw: Record<string, unknown>,
): { ok: true; value: DeclineForm } | { ok: false; issues: FormIssues } {
  const r = declineFormSchema.safeParse(raw);
  return r.success ? { ok: true, value: r.data } : { ok: false, issues: issuesOf(r.error) };
}

/** Bound what is stored from request headers — both are caller-controlled. */
export function clipHeader(v: string | null | undefined, max: number): string | null {
  const s = (v ?? "").trim();
  return s ? s.slice(0, max) : null;
}

/** The history line written when the client answers through the link. */
export function decisionHistoryReason(
  decision: ClientDecision,
  who: { name: string; title?: string | null; company?: string | null },
  versionLabel: string | null,
  declineReason?: string | null,
): string {
  const role = [who.title, who.company].filter(Boolean).join(", ");
  const by = role ? `${who.name} (${role})` : who.name;
  const v = versionLabel ? ` v${versionLabel}` : "";
  if (decision === "ACCEPTED") return `Accepted by the client through the acceptance link${v}: ${by}.`;
  const base = `Declined by the client through the acceptance link${v}${who.name ? `: ${by}` : ""}.`;
  return declineReason ? `${base} Reason: ${declineReason}` : base;
}

/** What the public accept / decline action answers. Messages are already translated. */
export type ProposalDecisionResult =
  | { ok: true }
  | { ok: false; error: string; issues?: FormIssues; invalid?: boolean };

/** The one message every dead, unknown or malformed link gets. */
export const LINK_INVALID_MESSAGE = "This link is no longer valid";

/**
 * The language the public page speaks: the proposal's own (its "languageCode"), when it is
 * one the app has, else English — never the viewer's cookie, which a client does not have.
 */
export function proposalLanguage(code: string | null | undefined): Lang {
  const c = (code ?? "").trim().toLowerCase().slice(0, 2);
  return isLang(c) ? c : "en";
}
