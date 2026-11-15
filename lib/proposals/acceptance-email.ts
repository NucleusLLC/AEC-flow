/**
 * Client acceptance link in the proposal email (Release C). Pure, and free of node:crypto
 * so the client-side acceptance card can import it — the token rules live in
 * ./acceptance.ts, which is server-side only in practice.
 */
/**
 * The proposal email (lib/proposals/proposal-email.ts, `proposalEmailBody`) with the
 * acceptance link put where the client reads first: straight after the subject line,
 * before the figures. The body itself is reused unchanged — one message, not two.
 */
export function withAcceptanceLink(body: string, url: string, expiresOn: string | null): string {
  const lines = [
    "You can read this proposal and accept or decline it online — no account needed:",
    url,
    ...(expiresOn ? [`The link works until ${expiresOn}.`] : []),
  ].join("\n");
  const cut = body.indexOf("\n\n");
  if (cut < 0) return `${body}\n\n${lines}`;
  return `${body.slice(0, cut)}\n\n${lines}${body.slice(cut)}`;
}
