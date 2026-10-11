/**
 * GUIDE NARRATION, server side: the platform settings row, the clip cache and
 * the one call to Fish Audio. The decisions live in lib/guide-narration/ (pure,
 * unit-tested); this file only connects them to Postgres, storage and the
 * network.
 *
 * SERVER-ONLY. It reads the Fish Audio key. Nothing exported here returns the
 * key: Settings gets `NarrationStatus` (set / not set and the last four
 * characters), the browser gets a manifest of clip versions.
 *
 * WHERE THE SETTINGS LIVE. In AppConfig, like the practice's AI key, with the
 * same protection, but in ONE row of its own (id "platform") rather than in a
 * company's row: the guide is the same for every practice and every tenant's
 * users hear it. AppConfig is deliberately outside the tenant query extension
 * (lib/db.ts), so this read is explicit and by id, and works for a signed-in
 * user of any company. Only the founder can write it (settings actions).
 */
import "server-only";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { prisma } from "@/lib/db";
import { NARRATION_CACHE_PREFIX, isNarrationCacheKey } from "@/lib/guide-narration/catalog";
import {
  NARRATION_CONFIG_KEY,
  applyNarrationKey,
  applyNarrationSettings,
  narrationStatus,
  resolveNarrationConfig,
  storedNarrationConfig,
  type NarrationSettingsInput,
  type NarrationStatus,
  type ResolvedNarrationConfig,
  type StoredNarrationConfig,
} from "@/lib/guide-narration/config";
import {
  createNarrationService,
  looksLikeClip,
  type NarrationCache,
  type SynthRequest,
} from "@/lib/guide-narration/service";
import { isNarrationModel, isVoiceId, narrationLanguage } from "@/lib/guide-narration/voices";
import { ERROR_LOG_TAG, redactText } from "@/lib/observability/error-record";
import { deleteObjects, downloadObject, isStorageConfigured, listObjects, uploadObject } from "@/lib/server/storage";
import { APP_VERSION, appBuildId } from "@/lib/version";

// ---------------------------------------------------------------------------
// Settings: one platform row
// ---------------------------------------------------------------------------

/** The AppConfig row that holds platform-wide settings. Not a company id. */
const PLATFORM_CONFIG_ID = "platform";

async function readPlatformBlob(): Promise<Record<string, unknown>> {
  // Explicit, non-tenant-scoped read: the same row for every company's users.
  const row = await prisma.appConfig.findUnique({ where: { id: PLATFORM_CONFIG_ID } });
  return (row?.data as Record<string, unknown> | undefined) ?? {};
}

async function writeStored(next: StoredNarrationConfig): Promise<void> {
  // Read, change one key, write the whole blob: other platform settings stay put.
  const blob = await readPlatformBlob();
  const data = { ...blob, [NARRATION_CONFIG_KEY]: next };
  await prisma.appConfig.upsert({
    where: { id: PLATFORM_CONFIG_ID },
    create: { id: PLATFORM_CONFIG_ID, companyId: null, data: data as object },
    update: { data: data as object },
  });
}

async function readStored(): Promise<StoredNarrationConfig> {
  return storedNarrationConfig(await readPlatformBlob());
}

/** The effective settings, key included. Never return this from an action or a route. */
async function resolveConfig(): Promise<ResolvedNarrationConfig> {
  return resolveNarrationConfig(await readStored(), process.env.FISH_AUDIO_API_KEY);
}

// ---------------------------------------------------------------------------
// Cache: the private bucket, or a local folder in development
// ---------------------------------------------------------------------------

const MAX_CLIP_BYTES = 8 * 1024 * 1024;

/** Clips in the existing private Supabase bucket, read and written with the service role. */
const bucketCache: NarrationCache = {
  kind: "bucket",
  get: (key) => downloadObject(key, MAX_CLIP_BYTES),
  put: (key, bytes) => uploadObject(key, bytes, "audio/mpeg"),
  list: () => listObjects(NARRATION_CACHE_PREFIX),
  remove: (keys) => deleteObjects(keys),
};

/**
 * Clips in a local folder. For development and the local test harness, which
 * have no Supabase storage; refused in production, where a function's disk is
 * neither shared between instances nor kept.
 */
function diskCache(dir: string): NarrationCache {
  const file = (key: string) => join(dir, basename(key));
  return {
    kind: "disk",
    async get(key) {
      try {
        return new Uint8Array(await readFile(file(key)));
      } catch {
        return null;
      }
    },
    async put(key, bytes) {
      await mkdir(dir, { recursive: true });
      await writeFile(file(key), bytes);
    },
    async list() {
      try {
        return (await readdir(dir)).map((name) => `${NARRATION_CACHE_PREFIX}/${name}`).filter(isNarrationCacheKey);
      } catch {
        return [];
      }
    },
    async remove(keys) {
      await Promise.all(keys.map((key) => rm(file(key), { force: true })));
    },
  };
}

function narrationCache(): NarrationCache | null {
  const dir = process.env.GUIDE_NARRATION_CACHE_DIR?.trim();
  if (dir && process.env.NODE_ENV !== "production") return diskCache(dir);
  return isStorageConfigured() ? bucketCache : null;
}

