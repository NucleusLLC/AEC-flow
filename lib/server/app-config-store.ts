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
import { getCurrentCompanyId } from "@/lib/server/tenant";

const SINGLETON_ID = "singleton";

export type AppConfigBlob = Record<string, unknown>;

/**
 * Config is PER-COMPANY: each tenant's blob lives in its own AppConfig row keyed
 * by the companyId. Outside a company context we fall back to the legacy
 * "singleton" row. AppConfig is intentionally excluded from the tenant query
 * extension, so we key it explicitly here.
 */
async function configKey(): Promise<string> {
  const cid = await getCurrentCompanyId();
  return cid ?? SINGLETON_ID;
}

/** Read the current company's config blob; {} when unset or the DB is unreachable. */
export async function readAppConfig(): Promise<AppConfigBlob> {
  try {
    const key = await configKey();
    const row = await prisma.appConfig.findUnique({ where: { id: key } });
    return (row?.data as AppConfigBlob | undefined) ?? {};
  } catch (e) {
    console.error("[app-config] read failed; returning empty config:", e);
    return {};
  }
}

/** Persist the current company's config blob (upsert its row). */
export async function writeAppConfig(cfg: AppConfigBlob): Promise<void> {
  const key = await configKey();
  await prisma.appConfig.upsert({
    where: { id: key },
    create: { id: key, companyId: key === SINGLETON_ID ? null : key, data: cfg as object },
    update: { data: cfg as object },
  });
}
