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
import { guideEnabledFor } from "@/lib/estimates/interactive-guide";
import { clipIdFor, guideCardIds, guideContentIn, type GuideDefinition } from "@/lib/guide/definition";
import { ESTIMATES_GUIDE, GUIDES, resolveClipId } from "@/lib/guide/registry";
import { hasSpokenForm, spokenPickerText, spokenStepText } from "./spoken";
import { narrationLanguage } from "./voices";

/**
 * Bump when the request sent to Fish Audio changes in a way that changes the
 * sound (bitrate, loudness normalisation, …), so every clip is made again.
 */
export const NARRATION_RECIPE = "fish-tts-1:mp3-128:loudnorm";

/** Folder inside the private bucket. Flat, so "clear cached audio" is one listing. */
export const NARRATION_CACHE_PREFIX = "guide-narration";

/** Are the guides narrated in this language at all (gate, rules, a voice, and text in at least one guide)? */
export function narrationLangSupported(lang: string | null | undefined): lang is string {
  return guideEnabledFor(lang) && hasSpokenForm(lang) && narrationLanguage(lang) !== null && GUIDES.some((g) => guideContentIn(g, lang) !== null);
}

/**
 * One card that can be spoken. `stepId` is the card's CLIP id: bare for an
 * Estimates step, `<namespace>.<step>` for every other guide. It is what the
 * route is asked for and what the clip is filed under.
 */
export type NarrationEntry = { lang: string; stepId: string; text: string };

/**
 * The text spoken for one guide card, or null for anything that is not a card
 * of a guide in a narrated language. A card is one of a tour's steps or its
 * single list card. The clip id says which guide (lib/guide/registry.ts), and
 * the step is then matched against THAT guide's step list, never used as an
 * object key, so "__proto__" and friends are simply not steps, and a step of
 * one guide can never be answered with another guide's card.
 *
 * The language is part of the answer: the same step id gives the Spanish text
 * for "es" and the English text for "en", and the clip is filed under that
 * language (clipCacheKey), so one language can never be served the other's.
 */
export function narrationEntry(lang: unknown, clipId: unknown): NarrationEntry | null {
  if (typeof lang !== "string" || typeof clipId !== "string") return null;
  if (!narrationLangSupported(lang)) return null;
  const found = resolveClipId(clipId);
  if (!found) return null;
  const { guide, stepId } = found;
  const content = guideContentIn(guide, lang);
  if (!content) return null;
  if (stepId === guide.list.hintId) {
    const text = spokenPickerText(lang, content.picker);
    return text ? { lang, stepId: clipIdFor(guide, guide.list.hintId), text } : null;
  }
  const step = guide.steps.find((s) => s.id === stepId);
  if (!step) return null;
  if (!Object.prototype.hasOwnProperty.call(content.steps, step.id)) return null;
  const overrides = Object.prototype.hasOwnProperty.call(guide.spoken, lang) ? guide.spoken[lang] : {};
  const text = spokenStepText(lang, step, content.steps[step.id], overrides);
  return text ? { lang, stepId: clipIdFor(guide, step.id), text } : null;
}

/** Every narrated card of one guide in a language: its steps in tour order, then its list card. */
export function narrationEntries(lang: string, guide: GuideDefinition = ESTIMATES_GUIDE): NarrationEntry[] {
  return guideCardIds(guide)
    .map((id) => narrationEntry(lang, clipIdFor(guide, id)))
    .filter((e): e is NarrationEntry => e !== null);
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

/**
 * Object key of a clip in the cache. The language leads the name, so two
 * languages never share an object even if a voice and a sentence coincide; the
 * step id is there for a human reading the bucket.
 */
export function clipCacheKey(entry: Pick<NarrationEntry, "lang" | "stepId">, clip: ClipIdentity): string {
  return `${NARRATION_CACHE_PREFIX}/${entry.lang}-${entry.stepId}-${clipHash(clip).slice(0, 32)}.mp3`;
}

/** Does this object key belong to the narration cache (and nothing else in the bucket)? */
export function isNarrationCacheKey(key: string): boolean {
  // <lang>-<step>-<hash>.mp3 for Estimates, <lang>-<namespace>.<step>-<hash>.mp3 for every other guide.
  return new RegExp(`^${NARRATION_CACHE_PREFIX}/[a-z]{2}-(?:[a-z]+\\.)?[A-Za-z0-9]+-[0-9a-f]{32}\\.mp3$`).test(key);
}
