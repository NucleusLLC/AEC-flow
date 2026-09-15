/**
 * Sending a document email, and recording that it happened.
 *
 * SERVER-ONLY in practice (it reaches the session, Prisma and the mail provider
 * through its imports). It deliberately does NOT `import "server-only"` itself,
 * so the orchestration below — which is the part that can lie to a user — can be
 * unit-tested with the provider and the database mocked at their module edges.
 *
 * ─── THE ONE RULE ────────────────────────────────────────────────────────────
 * `ok: true` is returned only when Resend came back with a message id. Not when
 * the call didn't throw; not when `error` was absent; not when the payload
 * "looked fine". A previous version of this feature logged the payload to the
 * console and showed a green "Queued" tick, and a programme reported as sent to
 * a client never left the building. Every branch below that cannot prove
 * delivery returns `ok: false`, including the one where the provider accepts the
 * request but returns no id.
 *
 * ─── WHAT THE CLIENT IS NOT TRUSTED WITH ─────────────────────────────────────
 * The browser supplies the recipient, the copy list, the subject and the body,
 * and nothing else. The company, the sender's name, the sender's email and the
 * `from` header are all resolved here from the signed-in user's own database row
 * (`requireActor`) and the environment. A companyId or a display name taken from
 * the request would let any signed-in user send mail as anyone, and file the
 * record under someone else's practice.
 *
 * ─── EVERY ATTEMPT IS RECORDED ───────────────────────────────────────────────
 * A row is written for the invalid-recipient refusal and the no-API-key refusal
 * as well as for real provider failures and successes. Those first two never
 * touch the network, and they are exactly the cases that used to leave no trace
 * at all.
 */
import { requireActor } from "@/lib/server/actor";
import { getFirmIdentity } from "@/lib/server/firm";
import { sendEmail } from "@/lib/server/email";
import { recordEmailAttempt } from "@/lib/data/email-log";
import { parseAddress, parseAddressList } from "@/lib/email/recipients";
import { renderDocumentEmail } from "@/lib/email/compose";

export type EmailFailureReason =
  /** No usable session — nothing was sent and nothing could be logged. */
  | "not_signed_in"
  /** The recipient or a cc address is not a valid address. Nothing was sent. */
  | "invalid_recipient"
  /** RESEND_API_KEY is unset, empty, or refused by the provider. Nothing was sent. */
  | "not_configured"
  /** EMAIL_FROM is unset, or the provider refused it as an address. Nothing was sent. */
  | "sender_not_configured"
  /** The account's daily or monthly sending allowance is spent. Nothing was sent. */
  | "quota_exceeded"
  /** The provider refused the `from` domain — EMAIL_FROM is not verified on the account. */
  | "domain_not_verified"
  /** The provider refused for some other reason; `error` carries its words. */
  | "provider_error"
  /** The provider accepted but returned no message id, so delivery is unproven. */
  | "unconfirmed";

export type SendDocumentEmailInput = {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  documentName: string;
  /** What the email is about, e.g. "schedule" / "<projectId>". Free text. */
  relatedType?: string | null;
  relatedId?: string | null;
  /** In-app path (must start with "/"), turned into an absolute URL here. */
  linkPath?: string | null;
};

export type SendDocumentEmailResult =
  | {
      ok: true;
      /** Resend's id. Its presence IS the confirmation — see the module note. */
      messageId: string;
      to: string;
      cc: string[];
      /** Null when the send succeeded but the record could not be written. */
      logId: string | null;
    }
  | {
      ok: false;
      reason: EmailFailureReason;
      /** A sentence the user can act on, not a stack trace. */
      error: string;
      logId: string | null;
    };

