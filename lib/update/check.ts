/**
 * Is the tab in front of someone running an older release than the one that is
 * deployed? PURE — no React, no fetch, no timers.
 *
 * WHY THIS EXISTS. AEC-flow is a web app: a release reaches everyone the next
 * time their browser loads a page. A tab that was simply left open keeps
 * running the code it started with, for days, and nothing told the person. They
 * report a bug that was fixed yesterday, or meet an error on a screen whose code
 * moved under them. The notice built on this module tells them, and offers a
 * reload. It never reloads by itself: there may be unsaved work in the tab.
 *
 * A release is identified by its version AND its build (the deploy's short
 * commit). Two deploys of the same version are different releases; a deploy
 * with no build id (local development) is compared on version alone.
 */

/** What a running tab, or the server, says it is. */
export type Release = { version: string; build: string };

/** How long after the page opens the first check runs. */
export const FIRST_CHECK_MS = 60_000;
/** How often an open tab asks again. */
export const CHECK_EVERY_MS = 5 * 60_000;
/** Coming back to the tab asks again, but not more often than this. */
export const MIN_GAP_MS = 60_000;

const clean = (v: unknown): string => (typeof v === "string" ? v.trim().slice(0, 64) : "");

/** One comparable name for a release: "0.25.14+8c82237", or "0.25.14" with no build. */
export function releaseId(r: Release): string {
  const version = clean(r.version);
  const build = clean(r.build);
  return build ? `${version}+${build}` : version;
}

/**
 * Read the answer of GET /api/version. Anything that is not that answer is
 * null: a sign-in page served because the session ran out, an error page, a
 * proxy's HTML. null means "could not tell", and the notice stays quiet.
 */
export function parseRelease(body: unknown): Release | null {
  if (!body || typeof body !== "object") return null;
  const { version, build } = body as Record<string, unknown>;
  const v = clean(version);
  if (!/^\d+\.\d+\.\d+/.test(v)) return null;
  return { version: v, build: clean(build) };
}

/**
 * True when what is deployed is a different release from what this tab runs.
 *
 * "Different", not "greater": a rollback is also a release the tab should move
 * to, and a build id cannot be ordered anyway. A side with no build id is only
 * compared on version, so a local server never nags about a missing commit.
 */
export function updateAvailable(running: Release, deployed: Release | null): boolean {
  if (!deployed) return false;
  const rv = clean(running.version);
  const dv = clean(deployed.version);
  if (!rv || !dv) return false;
  if (rv !== dv) return true;
  const rb = clean(running.build);
  const db = clean(deployed.build);
  return Boolean(rb && db && rb !== db);
}

/** Whether enough time has passed since the last check to ask again. */
export function dueForCheck(lastCheckedAt: number, now: number, gap: number = MIN_GAP_MS): boolean {
  return !Number.isFinite(lastCheckedAt) || lastCheckedAt <= 0 || now - lastCheckedAt >= gap;
}
