/** Shared helpers for the Construction Administration API route handlers. */
import { NextResponse } from "next/server";

export const ok = <T>(data: T) => NextResponse.json({ data });
export const created = <T>(data: T) => NextResponse.json({ data }, { status: 201 });
export const badRequest = (message: string) => NextResponse.json({ error: message }, { status: 400 });
export const notFound = (message = "Not found") => NextResponse.json({ error: message }, { status: 404 });

/** True when the failure is a database-connectivity error (e.g. paused Supabase). */
export function isConnectionError(err: unknown): boolean {
  const msg = (err as Error)?.message ?? "";
  const code = (err as { code?: string })?.code ?? "";
  return code === "P1001" || code === "P1002" || /Can't reach database server|ECONNREFUSED/i.test(msg);
}

/** Map an exception to a response: 503 if the DB is down, else 500. */
export function fail(err: unknown) {
  console.error("[ca:api]", err);
  if (isConnectionError(err)) {
    return NextResponse.json(
      { error: "Database unavailable — the write was not saved. Restore the database and retry." },
      { status: 503 },
    );
  }
  return NextResponse.json({ error: (err as Error)?.message ?? "Server error" }, { status: 500 });
}

/** Coerce a value to a finite number (default 0). */
export const n = (v: unknown): number => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
};
