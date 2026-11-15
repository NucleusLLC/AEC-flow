import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";

/**
 * A company named for the duration of one async call — for ROUTE HANDLERS with no
 * session (the Stripe webhook, the public /pay checkout). React `cache` memoises
 * only inside a React render; a route handler is not one, so there
 * `companyOverride()` hands back a fresh object on every call and a value set on
 * it is never seen again. AsyncLocalStorage follows the awaited call instead.
 *
 * ONE store per process, on globalThis. Next bundles this module more than once
 * (the server-action layer and the RSC layer each get a copy), while lib/db.ts
 * reuses one Prisma client across them in development. With a store per copy, a
 * server action's runAsCompany wrote to one store and the Prisma extension read
 * another — found render-testing the public /p accept action (0.45.0), where
 * every scoped query in the action ran as "no company".
 */
const globalScope = globalThis as unknown as { __aecCompanyScope?: AsyncLocalStorage<string> };
const companyScope = (globalScope.__aecCompanyScope ??= new AsyncLocalStorage<string>());

/**
 * Run `fn` with every tenant-scoped query limited to `companyId`. Use it only
 * after the caller has proved which company the work belongs to (a verified
 * Stripe signature naming the connected account, an unguessable pay token).
 */
export function runAsCompany<T>(companyId: string, fn: () => Promise<T>): Promise<T> {
  if (!companyId) throw new Error("runAsCompany needs a company.");
  return companyScope.run(companyId, fn);
}

/**
 * The current request's companyId, read from the signed-in session and memoised
 * once per request (React cache). Used by the Prisma tenant extension in lib/db
 * to scope every company-owned query.
 *
 * Return meaning:
 *  - string  → scope queries to this company
 *  - null    → a request with no company on the session → scope to nothing (safe/empty)
 *  - undefined → NOT a request context (scripts, seeds, build) → do NOT scope
 *
 * Dynamic imports keep this off the static import graph of lib/db (which would
 * otherwise cycle: db → this → auth → db).
 *
 * ONLY THE SESSION LOOKUP IS MEMOISED. The explicit company (runAsCompany /
 * companyOverride) is read on every call: memoising the whole answer meant that
 * one scoped query running before a public page set its override — a parallel
 * segment, an RSC payload render — fixed the request to "no company" and every
 * later query failed (found render-testing the /p acceptance page, 0.45.0).
 */
const sessionCompanyId = cache(async (): Promise<string | null | undefined> => {
  try {
    const [{ getServerSession }, { authOptions }] = await Promise.all([
      import("next-auth"),
      import("@/lib/auth"),
    ]);
    const session = await getServerSession(authOptions);
    return session?.user?.companyId ?? null;
  } catch {
    // cookies() unavailable → not inside a request (script/seed/build).
    return undefined;
  }
});

export async function currentCompanyId(): Promise<string | null | undefined> {
  // A route handler or server action acting for one practice with no session
  // (runAsCompany above), or a public page that named its company
  // (companyOverride below: the office TV board, /pay, /p).
  const explicit = explicitCompanyId();
  if (explicit) return explicit;
  return sessionCompanyId();
}

/**
 * Per-request company for a screen with no session — only the office TV board
 * after its secret key checks out (lib/officedash/access.ts). Set it BEFORE the
 * request's first scoped query: `currentCompanyId` is memoised per request.
 */
export const companyOverride = cache((): { companyId: string | null } => ({ companyId: null }));

/**
 * The company a session-less caller has PROVED it acts for — `runAsCompany` in a
 * route handler or server action, or `companyOverride()` on a page — else null.
 * Never reads the session. `getCurrentCompanyId` in lib/server/tenant.ts checks it
 * first, so the practice settings and letterhead a public page renders (the /p
 * acceptance page, /pay, the office TV board) are that practice's, not the
 * founder company's it would otherwise fall back to.
 */
export function explicitCompanyId(): string | null {
  return companyScope.getStore() || companyOverride().companyId || null;
}
