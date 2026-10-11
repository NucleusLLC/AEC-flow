/**
 * GUIDE NARRATION: what may be synthesised, and under which cache key.
 *
 * The browser never sends text. It names a guide step; the text spoken for it
 * is looked up HERE, from the guide's own fixed content. That is what stops the
 * audio endpoint from being an open, paid text-to-speech proxy: the only
 * sentences that can ever reach Fish Audio are the guide's cards and the one
 * fixed test sentence.
 *
 * A clip's cache key is a hash of everything that changes how it sounds: the
 * spoken text, the voice, the model and the synthesis recipe. Edit a card,
 * pick another voice or model, and that clip gets a new key and is made again
 * by itself; nothing has to be invalidated by hand.
 *
 * Pure (node:crypto only). Server-side: never import from a client component.
 */
import { createHash } from "node:crypto";
import { GUIDE_STEPS, guideEnabledFor } from "@/lib/estimates/interactive-guide";
import { guideContentFor } from "@/lib/estimates/interactive-guide-content";
import { hasSpokenForm, spokenStepText } from "./spoken";
import { narrationLanguage } from "./voices";

/**
 * Bump when the request sent to Fish Audio changes in a way that changes the
 * sound (bitrate, loudness normalisation, …), so every clip is made again.
 */
export const NARRATION_RECIPE = "fish-tts-1:mp3-128:loudnorm";

/** Folder inside the private bucket. Flat, so "clear cached audio" is one listing. */
export const NARRATION_CACHE_PREFIX = "guide-narration";

/** Is the guide narrated in this language at all (gate, content, rules and a voice)? */
export function narrationLangSupported(lang: string | null | undefined): lang is string {
  return guideEnabledFor(lang) && hasSpokenForm(lang) && narrationLanguage(lang) !== null && guideContentFor(lang) !== null;
}

export type NarrationEntry = { lang: string; stepId: string; text: string };

/**
 * The text spoken for one guide step, or null for anything that is not a step
 * of the guide in a narrated language. `stepId` is matched against the step
 * list itself, never used as an object key, so "__proto__" and friends are
 * simply not steps.
 */
export function narrationEntry(lang: unknown, stepId: unknown): NarrationEntry | null {
  if (typeof lang !== "string" || typeof stepId !== "string") return null;
  if (!narrationLangSupported(lang)) return null;
  const step = GUIDE_STEPS.find((s) => s.id === stepId);
  const content = guideContentFor(lang);
  if (!step || !content) return null;
  if (!Object.prototype.hasOwnProperty.call(content.steps, step.id)) return null;
  const text = spokenStepText(lang, step, content.steps[step.id]);
  return text ? { lang, stepId: step.id, text } : null;
}

/** Every narrated step of a language, in tour order. */
export function narrationEntries(lang: string): NarrationEntry[] {
  return GUIDE_STEPS.map((s) => narrationEntry(lang, s.id)).filter((e): e is NarrationEntry => e !== null);
}

export type ClipIdentity = { text: string; voice: string; model: string };

/** 64 hex characters that change whenever the text, the voice, the model or the recipe does. */
export function clipHash(clip: ClipIdentity): string {
  return createHash("sha256")
    .update(JSON.stringify([NARRATION_RECIPE, clip.model, clip.voice, clip.text]))
    .digest("hex");
}

/** The short form of the hash the browser sees in a clip URL. */
export function clipVersion(clip: ClipIdentity): string {
  return clipHash(clip).slice(0, 16);
}

/** Object key of a clip in the cache. The step id is there for a human reading the bucket. */
export function clipCacheKey(entry: Pick<NarrationEntry, "lang" | "stepId">, clip: ClipIdentity): string {
  return `${NARRATION_CACHE_PREFIX}/${entry.lang}-${entry.stepId}-${clipHash(clip).slice(0, 32)}.mp3`;
}

/** Does this object key belong to the narration cache (and nothing else in the bucket)? */
export function isNarrationCacheKey(key: string): boolean {
  return new RegExp(`^${NARRATION_CACHE_PREFIX}/[a-z]{2}-[A-Za-z0-9]+-[0-9a-f]{32}\\.mp3$`).test(key);
}
