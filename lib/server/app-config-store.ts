/**
 * DB-backed persistence for the org-wide app-config blob (system currency,
 * practice profile, logo, footer, AI key). Replaces the gitignored
 * `.app-config.json` file, which isn't writable on serverless (Vercel) — so
 * settings saved through the UI now persist in Postgres instead of silently
 * being lost.
 *
 * One JSON row keyed "singleton" (single-tenant today; becomes a per-company
 * row when the suite goes multi-tenant — call sites stay put). Both
 * `practice-config.ts` and `ai-config.ts` read/modify/write the WHOLE blob, so
 * neither clobbers the other's keys.
 *
 * SERVER-ONLY (imports Prisma). Never import from a client component.
 */
import { prisma } from "@/lib/db";

const SINGLETON_ID = "singleton";

export type AppConfigBlob = Record<string, unknown>;

/** Read the full config blob; returns {} when unset or the DB is unreachable. */
export async function readAppConfig(): Promise<AppConfigBlob> {
  try {
    const row = await prisma.appConfig.findUnique({ where: { id: SINGLETON_ID } });
    return (row?.data as AppConfigBlob | undefined) ?? {};
  } catch (e) {
    console.error("[app-config] read failed; returning empty config:", e);
    return {};
  }
}

/** Persist the full config blob (upsert the singleton row). */
export async function writeAppConfig(cfg: AppConfigBlob): Promise<void> {
  await prisma.appConfig.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, data: cfg as object },
    update: { data: cfg as object },
  });
}
