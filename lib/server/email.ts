/**
 * Transactional email (SERVER-ONLY) via Resend.
 *
 * Everything is guarded so the app keeps working when email isn't configured:
 * with no `RESEND_API_KEY` (local/dev) or an unverified sending domain, sends
 * return a soft `{ ok: false }` — callers fall back to sharing the link by hand.
 *
 * Env:
 *   RESEND_API_KEY  — required to actually send. UNSET **OR EMPTY** means every
 *                     send returns `{ ok: false }` without contacting anyone;
 *                     production currently holds the variable with an empty
 *                     value, which lands here.
 *   EMAIL_FROM      — verified sender, e.g. `AEC-Flow <noreply@aec-flow.com>`.
 *                     Defaults to Resend's sandbox sender (only delivers to the
 *                     Resend account owner) until the domain is verified.
 *
 * The `from` address is taken from the environment and NEVER from a caller: it
 * has to match a domain verified on the Resend account, and letting a request
 * choose it would be an open relay for the practice's own identity.
 */
import "server-only";
import { Resend } from "resend";

// `.trim() ||` rather than `??`: a variable that exists but is empty (exactly
// how RESEND_API_KEY is configured in production today) must fall back, not
// become an empty From header the provider rejects.
const FROM = process.env.EMAIL_FROM?.trim() || "AEC-Flow <onboarding@resend.dev>";

let client: Resend | null = null;
function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  // A key that is present but is not a key is worse than no key at all: it turns
  // "email is not configured" into the provider's "API key is invalid", which
  // reads as an outage and sends whoever is debugging it to the wrong place. The
  // repo's own .env ships the literal string `placeholder`, and real Resend keys
  // are all `re_`-prefixed, so this costs one comparison and removes a whole
  // class of misleading incident.
  if (!key || !key.startsWith("re_")) return null;
  if (!client) client = new Resend(key);
  return client;
}

export type SendResult = { ok: true; id: string | null } | { ok: false; error: string };

export async function sendEmail(opts: {
  to: string;
  /** Copied recipients. Validate them before they get here — see lib/email/recipients.ts. */
  cc?: string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<SendResult> {
  const resend = getClient();
  if (!resend) return { ok: false, error: "Email is not configured (RESEND_API_KEY missing)." };
  try {
    const cc = opts.cc?.filter((a) => a.trim().length > 0);
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      // Omitted entirely when empty: an empty `cc` array is a header the
      // provider need not see, and some clients render one.
      ...(cc && cc.length > 0 ? { cc } : {}),
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? stripHtml(opts.html),
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: data?.id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to send email." };
  }
}

/** Send a team-invitation email. Returns the same soft result shape. */
export async function sendInviteEmail(opts: {
  to: string;
  companyName: string;
  invitedByName?: string | null;
  role: string;
  acceptUrl: string;
  expiresAt?: Date | null;
}): Promise<SendResult> {
  const { subject, html } = renderInviteEmail(opts);
  return sendEmail({ to: opts.to, subject, html });
}

function renderInviteEmail(opts: {
  companyName: string;
  invitedByName?: string | null;
  role: string;
  acceptUrl: string;
  expiresAt?: Date | null;
}): { subject: string; html: string } {
  const inviter = opts.invitedByName?.trim();
  const roleLabel = opts.role.charAt(0) + opts.role.slice(1).toLowerCase();
  const expires = opts.expiresAt
    ? opts.expiresAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;
  const subject = `You're invited to join ${opts.companyName} on AEC-Flow`;
  const intro = inviter
    ? `${escapeHtml(inviter)} invited you to join <strong>${escapeHtml(opts.companyName)}</strong> on AEC-Flow`
    : `You've been invited to join <strong>${escapeHtml(opts.companyName)}</strong> on AEC-Flow`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background:#0f172a;padding:24px 32px;">
                <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.01em;">AEC-Flow</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#111827;">${intro} as a <strong>${escapeHtml(roleLabel)}</strong>.</p>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#4b5563;">Click below to set your name and password and join the team.</p>
                <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:#2563eb;">
                  <a href="${opts.acceptUrl}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Accept invitation</a>
                </td></tr></table>
                <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#6b7280;">Or paste this link into your browser:<br>
                  <a href="${opts.acceptUrl}" style="color:#2563eb;word-break:break-all;">${opts.acceptUrl}</a>
                </p>
                ${expires ? `<p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">This invitation expires on ${escapeHtml(expires)}.</p>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:11px;color:#9ca3af;">If you weren't expecting this, you can ignore this email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
