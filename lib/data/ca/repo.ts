/**
 * Construction Administration — repository helpers.
 *
 * Per the suite decision to run a *real backend*, reads and writes go through
 * Prisma (lib/db.ts). Because the Supabase database can be paused/unreachable,
 * READS degrade gracefully to the seed dataset (lib/ca/seed-data.ts) so the UI
 * keeps working offline. WRITES have no fallback — if the DB is down the error
 * propagates so the API can return 503 (a write must not silently no-op).
 */

/** Run a Prisma read; on ANY failure (e.g. P1001 unreachable) use the fallback. */
export async function caRead<T>(query: () => Promise<T>, fallback: () => T): Promise<T> {
  try {
    return await query();
  } catch (err) {
    console.warn("[ca] DB read failed — serving seed data.", (err as Error)?.message);
    return fallback();
  }
}

/** Prisma Decimal | number | null -> number. */
export function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v.toString());
}

/** Date | null -> "YYYY-MM-DD" | null (matches the seed string format). */
export function ymd(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** Required date -> "YYYY-MM-DD". */
export function ymdReq(d: Date): string {
  return d.toISOString().slice(0, 10);
}
