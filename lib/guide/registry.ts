/**
 * INTERACTIVE-GUIDE: every guide the app has, and the lookup from a clip id
 * back to the guide and step it belongs to.
 *
 * Adding a guide to a screen is one definition here plus <GuideTour /> on that
 * screen. Nothing else (overlay, button, player, route, cache, Settings) needs
 * to know the guide exists.
 *
 * Pure data and lookups: no Prisma, no React, no DOM. Safe on both sides.
 */
import { GUIDE_PICKER_HINT_ID, GUIDE_PICKER_PATH, GUIDE_STEPS } from "@/lib/estimates/interactive-guide";
import { GUIDE_CONTENT } from "@/lib/estimates/interactive-guide-content";
import { SPOKEN_LANGS } from "@/lib/guide-narration/spoken";
import { PROPOSALS_GUIDE } from "@/lib/proposals/interactive-guide";
import { CLIP_NAMESPACE_SEPARATOR, type GuideDefinition } from "./definition";

/**
 * The Estimates editor. The first guide, and the only one whose clip ids carry
 * no namespace (see definition.ts): its steps, texts, spoken forms and clip
 * names are exactly what they were before the engine took a definition.
 */
export const ESTIMATES_GUIDE: GuideDefinition = {
  id: "estimates",
  title: "Estimates",
  clipNamespace: "",
  steps: GUIDE_STEPS,
  content: GUIDE_CONTENT,
  spoken: Object.fromEntries(Object.entries(SPOKEN_LANGS).map(([lang, spec]) => [lang, spec.overrides])),
  list: {
    path: GUIDE_PICKER_PATH,
    hintId: GUIDE_PICKER_HINT_ID,
    // The Estimates screens are a protected system and carry no marker for
    // this control, so it is found by its own label.
    target: { by: "text", labelKey: "New estimate" },
  },
};

export { PROPOSALS_GUIDE };

/** Every guide, in the order Settings lists them. */
export const GUIDES: readonly GuideDefinition[] = [ESTIMATES_GUIDE, PROPOSALS_GUIDE];

/** A guide by its id, or null. Matched against the list, never used as an object key. */
export function guideById(id: unknown): GuideDefinition | null {
  if (typeof id !== "string") return null;
  return GUIDES.find((g) => g.id === id) ?? null;
}

/**
 * The guide and step a clip id names, or null when it names neither. A bare id
 * is a step of Estimates and of no other guide; `<namespace>.<step>` is a step
 * of the guide with that namespace and of no other. Whether the step exists is
 * the caller's check: this only says where to look.
 */
export function resolveClipId(clipId: unknown): { guide: GuideDefinition; stepId: string } | null {
  if (typeof clipId !== "string" || clipId === "") return null;
  const at = clipId.indexOf(CLIP_NAMESPACE_SEPARATOR);
  if (at < 0) return { guide: ESTIMATES_GUIDE, stepId: clipId };
  const namespace = clipId.slice(0, at);
  const stepId = clipId.slice(at + CLIP_NAMESPACE_SEPARATOR.length);
  if (namespace === "" || stepId === "" || stepId.includes(CLIP_NAMESPACE_SEPARATOR)) return null;
  const guide = GUIDES.find((g) => g.clipNamespace !== "" && g.clipNamespace === namespace);
  return guide ? { guide, stepId } : null;
}
