/**
 * Stand-in for `next-auth`, used ONLY by scripts/tsconfig.verify.json.
 *
 * Why this has to exist: every other verification script in this folder runs with
 * `currentCompanyId()` returning `undefined`, because the real `getServerSession()`
 * calls next/headers and throws outside a request ("`headers` was called outside a
 * request scope"). `undefined` means "not a request", and the tenant extension in
 * lib/db.ts then does not scope at all. So a plain script exercises the one code path
 * on which tenant-scoping bugs cannot appear, and is blind to them by construction.
 *
 * Mapping "next-auth" here (see the `paths` entry in scripts/tsconfig.verify.json —
 * the same technique the inherited config already uses for "server-only") makes
 * getServerSession return a session carrying VERIFY_COMPANY_ID, so
 * lib/server/request-company.ts yields a companyId string exactly as it does for a
 * signed-in user. Everything downstream is the real code: request-company.ts, the
 * lib/db.ts extension, and every data-access module.
 *
 * Scoped to scripts/tsconfig.verify.json, so it never reaches a Next build and no
 * application code can resolve it.
 */
export type Session = { user: { id: string; companyId: string | null } } | null;

export async function getServerSession(): Promise<Session> {
  const companyId = process.env.VERIFY_COMPANY_ID;
  if (!companyId) return null; // a request with no company on the session → scope to nothing
  return { user: { id: process.env.VERIFY_USER_ID ?? "verify-script-user", companyId } };
}

export type NextAuthOptions = Record<string, unknown>;

export default function NextAuth(): never {
  throw new Error("NextAuth() is not available in the verification shim.");
}
