/**
 * GUIDE NARRATION: how long a card holds when it is being read aloud, and the
 * per-browser "sound on / off" preference. Pure and client-safe.
 */
import { GUIDE_HOLD_MS } from "@/lib/estimates/interactive-guide";

/** Silence left after the last word before the card moves on. */
export const NARRATION_GAP_MS = 600;

/**
 * How long a clip may take to start before the step gives up on it and runs
 * silent. The hold itself: a clip that has not begun by the time a silent card
 * would have moved on is not waited for.
 */
export const NARRATION_START_GRACE_MS = GUIDE_HOLD_MS;

/**
 * The hold of one card, from the moment it arrives: the usual five seconds, or
 * the length of its narration plus a short gap, whichever is longer, so speech
 * is never cut off and a short clip never hurries the card. With no clip (off,
 * unavailable, failed, blocked by the browser) it is exactly the usual hold.
 *
 * `startedAfterMs` is how late the clip began after the card arrived (0 when it
 * was preloaded).
 */
export function narratedHoldMs(clipMs: number | null | undefined, startedAfterMs = 0): number {
  if (typeof clipMs !== "number" || !Number.isFinite(clipMs) || clipMs <= 0) return GUIDE_HOLD_MS;
  const late = Number.isFinite(startedAfterMs) && startedAfterMs > 0 ? startedAfterMs : 0;
  return Math.max(GUIDE_HOLD_MS, Math.ceil(late + clipMs + NARRATION_GAP_MS));
}

/** localStorage key of the speaker toggle. Only "off" is ever stored. */
export const NARRATION_PREF_KEY = "aecflow.guide.narration";

/** Sound is on unless this browser was told otherwise. Storage may be blocked. */
export function readNarrationPref(storage: Pick<Storage, "getItem"> | null | undefined): boolean {
  try {
    return storage?.getItem(NARRATION_PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function writeNarrationPref(storage: Pick<Storage, "setItem" | "removeItem"> | null | undefined, on: boolean): void {
  try {
    if (on) storage?.removeItem(NARRATION_PREF_KEY);
    else storage?.setItem(NARRATION_PREF_KEY, "off");
  } catch {
    /* private mode or storage disabled: the choice lasts for this page only */
  }
}

/** What the browser is told about narration for a language. Never holds a secret. */
export type NarrationManifest = {
  enabled: boolean;
  /** step id -> version of its clip; the audio URL carries it so a new text or voice is a new URL. */
  clips: Record<string, string>;
};

export const NARRATION_OFF: NarrationManifest = { enabled: false, clips: {} };

/** Where a step's clip is served from. */
export function narrationClipUrl(lang: string, stepId: string, version: string): string {
  return `/api/guide-narration/${encodeURIComponent(stepId)}?lang=${encodeURIComponent(lang)}&v=${encodeURIComponent(version)}`;
}

/** Narrow whatever the manifest endpoint answered to a manifest; anything odd is "off". */
export function parseNarrationManifest(value: unknown): NarrationManifest {
  if (!value || typeof value !== "object") return NARRATION_OFF;
  const v = value as { enabled?: unknown; clips?: unknown };
  if (v.enabled !== true || !v.clips || typeof v.clips !== "object") return NARRATION_OFF;
  const clips: Record<string, string> = {};
  for (const [id, version] of Object.entries(v.clips as Record<string, unknown>)) {
    if (typeof version === "string" && /^[0-9a-f]{8,64}$/.test(version)) clips[id] = version;
  }
  return Object.keys(clips).length > 0 ? { enabled: true, clips } : NARRATION_OFF;
}
