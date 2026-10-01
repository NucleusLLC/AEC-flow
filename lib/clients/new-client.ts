/**
 * What every NEW client must carry: CLIENT NAME, EMAIL and CELL NUMBER.
 *
 * PURE MODULE — no Prisma, no session, no React. The server action
 * (`saveClient` in app/(app)/clients/actions.ts) is the gate that counts; the
 * forms run the same function first so the error appears next to the field
 * before a round trip. One rule set, two callers, so they cannot drift.
 *
 * CREATE ONLY. Clients created before this rule may hold no email or no cell
 * number. Editing such a client must keep working, so `saveClient` applies this
 * on mode "new" and nowhere else.
 *
 * EMAIL reuses `parseRecipientList` — a contact is often two people (a married
 * couple, two partners), and the app already decides what a valid address list
 * is in one place. A second parser here would accept or refuse different text
 * from the one that later sends the documents.
 *
 * The messages are English i18n keys (lib/i18n/dict/proposals.ts and its de/ja/
 * zh/pt twins); callers translate them with `t()`.
 */
import { parseRecipientList } from "@/lib/email/recipients";

export type NewClientField = "name" | "email" | "mobile";
export type NewClientErrors = Partial<Record<NewClientField, string>>;

export type NewClientDraft = {
  name?: string | null;
  email?: string | null;
  mobile?: string | null;
};

export type NewClientResult =
  | { ok: true; name: string; email: string; mobile: string }
  | { ok: false; errors: NewClientErrors };

/** Fewest digits a cell number may have. Short local numbers run to 7. */
export const MIN_CELL_DIGITS = 7;

export const NEW_CLIENT_MESSAGES = {
  nameRequired: "CLIENT NAME is required.",
  emailRequired: "EMAIL is required.",
  emailInvalid: "EMAIL is not a valid address.",
  mobileRequired: "CELL NUMBER is required.",
  mobileChars: "CELL NUMBER: digits, spaces, dashes, brackets and a leading + only.",
  mobileShort: "CELL NUMBER needs at least 7 digits.",
} as const;

/** Digits, then spaces / dashes / brackets anywhere, and at most one + in front. */
const CELL = /^\+?[\d\s\-()]+$/;

/**
 * Check a cell number. Returns the cleaned number (outer whitespace trimmed,
 * runs of inner whitespace collapsed) or the message key for what is wrong.
 */
export function checkCellNumber(
  raw: string | null | undefined,
): { ok: true; mobile: string } | { ok: false; error: string } {
  const mobile = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!mobile) return { ok: false, error: NEW_CLIENT_MESSAGES.mobileRequired };
  if (!CELL.test(mobile)) return { ok: false, error: NEW_CLIENT_MESSAGES.mobileChars };
  const digits = mobile.replace(/\D/g, "").length;
  if (digits < MIN_CELL_DIGITS) return { ok: false, error: NEW_CLIENT_MESSAGES.mobileShort };
  return { ok: true, mobile };
}

/**
 * Validate the three fields a new client must have. Every field is checked, so
 * a form can mark all three at once rather than one per attempt.
 *
 * On success `email` is the address list as it will be stored: unwrapped from
 * any "Name <addr>" form, de-duplicated, joined with ", ".
 */
export function validateNewClient(draft: NewClientDraft): NewClientResult {
  const errors: NewClientErrors = {};

  const name = (draft.name ?? "").trim();
  if (!name) errors.name = NEW_CLIENT_MESSAGES.nameRequired;

  let email = "";
  if (!(draft.email ?? "").trim()) {
    errors.email = NEW_CLIENT_MESSAGES.emailRequired;
  } else {
    const parsed = parseRecipientList(draft.email, "EMAIL");
    if (parsed.ok) email = parsed.addresses.join(", ");
    else errors.email = NEW_CLIENT_MESSAGES.emailInvalid;
  }

  let mobile = "";
  const cell = checkCellNumber(draft.mobile);
  if (cell.ok) mobile = cell.mobile;
  else errors.mobile = cell.error;

  if (errors.name || errors.email || errors.mobile) return { ok: false, errors };
  return { ok: true, name, email, mobile };
}

/** The first message in field order — for a one-line summary beside the marks. */
export function firstNewClientError(errors: NewClientErrors): string | undefined {
  return errors.name ?? errors.email ?? errors.mobile;
}
