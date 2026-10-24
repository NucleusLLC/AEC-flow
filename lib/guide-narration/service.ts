/**
 * GUIDE NARRATION: the decisions between "a browser asked for step X" and "here
 * are its MP3 bytes", with everything that touches the outside world injected.
 * lib/server/guide-narration.ts supplies the real settings, cache and Fish
 * Audio call; the tests supply fakes.
 *
 * The rules this file keeps:
 *   - only a guide step can be asked for (catalog.ts), never free text;
 *   - a clip is synthesised once, stored, and from then on served from the
 *     cache: a cache hit makes no Fish Audio call at all;
 *   - without a cache nothing is synthesised, because every play would then be
 *     a paid call;
 *   - nothing here throws. No key, switched off, Fish Audio down, out of
 *     credit, timed out, storage down: the answer is "no clip", the guide runs
 *     silent, and the reason is logged once, not once per card.
 */
import { guideContentIn, type GuideDefinition } from "@/lib/guide/definition";
import { ESTIMATES_GUIDE, guideById } from "@/lib/guide/registry";
import { clipCacheKey, clipVersion, isNarrationCacheKey, narrationEntries, narrationEntry, narrationLangSupported } from "./catalog";
import { narrationActive, type ResolvedNarrationConfig } from "./config";
import { NARRATION_OFF, type NarrationManifest } from "./timing";

/** Where clips are kept. Two implementations: the private bucket, and a local folder for development. */
export interface NarrationCache {
  readonly kind: "bucket" | "disk";
  get(key: string): Promise<Uint8Array | null>;
  put(key: string, bytes: Uint8Array): Promise<void>;
  /** Every clip key in the cache. */
  list(): Promise<string[]>;
  remove(keys: readonly string[]): Promise<void>;
}

export type SynthRequest = { text: string; voice: string; model: string; apiKey: string };

export type NarrationDeps = {
  config: () => Promise<ResolvedNarrationConfig>;
  /** null when there is nowhere to keep clips. */
  cache: () => NarrationCache | null;
  synthesize: (request: SynthRequest) => Promise<Uint8Array>;
  /** One line per problem; never receives the key. */
  log: (what: string, error: unknown) => void;
  now?: () => number;
};

export type ClipResult =
  | { ok: true; bytes: Uint8Array; version: string; from: "cache" | "fish" }
  | { ok: false; reason: "not-a-step" | "off" | "no-cache" | "unavailable" };

/** After a failed synthesis, how long before Fish Audio is tried again. */
export const SYNTH_RETRY_AFTER_MS = 5 * 60 * 1000;

/** A clip is a few hundred kilobytes; anything outside this is not one. */
const MIN_CLIP_BYTES = 512;
const MAX_CLIP_BYTES = 8 * 1024 * 1024;

export function looksLikeClip(bytes: Uint8Array): boolean {
  return bytes.byteLength >= MIN_CLIP_BYTES && bytes.byteLength <= MAX_CLIP_BYTES;
}

