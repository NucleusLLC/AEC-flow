/** Shared helpers for the Land Development API route handlers (mirrors lib/ca/api.ts). */
import { NextResponse } from "next/server";

export const ok = <T>(data: T) => NextResponse.json({ data });
export const created = <T>(data: T) => NextResponse.json({ data }, { status: 201 });
export const badRequest = (message: string) => NextResponse.json({ error: message }, { status: 400 });
export const notFound = (message = "Not found") => NextResponse.json({ error: message }, { status: 404 });

/** True when the failure is a database-connectivity error (e.g. paused Supabase). */
export function isConnectionError(err: unknown): boolean {
  const msg = (err as Error)?.message ?? "";
  const code = (err as { code?: string })?.code ?? "";
  return /^P10\d\d$/.test(code) || /Can't reach database server|ECONNREFUSED|Server has closed/i.test(msg);
}

/** Map an exception to a response: 503 if the DB is down, else 500. */
export function fail(err: unknown) {
  console.error("[development:api]", err);
  if (isConnectionError(err)) {
    return NextResponse.json(
      { error: "Database unavailable — your changes were not saved. Restore the database and retry." },
      { status: 503 },
    );
  }
  return NextResponse.json({ error: (err as Error)?.message ?? "Server error" }, { status: 500 });
}
