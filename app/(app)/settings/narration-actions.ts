"use server";

/**
 * Settings > Integrations > "Guide narration (Fish Audio)".
 *
 * A PLATFORM setting: the Estimates guide is the same for every practice, so
 * its voice is configured once and only by the founder. Every action here
 * re-derives the founder from the caller's own database row (requireActor);
 * hiding the card is presentation, this is the gate.
 *
 * Nothing returned from this file contains the API key: `NarrationStatus` says
 * set / not set and shows its last four characters.
 */
import { revalidatePath } from "next/cache";
import { looksLikeApiKey, type NarrationStatus } from "@/lib/guide-narration/config";
import { requireActor } from "@/lib/server/actor";
import {
  clearNarrationCache,
  getNarrationStatus,
  saveNarrationKey,
  saveNarrationSettings,
  testNarrationVoice,
} from "@/lib/server/guide-narration";

const FOUNDER_ONLY = "Only the platform founder can change the guide narration.";

export type NarrationActionResult = { ok: true; status: NarrationStatus } | { ok: false; error: string };

/** An error message, or null when the caller is the founder. */
async function founderDenied(): Promise<string | null> {
  try {
    const actor = await requireActor();
    return actor.isFounder ? null : FOUNDER_ONLY;
  } catch (e) {
    return e instanceof Error ? e.message : "You must be signed in.";
  }
}

/** Save the Fish Audio API key. */
export async function saveGuideNarrationKeyAction(key: string): Promise<NarrationActionResult> {
  const denied = await founderDenied();
  if (denied) return { ok: false, error: denied };
  if (typeof key !== "string" || !looksLikeApiKey(key)) return { ok: false, error: "That does not look like an API key." };
  try {
    const status = await saveNarrationKey(key);
    revalidatePath("/settings");
    return { ok: true, status };
  } catch {
    return { ok: false, error: "Failed to save the key." };
  }
}

/** Remove the saved key (a key in the environment, if any, then takes over). */
export async function clearGuideNarrationKeyAction(): Promise<NarrationActionResult> {
  const denied = await founderDenied();
  if (denied) return { ok: false, error: denied };
  try {
    const status = await saveNarrationKey("");
    revalidatePath("/settings");
    return { ok: true, status };
  } catch {
    return { ok: false, error: "Failed to save the key." };
  }
}

/**
 * Save the on/off switch, the model and the voice of each language. A language
 * left out of `voices`, or given something that is not a voice id, keeps the
 * voice it has.
 */
export async function saveGuideNarrationSettingsAction(input: {
  enabled: boolean;
  model: string;
  /** language -> Fish Audio reference id */
  voices: Record<string, string>;
}): Promise<NarrationActionResult> {
  const denied = await founderDenied();
  if (denied) return { ok: false, error: denied };
  try {
    const status = await saveNarrationSettings({
      enabled: input?.enabled,
      model: input?.model,
      voices: input?.voices && typeof input.voices === "object" ? input.voices : undefined,
    });
    revalidatePath("/settings");
    return { ok: true, status };
  } catch {
    return { ok: false, error: "Failed to save the narration settings." };
  }
}

export type VoiceTestActionResult = { ok: true; audio: string } | { ok: false; error: string; detail?: string };

/** Speak the fixed sample sentence in the chosen voice and model. One paid call. */
export async function testGuideNarrationVoiceAction(input: {
  lang: string;
  voice: string;
  model: string;
}): Promise<VoiceTestActionResult> {
  const denied = await founderDenied();
  if (denied) return { ok: false, error: denied };
  const result = await testNarrationVoice({ lang: input?.lang, voice: input?.voice, model: input?.model });
  if (result.ok) return result;
  if (result.error === "no-key") return { ok: false, error: "No API key configured yet." };
  if (result.error === "invalid") return { ok: false, error: "Choose a voice and a model first." };
  return { ok: false, error: "Fish Audio could not produce the sample.", detail: result.detail };
}

/** Remove every cached clip; each is made again the next time its card plays. */
export async function clearGuideNarrationCacheAction(): Promise<{ ok: true; removed: number } | { ok: false; error: string }> {
  const denied = await founderDenied();
  if (denied) return { ok: false, error: denied };
  const removed = await clearNarrationCache();
  return removed === null ? { ok: false, error: "The cached audio could not be cleared." } : { ok: true, removed };
}

/** The card's own status, for a refresh after the page has loaded. */
export async function getGuideNarrationStatusAction(): Promise<NarrationActionResult> {
  const denied = await founderDenied();
  if (denied) return { ok: false, error: denied };
  return { ok: true, status: await getNarrationStatus() };
}