export function createNarrationService(deps: NarrationDeps) {
  const now = deps.now ?? Date.now;
  /** Clips being made right now, so two listeners arriving together cost one call. */
  const inFlight = new Map<string, Promise<Uint8Array | null>>();
  /** Fish Audio is left alone until this time after a failure. */
  let synthBlockedUntil = 0;
  /** Resolves when the synthesis in progress, if any, is over. */
  let synthQueue: Promise<void> = Promise.resolve();
  let warnedNoCache = false;

  async function safeConfig(): Promise<ResolvedNarrationConfig | null> {
    try {
      return await deps.config();
    } catch (e) {
      deps.log("reading the narration settings", e);
      return null;
    }
  }

  function safeCache(): NarrationCache | null {
    try {
      return deps.cache();
    } catch (e) {
      deps.log("opening the narration cache", e);
      return null;
    }
  }

  /**
   * What the browser is told about ONE guide: on or off, and each step's clip
   * version, keyed by the step id inside that guide. No secret. With no guide
   * named it is the Estimates guide, as it was before there was a second one.
   */
  async function manifest(lang: unknown, guideId?: unknown): Promise<NarrationManifest> {
    if (typeof lang !== "string" || !narrationLangSupported(lang)) return NARRATION_OFF;
    const guide: GuideDefinition | null = guideId === undefined || guideId === null ? ESTIMATES_GUIDE : guideById(guideId);
    if (!guide || !guideContentIn(guide, lang)) return NARRATION_OFF;
    const config = await safeConfig();
    if (!config || !narrationActive(config) || !safeCache()) return NARRATION_OFF;
    const voice = config.voices[lang];
    if (!voice) return NARRATION_OFF;
    const clips: Record<string, string> = {};
    const prefix = guide.clipNamespace ? guide.clipNamespace.length + 1 : 0;
    for (const entry of narrationEntries(lang, guide)) {
      clips[entry.stepId.slice(prefix)] = clipVersion({ text: entry.text, voice, model: config.model });
    }
    return Object.keys(clips).length > 0 ? { enabled: true, clips } : NARRATION_OFF;
  }

  /** The MP3 of one guide step: from the cache, or made once and stored. */
  async function clip(lang: unknown, stepId: unknown): Promise<ClipResult> {
    const entry = narrationEntry(lang, stepId);
    if (!entry) return { ok: false, reason: "not-a-step" };

    const config = await safeConfig();
    if (!config || !narrationActive(config) || !config.apiKey) return { ok: false, reason: "off" };
    const voice = config.voices[entry.lang];
    if (!voice) return { ok: false, reason: "off" };

    const cache = safeCache();
    if (!cache) {
      if (!warnedNoCache) {
        warnedNoCache = true;
        deps.log("guide narration has no cache (file storage is not connected); the guide runs silent", null);
      }
      return { ok: false, reason: "no-cache" };
    }

    const identity = { text: entry.text, voice, model: config.model };
    const key = clipCacheKey(entry, identity);
    const version = clipVersion(identity);

    try {
      const hit = await cache.get(key);
      if (hit && looksLikeClip(hit)) return { ok: true, bytes: hit, version, from: "cache" };
    } catch (e) {
      // A cache that cannot be read must not turn into a Fish Audio call per play.
      deps.log("reading a narration clip from the cache", e);
      return { ok: false, reason: "unavailable" };
    }

    if (now() < synthBlockedUntil) return { ok: false, reason: "unavailable" };

    let pending = inFlight.get(key);
    if (!pending) {
      const apiKey = config.apiKey;
      // One synthesis at a time. The guide asks for the card on screen and the
      // next one together; if the first is refused, the second must not go out
      // as well (one failed call and one log line, not two).
      const turn = synthQueue;
      let release = () => {};
      synthQueue = new Promise<void>((resolve) => {
        release = resolve;
      });
      pending = (async () => {
        await turn;
        try {
          if (now() < synthBlockedUntil) return null;
          const bytes = await deps.synthesize({ text: entry.text, voice, model: config.model, apiKey });
          if (!looksLikeClip(bytes)) throw new Error(`Fish Audio returned ${bytes.byteLength} bytes, which is not a clip.`);
          try {
            await cache.put(key, bytes);
          } catch (e) {
            // Not stored means the next play pays again; stop synthesising until storage is back.
            synthBlockedUntil = now() + SYNTH_RETRY_AFTER_MS;
            deps.log("storing a narration clip", e);
          }
          return bytes;
        } catch (e) {
          synthBlockedUntil = now() + SYNTH_RETRY_AFTER_MS;
          deps.log(`synthesising guide narration (step ${entry.stepId}); the guide runs silent`, e);
          return null;
        } finally {
          inFlight.delete(key);
          release();
        }
      })();
      inFlight.set(key, pending);
    }
    const bytes = await pending;
    return bytes ? { ok: true, bytes, version, from: "fish" } : { ok: false, reason: "unavailable" };
  }

  /** Remove every cached clip. Returns how many, or null when it could not be done. */
  async function clearCache(): Promise<number | null> {
    const cache = safeCache();
    if (!cache) return 0;
    try {
      const keys = (await cache.list()).filter(isNarrationCacheKey);
      await cache.remove(keys);
      return keys.length;
    } catch (e) {
      deps.log("clearing the narration cache", e);
      return null;
    }
  }

  /** Let Fish Audio be tried again at once (the founder changed the key or the voice). */
  function resetBackoff() {
    synthBlockedUntil = 0;
  }

  return { manifest, clip, clearCache, resetBackoff };
}

export type NarrationService = ReturnType<typeof createNarrationService>;
