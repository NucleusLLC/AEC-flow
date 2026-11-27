/**
 * The D-6 role gate for ROUTE HANDLERS (app/api/**), which answer with JSON
 * rather than an `{ ok, error }` result.
 *
 * SERVER-ONLY. Returns the refusal response, or null when the caller may go on:
 *   401 — not signed in, deactivated, or no company (an `ActorError`);
 *   403 — signed in but the role may not (lib/permissions/role-gates.ts).
 * Anything else (the database is down) is re-thrown for the route's own `fail`.
 */
import { NextResponse } from "next/server";
import { ActorError, requireActor } from "@/lib/server/actor";
import { deniedFor, type GatedAction } from "@/lib/permissions/role-gates";

export async function routeDenied(action: GatedAction | "write"): Promise<NextResponse | null> {
  try {
    const actor = await requireActor();
    const denied = deniedFor(action, actor);
    return denied ? NextResponse.json({ error: denied }, { status: 403 }) : null;
  } catch (e) {
    if (e instanceof ActorError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
