/**
 * Card transparency for the dashboard background — the user-facing knob behind
 * `--glass-surface` (Settings › Preferences › Appearance).
 *
 * Pure and client-safe for the same reason as `backgrounds.ts`: the server
 * layout and the client backdrop both read it, so it must import nothing that
 * would drag the DB into the browser bundle.
 *
 * WHY A PAIR OF NUMBERS PER LEVEL, NOT ONE
 * ----------------------------------------
 * The shipped values are 50% in dark theme and 42% in light, and that gap is
 * deliberate: white washes out faster than black, so the same alpha that reads
 * as glass over a dark surface reads as a milky slab over a light one (see the
 * knob block in app/globals.css). One stored number applied to both themes
 * would flatten that. Every level therefore carries BOTH percentages. `light`
 * tracks `dark` at the shipped ratio (42/50 = 0.84), rounded — so the
 * relationship holds at every step of the control instead of only at the
 * default, and narrows as the card fills in, where there is less left to split.
 *
 * WHY A PUBLISHED LIST AND NOT A FREE NUMBER
 * ------------------------------------------
 * `User.preferences` is free-form JSON on the user row and these numbers end up
 * inside a CSS custom property. Nothing outside this list is ever allowed to
 * reach the stylesheet — `coerceCardOpacityPercent` is the only door, and it
 * whitelists rather than clamps, so no hand-edited blob can put a string into
 * `color-mix()`. Same contract as `coerceBackgroundIntervalSeconds`.
 *
 * WHERE THE BOUNDS COME FROM (measured, not guessed)
 * --------------------------------------------------
 * Method: the twelve real JPEGs in public/backgrounds/dashboard reduced to a
 * 24x14 block grid; the darkest and the brightest block of each taken as the
 * worst backdrop a card can land on; the whole stack composited (photo → CSS
 * brightness filter → worst scrim stop → card alpha) and WCAG contrast computed
 * against body text (--c-fg) and secondary text (--c-muted-on-photo). Blur is
 * not modelled, and blur only ever pulls an extreme block toward the local
 * mean — so the real card is never worse than these figures.
 *
 *   worst case over all twelve images, body + secondary text:
 *     most transparent  (dark 40 / light 34)   light 5.90:1   dark  7.50:1
 *     default           (dark 50 / light 42)   light 6.70:1   dark  8.50:1
 *     least transparent (dark 68 / light 57)   light 8.40:1   dark 10.56:1
 *   light theme is the binding case at every step, on 01-blueprint-desk; dark's
 *   worst is 05-atrium-light, the same pair the shipped values were signed off
 *   against (the default row reproduces those published figures exactly).
 *
 * The FLOOR is set by the faintest tier in the app rather than by body text.
 * `text-faint` (#4b5563 on light) measures 3.04:1 at light 34% — the 3:1 WCAG
 * floor for large/incidental text. One step further open (light 30%) puts it at
 * 2.84:1, under the floor, which is where a card stops being readable rather
 * than merely airy. So the list stops at 34%. Body text has far more room:
 * it does not reach 4.5:1 until roughly light 20%.
 *
 * The CEILING is not a legibility bound — contrast only improves as the card
 * fills in. It is set by the feature: past roughly 60% white the photograph is
 * no longer identifiable behind the card and the glass has become a plain
 * panel, at which point the user wants the background switch, not this one.
 */

export type CardOpacityLevel = {
  /** Percentage of `--glass-surface-color` mixed into the card in dark theme.
   *  Also the value stored in the preference blob — see `coerceCardOpacityPercent`. */
  dark: number;
  /** The light-theme counterpart. Never equal to `dark`; see the note above. */
  light: number;
  /** Shown in the Settings dropdown. Deliberately plain, and self-ordering. */
  label: string;
};

/** Ascending by opacity — most transparent first, so the dropdown reads as a scale. */
export const CARD_OPACITY_LEVELS: readonly CardOpacityLevel[] = [
  { dark: 40, light: 34, label: "Most transparent" },
  { dark: 45, light: 38, label: "More transparent" },
  { dark: 50, light: 42, label: "Standard" },
  { dark: 58, light: 49, label: "More solid" },
  { dark: 68, light: 57, label: "Most solid" },
];

/**
 * Today's look. A user who never touches this control must see no change at
 * all, so it has to stay the pair already carried by globals.css (50 / 42).
 */
export const DEFAULT_CARD_OPACITY_PERCENT = 50;

const DEFAULT_LEVEL: CardOpacityLevel =
  CARD_OPACITY_LEVELS.find((l) => l.dark === DEFAULT_CARD_OPACITY_PERCENT) ??
  { dark: 50, light: 42, label: "Standard" };

/**
 * Resolve a stored value to a published level. Anything the dropdown could not
 * have produced — a stale key, a hand-edited blob, a string, a number that is
 * merely plausible — falls back to the default rather than reaching CSS.
 */
export function resolveCardOpacityLevel(value: unknown): CardOpacityLevel {
  return CARD_OPACITY_LEVELS.find((l) => l.dark === value) ?? DEFAULT_LEVEL;
}

/** The validated number to store back in the preferences blob. */
export function coerceCardOpacityPercent(value: unknown): number {
  return resolveCardOpacityLevel(value).dark;
}

/**
 * The two custom properties the backdrop wrapper carries. globals.css picks one
 * of them into `--glass-surface` per theme — which is the only way to keep the
 * light/dark split when the theme is decided in the browser (a `.dark` class)
 * and the preference is rendered on the server.
 *
 * The values are `<percentage>` tokens built from the published table and from
 * nowhere else, so nothing user-supplied is ever interpolated into CSS.
 */
export function cardOpacityVars(value: unknown): Record<string, string> {
  const level = resolveCardOpacityLevel(value);
  return {
    "--glass-surface-light": `${level.light}%`,
    "--glass-surface-dark": `${level.dark}%`,
  };
}
