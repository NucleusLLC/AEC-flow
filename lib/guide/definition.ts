/**
 * INTERACTIVE-GUIDE, the engine's contract: what ONE guide is.
 *
 * A guide is data. The overlay, the button, the audio player, the narration
 * route and the clip cache are the same for every guide; a screen gets a tour
 * by supplying a definition (its ordered steps, where each step points, the
 * card text per language and how that text is spoken) and mounting
 * <GuideTour guide={…} />. Estimates and Service Proposals are two definitions
 * (lib/guide/registry.ts).
 *
 * CLIP IDS ARE NAMESPACED PER GUIDE. A step id is only unique inside its own
 * guide ("client" is a step of both). The id a browser asks the narration route
 * for, and the name a clip is cached under, is `<namespace>.<stepId>`, so one
 * guide can never be served another guide's clip. Estimates is the one
 * exception, and on purpose: it shipped before there was a second guide, its
 * clips are already in the production cache under bare step ids, and renaming
 * them would make production synthesise every one of them again. Its namespace
 * is therefore the empty one, and a bare id means "a step of Estimates" and
 * nothing else.
 *
 * Pure types and string helpers: no Prisma, no React, no DOM.
 */
import type { GuideContent, GuideStep } from "@/lib/estimates/interactive-guide";
import type { SpokenOverride } from "@/lib/guide-narration/spoken";
import type { Lang } from "@/lib/i18n/types";

/** How the list screen's "start here" control is found on the page. */
export type GuideListTarget =
  /** By the control's own text, as the dictionary translates `labelKey`. For a screen that carries no marker. */
  | { by: "text"; labelKey: string }
  /** By a `data-guide` attribute. */
  | { by: "marker"; name: string };

export type GuideDefinition = {
  /** Stable key of the guide: "estimates", "proposals". */
  id: string;
  /** Display name; an i18n key. */
  title: string;
  /** Prefix of this guide's clip ids. Empty for Estimates only (see above). */
  clipNamespace: string;
  /** The tour, in the order it runs. */
  steps: readonly GuideStep[];
  /** Card text per language. A language missing here has no guide. */
  content: Partial<Record<Lang, GuideContent>>;
  /** Per language, per step: what is said instead of what the generic rules would make of the card. */
  spoken: Record<string, Record<string, SpokenOverride>>;
  /** The screen with no editor on it, where the button shows one card instead of the tour. */
  list: {
    /** Exact pathname of that screen. */
    path: string;
    /** Step id of its one card. Not in `steps`. */
    hintId: string;
    target: GuideListTarget;
  };
};

/** Separates a guide's namespace from a step id. Never part of either. */
export const CLIP_NAMESPACE_SEPARATOR = ".";

/** The id the narration route and the clip cache know a card by. */
export function clipIdFor(guide: Pick<GuideDefinition, "clipNamespace">, stepId: string): string {
  return guide.clipNamespace ? `${guide.clipNamespace}${CLIP_NAMESPACE_SEPARATOR}${stepId}` : stepId;
}

/** Every card of a guide that can have a clip: its steps in tour order, then the list card. */
export function guideCardIds(guide: Pick<GuideDefinition, "steps" | "list">): string[] {
  return [...guide.steps.map((s) => s.id), guide.list.hintId];
}

/** The card text of a guide in a language, or null when it has none. */
export function guideContentIn(guide: Pick<GuideDefinition, "content">, lang: string | null | undefined): GuideContent | null {
  if (typeof lang !== "string") return null;
  return Object.prototype.hasOwnProperty.call(guide.content, lang) ? ((guide.content as Record<string, GuideContent | undefined>)[lang] ?? null) : null;
}
