/**
 * Password policy and the password-management role gate.
 *
 * PURE + CLIENT-SAFE. No Prisma, no session, no bcrypt, no React — it is imported
 * by the server actions (where it is *enforced*) and by the client forms (where
 * it is only *mirrored* for immediate feedback). Keeping one definition means the
 * browser and the server can never disagree about what a valid password is.
 *
 * The client copy is a convenience, never a control: every rule here is re-checked
 * in `lib/server/password.ts` before anything is hashed or written.
 */

/**
 * Minimum length. Length is the only rule that meaningfully raises the cost of a
 * guess; composition rules ("one capital, one digit, one symbol") push users to
 * predictable mutations of a short word, so we deliberately have none. There is
 * also no maximum — a passphrase must be allowed to be long.
 *
 * NOTE ON BCRYPT: bcrypt hashes only the first 72 bytes of input, so passwords
 * longer than that are silently truncated at the hashing step. That is a property
 * of the hash the whole app already uses (`lib/auth.ts`), not of this policy, and
 * 72 bytes is far more entropy than any real password carries. We deliberately do
 * NOT reject long passphrases over it.
 */
export const PASSWORD_MIN_LENGTH = 10;

/** Roles that may set another user's password, alongside the founder. */
export const PASSWORD_ADMIN_ROLES = ["ADMIN", "DIRECTOR"] as const;

export type PasswordAdminRole = (typeof PASSWORD_ADMIN_ROLES)[number];

/** Discriminated result, mirroring the server-action convention in this repo. */
export type PolicyResult = { ok: true } | { ok: false; error: string };

/**
 * Validate a proposed new password.
 *
 * Takes `unknown` on purpose: a server action's argument arrives over the wire and
 * is not guaranteed to be a string just because TypeScript says so.
 */
export function validateNewPassword(password: unknown): PolicyResult {
  if (typeof password !== "string" || password === "") {
    return { ok: false, error: "Enter a new password." };
  }
  // Whitespace-only is rejected even when it is long enough to pass the length
  // check — "          " is not a password anyone can retype.
  if (password.trim() === "") {
    return { ok: false, error: "A password cannot be only spaces." };
  }
  // Length is measured on the raw string, not the trimmed one: leading/trailing
  // spaces inside a passphrase are the user's business and do count.
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, error: `New password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  return { ok: true };
}

/**
 * Validate the new password *and* its confirmation, for the two-field forms.
 * Order matters: an unusable password is reported before a mismatch, so the user
 * fixes the real problem first.
 */
export function validatePasswordConfirmation(password: unknown, confirmation: unknown): PolicyResult {
  const base = validateNewPassword(password);
  if (!base.ok) return base;
  if (password !== confirmation) return { ok: false, error: "The two passwords do not match." };
  return { ok: true };
}

/**
 * May this actor set SOMEBODY ELSE's password?
 *
 * `ADMIN` and `DIRECTOR` both qualify: the practice owner's own account is a
 * DIRECTOR, so gating on ADMIN alone would lock the owner out of his own feature.
 * The founder always qualifies regardless of role.
 *
 * This is the one definition of the gate. `lib/server/password.ts` calls it to
 * *enforce*; the Settings UI calls it only to decide whether to draw the button.
 */
export function canManagePasswords(role: string | null | undefined, isFounder: boolean): boolean {
  if (isFounder) return true;
  return (PASSWORD_ADMIN_ROLES as readonly string[]).includes(role ?? "");
}
