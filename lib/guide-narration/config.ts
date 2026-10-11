/**
 * GUIDE NARRATION settings: the shape that is stored, what is resolved from it,
 * and the ONLY view of it that may travel to a browser.
 *
 * This is a PLATFORM setting, not a practice's: the guide is the same for every
 * practice, and every tenant's users hear it. It is stored once, in its own
 * AppConfig row (lib/server/guide-narration.ts), and edited only by the founder.
 *
 * The API key is write-only. `narrationStatus` is what Settings receives: set
 * or not set, where it comes from, and its last four characters. A test holds
 * that the key itself is in nothing this module hands out.
 *
 * Pure: no Prisma, no session, no env reads (the env value is passed in).
 */
import {
  DEFAULT_NARRATION_MODEL,
  NARRATION_LANGUAGES,
  isNarrationModel,
  isVoiceId,
  type NarrationModel,
} from "./voices";

/** The key in the platform AppConfig blob. */
export const NARRATION_CONFIG_KEY = "guideNarration";

/** What is stored. Every field optional: an empty object is "never configured". */
export type StoredNarrationConfig = {
  apiKey?: string;
  /** Absent means on. */
  enabled?: boolean;
  model?: string;
  /** language -> Fish Audio reference id */
  voices?: Record<string, string>;
};

export type ResolvedNarrationConfig = {
  /** null when no key is saved and none is in the environment. */
  apiKey: string | null;
  keySource: "saved" | "env" | null;
  enabled: boolean;
  model: NarrationModel;
  voices: Record<string, string>;
};

/** Read the stored object out of a config blob, dropping anything malformed. */
export function storedNarrationConfig(blob: unknown): StoredNarrationConfig {
  const raw = blob && typeof blob === "object" ? (blob as Record<string, unknown>)[NARRATION_CONFIG_KEY] : null;
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: StoredNarrationConfig = {};
  if (typeof r.apiKey === "string" && r.apiKey.trim()) out.apiKey = r.apiKey.trim();
  if (typeof r.enabled === "boolean") out.enabled = r.enabled;
  if (isNarrationModel(r.model)) out.model = r.model;
  if (r.voices && typeof r.voices === "object") {
    const voices: Record<string, string> = {};
    for (const lang of Object.keys(NARRATION_LANGUAGES)) {
      const v = (r.voices as Record<string, unknown>)[lang];
      if (isVoiceId(v)) voices[lang] = v;
    }
    if (Object.keys(voices).length > 0) out.voices = voices;
  }
  return out;
}

/**
 * The effective settings. A saved key wins; FISH_AUDIO_API_KEY from the
 * environment is the fallback when none is saved. Each language falls back to
 * its default voice.
 */
export function resolveNarrationConfig(stored: StoredNarrationConfig, envKey?: string | null): ResolvedNarrationConfig {
  const saved = stored.apiKey?.trim() || null;
  const env = envKey?.trim() || null;
  const voices: Record<string, string> = {};
  for (const [lang, spec] of Object.entries(NARRATION_LANGUAGES)) {
    voices[lang] = stored.voices?.[lang] ?? spec.defaultVoice;
  }
  return {
    apiKey: saved ?? env,
    keySource: saved ? "saved" : env ? "env" : null,
    enabled: stored.enabled !== false,
    model: isNarrationModel(stored.model) ? stored.model : DEFAULT_NARRATION_MODEL,
    voices,
  };
}

/** Is there anything to play? A key, and the switch on. */
export function narrationActive(config: ResolvedNarrationConfig): boolean {
  return config.enabled && !!config.apiKey;
}

/** The founder's view in Settings. Holds no secret. */
export type NarrationStatus = {
  configured: boolean;
  source: "saved" | "env" | null;
  /** The last four characters of the key, for telling two keys apart; null when not set. */
  last4: string | null;
  enabled: boolean;
  model: NarrationModel;
  voices: Record<string, string>;
  /** Where clips are kept: the private bucket, a local folder (development), or nowhere. */
  cache: "bucket" | "disk" | "none";
};

export function narrationStatus(config: ResolvedNarrationConfig, cache: NarrationStatus["cache"]): NarrationStatus {
  const key = config.apiKey;
  return {
    configured: !!key,
    source: config.keySource,
    // A key too short to mask safely shows nothing at all.
    last4: key && key.length >= 12 ? key.slice(-4) : null,
    enabled: config.enabled,
    model: config.model,
    voices: { ...config.voices },
    cache,
  };
}

/** What the founder may change, validated. Anything invalid is left out, never guessed. */
export type NarrationSettingsInput = {
  enabled?: unknown;
  model?: unknown;
  voices?: unknown;
};

export function applyNarrationSettings(stored: StoredNarrationConfig, input: NarrationSettingsInput): StoredNarrationConfig {
  const next: StoredNarrationConfig = { ...stored };
  if (typeof input.enabled === "boolean") next.enabled = input.enabled;
  if (isNarrationModel(input.model)) next.model = input.model;
  if (input.voices && typeof input.voices === "object") {
    const voices: Record<string, string> = { ...(stored.voices ?? {}) };
    for (const lang of Object.keys(NARRATION_LANGUAGES)) {
      const v = (input.voices as Record<string, unknown>)[lang];
      if (typeof v === "string" && isVoiceId(v.trim().toLowerCase())) voices[lang] = v.trim().toLowerCase();
    }
    next.voices = voices;
  }
  return next;
}

/** Save a new key, or with an empty string remove the saved one. */
export function applyNarrationKey(stored: StoredNarrationConfig, key: string): StoredNarrationConfig {
  const next: StoredNarrationConfig = { ...stored };
  const trimmed = key.trim();
  if (trimmed) next.apiKey = trimmed;
  else delete next.apiKey;
  return next;
}

/** Fish Audio keys are opaque; this only rejects what cannot be one. */
export function looksLikeApiKey(key: string): boolean {
  const k = key.trim();
  return k.length >= 16 && k.length <= 200 && /^[\x21-\x7e]+$/.test(k);
}
