/**
 * Renders the outbound document email — the HTML the recipient sees and the
 * plain-text alternative.
 *
 * PURE MODULE (no provider, no session), so the wording below is unit-tested
 * rather than eyeballed once in a client's inbox.
 *
 * ─── WHAT THIS EMAIL DOES NOT CONTAIN ────────────────────────────────────────
 * There is no attachment, and the message says so in as many words.
 *
 * AEC-flow's documents are produced by the BROWSER's print dialog — the estimate,
 * the programme and the rest are laid out client-side and turned into a PDF by
 * the operating system's print pipeline. The server never holds that file, and
 * there is no PDF library in the stack to re-create it. So an "attachment" here
 * could only be a fake: a message whose body claims a file that was never
 * enclosed. That is the same lie as the green "Queued" tick this module replaces,
 * so the message names the document instead and tells the reader what to expect.
 *
 * A `link` may be supplied, but every document route in this app is behind
 * authentication. A link is therefore useful to a COLLEAGUE and useless to a
 * client, and the rendered text says exactly that rather than implying a public
 * URL. See `renderDocumentEmail`'s `link` parameter.
 */

export type DocumentEmailInput = {
  /** The user's own message, as typed. Plain text; newlines become paragraphs. */
  body: string;
  /** The document this email is about, e.g. "Villa Verde — Schedule.pdf". */
  documentName: string;
  /** The signed-in user's display name, resolved server-side. */
  senderName: string;
  /** The practice's name, resolved server-side from the company record. */
  firmName: string;
  /** Optional in-app link. Sign-in required — rendered with that caveat. */
  link?: string | null;
};

export type RenderedEmail = { html: string; text: string };

export function renderDocumentEmail(input: DocumentEmailInput): RenderedEmail {
  const body = (input.body ?? "").trim();
  const documentName = (input.documentName ?? "").trim();
  const senderName = (input.senderName ?? "").trim();
  const firmName = (input.firmName ?? "").trim();
  const link = (input.link ?? "").trim();

  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const bodyHtml = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#111827;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("\n                ");

  const docHtml = documentName
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;">
                  <tr><td style="padding:12px 16px;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;">Document</div>
                    <div style="margin-top:2px;font-size:14px;font-weight:600;color:#111827;">${escapeHtml(documentName)}</div>
                    <div style="margin-top:6px;font-size:12px;line-height:1.5;color:#6b7280;">${escapeHtml(NOT_ATTACHED)}</div>
                    ${link ? `<div style="margin-top:8px;font-size:12px;line-height:1.5;color:#6b7280;">${escapeHtml(LINK_NOTE)}<br><a href="${escapeAttr(link)}" style="color:#2563eb;word-break:break-all;">${escapeHtml(link)}</a></div>` : ""}
                  </td></tr>
                </table>`
    : "";

  const signature = [senderName, firmName].filter(Boolean).join(" · ");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:32px 32px 8px;">
                ${bodyHtml}
                ${docHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px;">
                <p style="margin:0;font-size:12px;color:#9ca3af;">${escapeHtml(signature)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textLines: string[] = [];
  if (body) textLines.push(body);
  if (documentName) {
    textLines.push("", `Document: ${documentName}`, NOT_ATTACHED);
    if (link) textLines.push(LINK_NOTE, link);
  }
  if (signature) textLines.push("", "--", signature);

  return { html, text: textLines.join("\n").trim() };
}

/**
 * The sentence that keeps this honest. Exported so the compose dialog can show
 * the recipient's exact wording back to the sender BEFORE they send — the user
 * should never learn what the email said from the reply.
 */
export const NOT_ATTACHED =
  "This document is not attached — AEC-flow cannot attach it. Save it as a PDF from the app and attach it yourself if the recipient needs the file.";

/** Why a link is not a substitute for the file, for anyone outside the practice. */
export const LINK_NOTE = "Open in AEC-flow (sign-in required — colleagues only):";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Attribute-position escaping for a URL we put in href. */
function escapeAttr(s: string): string {
  return escapeHtml(s);
}
