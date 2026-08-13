/**
 * Per-user preferences — server-only DB access (Prisma).
 *
 * SERVER-ONLY: imports `@/lib/db` (Prisma → pg), so never import this from a
 * client component (see [[aec-prisma-client-boundary]]). The client-safe
 * `Preferences` TYPE + `PREFERENCES` defaults live in `lib/data/settings.ts`
 * (which stays prisma-free); this module only does the reads/writes.
 *
 * Storage: a user's preferences are a JSON blob on `User.preferences`. Reads
 * merge the saved partial over the practice-wide defaults so missing keys fall
 * back gracefully (and new pref fields work without a migration of stored rows).
 */
import { prisma } from "@/lib/db";
import { coerceBackgroundIntervalSeconds } from "@/lib/dashboard/backgrounds";
import { coerceCardOpacityPercent } from "@/lib/dashboard/glass";
import { PREFERENCES, type Preferences } from "./settings";

export async function getUserPreferences(userId?: string | null): Promise<Preferences> {
  if (!userId) return PREFERENCES;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  const saved = (user?.preferences ?? {}) as Partial<Preferences>;
  const merged = { ...PREFERENCES, ...saved };
  // The blob is free-form JSON on the user row, so anything that drives a timer
  // or a loop is validated here rather than trusted from storage.
  merged.dashboardBackgroundIntervalSeconds = coerceBackgroundIntervalSeconds(
    merged.dashboardBackgroundIntervalSeconds,
  );
  // Same reason, one step worse: this one ends up inside a CSS custom property,
  // so an unrecognised value must never survive the read.
  merged.dashboardCardOpacityPercent = coerceCardOpacityPercent(merged.dashboardCardOpacityPercent);
  return merged;
}

export async function saveUserPreferences(userId: string, prefs: Preferences): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    // Prisma Json column — store the whole blob.
    data: { preferences: prefs as object },
  });
}
