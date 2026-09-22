/**
 * Session revocation by version number.
 *
 * Logins are JWTs (NextAuth credentials), which cannot be deleted once issued.
 * Instead each user has `sessionVersion`, bumped whenever their password is
 * changed or reset; a token remembers the version it was issued under and is
 * refused once the two differ. Pure, so the rule is unit-tested without NextAuth.
 */

/** How long a token may go between checks against the database. */
export const SESSION_RECHECK_SECONDS = 60;

/**
 * Is a token issued under `tokenVersion` still good for this user row?
 * A missing version (token from before this shipped) counts as 0, which is
 * every user's starting value, so shipping this signs nobody out.
 */
export function tokenStillValid(
  tokenVersion: number | undefined,
  user: { status: string; sessionVersion: number } | null,
): boolean {
  if (!user) return false;
  if (user.status === "INACTIVE") return false;
  return (tokenVersion ?? 0) === user.sessionVersion;
}