export async function sendDocumentEmail(
  input: SendDocumentEmailInput,
): Promise<SendDocumentEmailResult> {
  // 1. Who is acting. Throws for a missing / deactivated / company-less account;
  //    there is no tenant to file a record under in that case, so nothing is logged.
  let actor: Awaited<ReturnType<typeof requireActor>>;
  try {
    actor = await requireActor();
  } catch (e) {
    return {
      ok: false,
      reason: "not_signed_in",
      error: e instanceof Error && e.message ? e.message : "You must be signed in to send email.",
      logId: null,
    };
  }

  const subject = (input.subject ?? "").trim();
  const body = (input.body ?? "").trim();
  const documentName = (input.documentName ?? "").trim();
  const relatedType = clean(input.relatedType);
  const relatedId = clean(input.relatedId);

  /** Writes the attempt under the resolved actor. Never throws — see lib/data/email-log. */
  const record = (
    to: string,
    cc: string[],
    status: "SENT" | "FAILED",
    providerMessageId: string | null,
    error: string | null,
  ) =>
    recordEmailAttempt({
      senderId: actor.id,
      senderName: actor.name,
      senderEmail: actor.email,
      to,
      cc,
      subject,
      body,
      relatedType,
      relatedId,
      documentName: documentName || null,
      providerMessageId,
      status,
      error,
    });

  // 2. Recipients. Rejected, not silently dropped — a cc the sender believes went
  //    out and did not is the same failure mode in miniature.
  const recipient = parseAddress(input.to ?? "", "Recipient");
  if (!recipient.ok) {
    const logId = await record(truncate(input.to ?? ""), [], "FAILED", null, recipient.error);
    return { ok: false, reason: "invalid_recipient", error: recipient.error, logId };
  }
  const copies = parseAddressList(input.cc, "Cc");
  if (!copies.ok) {
    const logId = await record(recipient.address, [], "FAILED", null, copies.error);
    return { ok: false, reason: "invalid_recipient", error: copies.error, logId };
  }

  if (!subject) {
    const error = "A subject is required.";
    const logId = await record(recipient.address, copies.addresses, "FAILED", null, error);
    return { ok: false, reason: "invalid_recipient", error, logId };
  }
  if (!body) {
    const error = "The message is empty.";
    const logId = await record(recipient.address, copies.addresses, "FAILED", null, error);
    return { ok: false, reason: "invalid_recipient", error, logId };
  }

  // 3. Identity for the message itself, resolved server-side. `getFirmIdentity`
  //    reads the company's own practice profile; a failure there is cosmetic, so
  //    it degrades to no firm name rather than blocking a send.
  let firmName = "";
  try {
    firmName = (await getFirmIdentity()).name;
  } catch {
    firmName = "";
  }

  const { html, text } = renderDocumentEmail({
    body,
    documentName,
    senderName: actor.name,
    firmName,
    link: absoluteLink(input.linkPath),
  });

  // 4. The send. `sendEmail` never throws; it returns a soft result.
  const res = await sendEmail({ to: recipient.address, cc: copies.addresses, subject, html, text });

  // 5. Anything that is not an id-bearing acceptance is a failure, including the
  //    provider accepting the request and returning no id — `sendEmail` collapses
  //    that case into `ok: false` with code `unconfirmed`, so this one branch is
  //    now the only seam where "it looked fine" could become a green tick.
  if (!res.ok) {
    const reason = classify(res.error, res.code);
    const error = humanise(reason, res.error);
    const logId = await record(recipient.address, copies.addresses, "FAILED", null, res.error);
    return { ok: false, reason, error, logId };
  }

  const logId = await record(recipient.address, copies.addresses, "SENT", res.id, null);
  return { ok: true, messageId: res.id, to: recipient.address, cc: copies.addresses, logId };
}

/**
 * Read the provider's error text well enough to tell the user what to DO. The
 * three cases below are the three real configuration states of this app, and
 * "Failed to send" for all of them is what makes a fixable problem look like an
 * outage. Anything unrecognised keeps the provider's own words.
 */
export function classify(providerError: string, code?: string | null): EmailFailureReason {
  // Resend ships a stable machine-readable code on every error. Prefer it: the
  // prose below is a fallback for transports that have none, and matching prose
  // is how `invalid_from_address` — a broken SENDER — used to be reported to the
  // user as a bad RECIPIENT, and logged against the person being written to.
  switch ((code ?? "").trim()) {
    case "missing_api_key":
    case "invalid_api_key":
    case "restricted_api_key":
      return "not_configured";
    case "missing_from_address":
    case "invalid_from_address":
      return "sender_not_configured";
    case "not_found":
    case "validation_error":
      break; // too broad to trust — fall through to the prose match
    case "daily_quota_exceeded":
    case "monthly_quota_exceeded":
    case "rate_limit_exceeded":
      return "quota_exceeded";
    case "invalid_to_address":
      return "invalid_recipient";
    case "unconfirmed":
      return "unconfirmed";
  }

  const e = (providerError ?? "").toLowerCase();
  if (e.includes("resend_api_key") || e.includes("not configured") || e.includes("api key is invalid")) {
    return "not_configured";
  }
  if (e.includes("not verified") || e.includes("domain is not") || e.includes("verify a domain")) {
    return "domain_not_verified";
  }
  // `\bto\b`, not `includes("to")`: the bare substring matches "custom",
  // "storage", "not" and most of the provider's other sentences.
  if (e.includes("invalid") && (/\bto\b/.test(e) || e.includes("recipient") || e.includes("email"))) {
    return "invalid_recipient";
  }
  return "provider_error";
}

/** The sentence shown to the user for a classified failure. */
export function humanise(reason: EmailFailureReason, providerError: string): string {
  switch (reason) {
    case "not_configured":
      return "Email is not configured on this server, so nothing was sent. An administrator needs to set RESEND_API_KEY.";
    case "sender_not_configured":
      return "This server has no verified sending address, so nothing was sent. An administrator needs to set EMAIL_FROM to an address on the verified domain.";
    case "quota_exceeded":
      return `The email provider's sending allowance for this account is used up, so nothing was sent. (${providerError})`;
    case "domain_not_verified":
      return `The sending domain is not verified with the email provider, so nothing was sent. (${providerError})`;
    case "invalid_recipient":
      return providerError || "The recipient address was refused.";
    case "not_signed_in":
      return "You must be signed in to send email.";
    case "unconfirmed":
      return providerError;
    default:
      return providerError || "The email provider refused the message.";
  }
}

/**
 * Turn an in-app path into an absolute URL. Anything that is not a plain
 * same-origin path is dropped rather than sanitised: the only thing a caller can
 * do with a scheme or a protocol-relative `//host` here is put a link to
 * somewhere else into an email signed with the practice's name.
 */
function absoluteLink(path: string | null | undefined): string | null {
  const p = (path ?? "").trim();
  if (!p.startsWith("/") || p.startsWith("//")) return null;
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "");
  if (!base) return null;
  return `${base}${p}`;
}

function clean(s: string | null | undefined): string | null {
  const v = (s ?? "").trim();
  return v.length > 0 ? v : null;
}

function truncate(s: string): string {
  const v = (s ?? "").trim();
  return v.length > 200 ? v.slice(0, 200) : v;
}
