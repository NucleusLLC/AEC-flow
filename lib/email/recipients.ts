/**
 * Recipient parsing and validation for outbound document email.
 *
 * PURE MODULE — no Prisma, no session, no provider. It is imported by the server
 * action (`lib/server/document-email.ts`) and unit-tested directly, because this
 * is the layer that decides whether a send is even attempted.
 *
 * WHY IT REJECTS RATHER THAN DROPS. The bug this whole feature exists to fix was
 * a send that silently did nothing and reported success. Quietly discarding a
 * malformed cc address is the same class of mistake in miniature: the user
 * believes three people were copied and two were. So a bad address fails the
 * whole call with a message naming the offending text, and nothing is sent.
 *
 * The address grammar is deliberately conservative — it is not RFC 5322. A real
 * RFC parser accepts quoted local parts and bare-hostname domains that no client
 * mailbox actually uses, and every one of those would reach the provider and be
 * rejected there, i.e. after we had already told the user we were sending. The
 * rule here is the one people's addresses actually satisfy: some.name@host.tld.
 */

/** A single validated address, or the reason it was refused. */
export type AddressResult = { ok: true; address: string } | { ok: false; error: string };

/** A validated (possibly empty) address list, or the reason it was refused. */
export type AddressListResult = { ok: true; addresses: string[] } | { ok: false; error: string };

/**
 * How many people one message may copy. Not a provider limit — a blast radius.
 * A pasted column from a spreadsheet is the realistic way this field gets 400
 * entries, and that is a mistake worth stopping before it is a mail-out.
 */
export const MAX_CC = 20;

/** Longest address we accept. RFC's practical ceiling is 254 octets. */
export const MAX_ADDRESS_LENGTH = 254;

/**
 * `user@host.tld`, with at least one dot in the domain and no address-list or
 * angle-bracket punctuation inside either half. See the module note on why this
 * is stricter than RFC 5322.
 */
const ADDRESS = /^[^\s@,;<>"]+@[^\s@,;<>".]+(?:\.[^\s@,;<>".]+)+$/;

/**
 * Strip a display name: `Jane Doe <jane@x.com>` → `jane@x.com`. Mail clients
 * produce this shape constantly and users paste it straight in; refusing it
 * would read as a bug, not as strictness.
 */
function unwrap(raw: string): string {
  const angled = /<([^<>]*)>\s*$/.exec(raw.trim());
  return (angled ? angled[1] : raw).trim();
}

/** Validate one address. `label` names the field in the error text ("Recipient", "Cc"). */
export function parseAddress(raw: string, label = "Recipient"): AddressResult {
  const address = unwrap(raw ?? "");
  if (!address) return { ok: false, error: `${label} is required.` };
  if (address.length > MAX_ADDRESS_LENGTH) {
    return { ok: false, error: `${label} address is too long.` };
  }
  if (!ADDRESS.test(address)) {
    return { ok: false, error: `“${trim(raw)}” is not a valid email address.` };
  }
  return { ok: true, address };
}

/**
 * Validate a comma / semicolon / newline separated list. An empty or
 * whitespace-only input is a valid EMPTY list, not an error — cc is optional.
 * Duplicates are collapsed case-insensitively; a duplicate is a typo, not a
 * refusal, and the deduplication is visible because the caller is handed the
 * exact list that will be sent and shows it back.
 */
export function parseAddressList(raw: string | null | undefined, label = "Cc"): AddressListResult {
  const parts = (raw ?? "")
    .split(/[,;\n]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return { ok: true, addresses: [] };
  if (parts.length > MAX_CC) {
    return { ok: false, error: `${label} has ${parts.length} addresses; the limit is ${MAX_CC}.` };
  }
  const addresses: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const one = parseAddress(part, label);
    if (!one.ok) return one;
    const key = one.address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    addresses.push(one.address);
  }
  return { ok: true, addresses };
}

/** First 60 characters of the offending text, for an error a human can act on. */
function trim(raw: string): string {
  const s = (raw ?? "").trim();
  return s.length > 60 ? `${s.slice(0, 60)}…` : s;
}
