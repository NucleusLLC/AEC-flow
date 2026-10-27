/**
 * API tokens for connected apps (desktop add-ins such as M.E.P.flow).
 *
 * A token is `aecf_` + 32 random bytes in base64url (43 characters), 48
 * characters in all. It is shown to the admin ONCE; the database keeps only its
 * sha256 (hex) and its first 12 characters for display. A request is
 * authenticated by hashing the presented token and looking the hash up — the
 * token itself is never compared, stored or logged.
 *
 * Pure: node:crypto only, no Prisma, no request.
 */
import { createHash, randomBytes } from "node:crypto";
import { API_TOKEN_NAME_MAX } from "./limits";

export { API_TOKEN_NAME_MAX };

export const API_TOKEN_PREFIX = "aecf_";
/** Random bytes behind each token: 256 bits, unguessable. */
export const API_TOKEN_BYTES = 32;
/** Characters of the token kept for display ("aecf_" + 7). */
export const API_TOKEN_DISPLAY_CHARS = 12;

const TOKEN_SHAPE = /^aecf_[A-Za-z0-9_-]{43}$/;

/** A fresh token. `random` is injectable for tests. */
export function generateApiToken(random: (n: number) => Buffer = randomBytes): string {
  return API_TOKEN_PREFIX + random(API_TOKEN_BYTES).toString("base64url");
}

/** sha256 of the whole token, lowercase hex — what the database stores and is searched by. */
export function hashApiToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** The part of a token shown in the list, so an admin can tell two apart. */
export function apiTokenPrefix(token: string): string {
  return token.slice(0, API_TOKEN_DISPLAY_CHARS);
}

/** Cheap shape check before any database lookup. */
export function isApiTokenShape(token: unknown): token is string {
  return typeof token === "string" && TOKEN_SHAPE.test(token);
}

/**
 * The token from an `Authorization: Bearer <token>` header, or null. The scheme
 * is case-insensitive (RFC 7235); anything that is not a well-formed token is
 * null, so a malformed header never reaches the database.
 */
export function bearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const m = /^\s*Bearer\s+(\S+)\s*$/i.exec(header);
  if (!m) return null;
  return isApiTokenShape(m[1]) ? m[1] : null;
}

/** A token name as typed: trimmed, one line, at most API_TOKEN_NAME_MAX characters. Null if empty. */
export function cleanTokenName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const s = name.replace(/\s+/g, " ").trim().slice(0, API_TOKEN_NAME_MAX);
  return s ? s : null;
}