// ---------------------------------------------------------------------------
// Fish Audio
// ---------------------------------------------------------------------------

const FISH_TTS_URL = "https://api.fish.audio/v1/tts";
const FISH_TIMEOUT_MS = 45_000;

/**
 * One synthesis. https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech
 * The model goes in a header. `normalize` (number expansion) only covers
 * English and Chinese, so it is off: the spoken text already has every number
 * written out. Throws on any failure, with the status and Fish Audio's message.
 */
async function fishSynthesize(request: SynthRequest): Promise<Uint8Array> {
  const response = await fetch(FISH_TTS_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${request.apiKey}`,
      "content-type": "application/json",
      model: request.model,
    },
    body: JSON.stringify({
      text: request.text,
      reference_id: request.voice,
      format: "mp3",
      mp3_bitrate: 128,
      normalize: false,
      latency: "normal",
      prosody: { speed: 1, volume: 0, normalize_loudness: true },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(FISH_TIMEOUT_MS),
  });
  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.text()).slice(0, 200);
    } catch {
      /* the status is the signal */
    }
    throw new Error(`Fish Audio answered ${response.status}. ${detail}`.trim());
  }
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * One line in the function logs, in the shape docs/ERRORS.md describes, so a
 * silent guide can be explained by searching `[aecflow-error]`. Redacted like
 * every other line; the key is never handed to this function.
 */
function logNarration(what: string, error: unknown): void {
  try {
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : error ? String(error) : "";
    const record = {
      kind: "server",
      at: new Date().toISOString(),
      name: "GuideNarration",
      message: redactText(`${what}${detail ? ` — ${detail}` : ""}`).slice(0, 500),
      routePath: "/api/guide-narration",
      routeType: "route",
      version: APP_VERSION,
      build: appBuildId() || "dev",
    };
    console.error(`${ERROR_LOG_TAG} ${JSON.stringify(record)}`);
  } catch {
    // Never let error reporting become the error.
  }
}

// ---------------------------------------------------------------------------
// The service, and what the routes and actions call
// ---------------------------------------------------------------------------

const service = createNarrationService({
  config: resolveConfig,
  cache: narrationCache,
  synthesize: fishSynthesize,
  log: logNarration,
});

/** For the browser: is the guide narrated in this language, and each step's clip version. */
export const getNarrationManifest = service.manifest;

/** The MP3 of one guide step, or the reason there is none. Never throws. */
export const getNarrationClip = service.clip;

/** Settings view for the founder. Holds no secret. */
export async function getNarrationStatus(): Promise<NarrationStatus> {
  const cache = narrationCache();
  try {
    return narrationStatus(await resolveConfig(), cache?.kind ?? "none");
  } catch (e) {
    logNarration("reading the narration settings", e);
    return narrationStatus(resolveNarrationConfig({}, process.env.FISH_AUDIO_API_KEY), cache?.kind ?? "none");
  }
}

/** Save a key, or with "" remove the saved one. The caller has already checked the founder. */
export async function saveNarrationKey(key: string): Promise<NarrationStatus> {
  await writeStored(applyNarrationKey(await readStored(), key));
  service.resetBackoff();
  return getNarrationStatus();
}

/** Save the switch, the model and the voices. Invalid values are ignored, never guessed. */
export async function saveNarrationSettings(input: NarrationSettingsInput): Promise<NarrationStatus> {
  await writeStored(applyNarrationSettings(await readStored(), input));
  service.resetBackoff();
  return getNarrationStatus();
}

/** Remove every cached clip; they are made again on the next play. */
export async function clearNarrationCache(): Promise<number | null> {
  return service.clearCache();
}

export type VoiceTestResult = { ok: true; audio: string } | { ok: false; error: "no-key" | "invalid" | "failed"; detail?: string };

/**
 * Speak the language's fixed sample in a voice and model the founder is trying
 * out. The text is never taken from the caller. Not cached: it is a test.
 * Returns the MP3 as a data URL.
 */
export async function testNarrationVoice(input: { lang: unknown; voice: unknown; model: unknown }): Promise<VoiceTestResult> {
  const language = narrationLanguage(typeof input.lang === "string" ? input.lang : null);
  const voice = typeof input.voice === "string" ? input.voice.trim().toLowerCase() : "";
  if (!language || !isVoiceId(voice) || !isNarrationModel(input.model)) return { ok: false, error: "invalid" };
  let apiKey: string | null = null;
  try {
    apiKey = (await resolveConfig()).apiKey;
  } catch (e) {
    logNarration("reading the narration settings", e);
  }
  if (!apiKey) return { ok: false, error: "no-key" };
  try {
    const bytes = await fishSynthesize({ text: language.sample, voice, model: input.model, apiKey });
    if (!looksLikeClip(bytes)) throw new Error(`Fish Audio returned ${bytes.byteLength} bytes.`);
    return { ok: true, audio: `data:audio/mpeg;base64,${Buffer.from(bytes).toString("base64")}` };
  } catch (e) {
    logNarration("testing a narration voice", e);
    // Fish Audio's own words (status, "insufficient credit", …) help the founder; redacted and short.
    const detail = e instanceof Error ? redactText(e.message).slice(0, 200) : undefined;
    return { ok: false, error: "failed", detail };
  }
}
