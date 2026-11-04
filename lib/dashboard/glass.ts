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
 * The shipped values are 38% in dark theme and 42% in light, and the gap is
 * deliberate: the two themes are different materials over the same bright
 * photograph. Light is white frosted glass with dark text — it needs a little
 * more white to hold the text up; dark is smoky glass with light text, and a
 * smoky tint goes opaque-looking sooner than a white one does. One stored
 * number applied to both themes would flatten that. Every level therefore
 * carries BOTH percentages, each tuned by eye against the photo set in the
 * glass harness and then checked by measurement (below).
 *
 * WHY A PUBLISHED LIST AND NOT A FREE NUMBER
 * ------------------------------------------
 * `User.preferences` is free-form JSON on the user row and these numbers end up
 * inside a CSS custom property. Nothing outside this list is ever allowed to
 * reach the stylesheet — `coerceCardOpacityPercent` is the only door, and it
 * whitelists rather than clamps, so no hand-edited blob can put a string into
 * `color-mix()`. Same contract as `coerceBackgroundIntervalSeconds`.
 *
 * A value stored by the previous ladder (40/45/50/58/68, from the dark photo
 * set) matches nothing here and so resolves to the default — which is the
 * intended migration: the old numbers were tuned for a different material.
 *
 * WHERE THE BOUNDS COME FROM (measured, not guessed)
 * --------------------------------------------------
 * Method: every shipped JPEG under public/backgrounds reduced to a 24x14 block
 * grid (one block ≈ 80px at 1920, about what a 44px blur averages over); the
 * darkest and the brightest block of each taken as the worst backdrop a card
 * can land on; the whole stack composited (photo → CSS filter → worst scrim
 * stop → card alpha) and WCAG contrast computed against body text (--c-fg),
 * secondary text (--c-muted-on-photo) and the faintest tier
 * (--c-faint-on-photo). Blur only ever pulls an extreme block toward the local
 * mean, so the real card is never worse than these figures.
 *
 * Worst case over all 64 images, body / secondary / faint text under a card:
 *   most transparent (dark 30 / light 34)   light 4.57 / 3.77 / 2.65   dark 3.88 / 3.74 / 3.00
 *   default          (dark 38 / light 42)   light 5.10 / 4.21 / 2.96   dark 4.58 / 4.41 / 3.53
 *   most solid       (dark 56 / light 60)   see the figures printed by the harness
 * light's binding image is projects/01 (a dark desk edge), dark's is
 * architecture/01 (a white sky). Body text clears 4.5:1 at Standard in both
 * themes; the faint tier sits at the 3:1 floor at Standard and dips under it
 * on the two more-transparent steps — those steps trade the faintest captions
 * for more photograph, which is what choosing them means.
 *
 * The CEILING is not a legibility bound — contrast only improves as the card
 * fills in. It is set by the feature: past roughly 60% the photograph is no
 * longer identifiable behind the blur and the glass has become a plain panel,
 * at which point the user wants the background switch, not this one.
 */

export type CardOpacityLevel = {
  /** Percentage of `--glass-surface-color` mixed into the card in dark theme.
   *  Also the value stored in the preference blob — see `coerceCardOpacityPercent`. */
  dark: number;
  /** The light-theme counterpart. Always a little ABOVE `dark`; see the note above. */
  light: number;
  /** Shown in the Settings dropdown. Deliberately plain, and self-ordering. */
  label: string;
};

/** Ascending by opacity — most transparent first, so the dropdown reads as a scale. */
export const CARD_OPACITY_LEVELS: readonly CardOpacityLevel[] = [
  { dark: 30, light: 34, label: "Most transparent" },
  { dark: 34, light: 38, label: "More transparent" },
  { dark: 38, light: 42, label: "Standard" },
  { dark: 46, light: 50, label: "More solid" },
  { dark: 56, light: 60, label: "Most solid" },
];

/**
 * The "Standard" step — the pair globals.css carries as its defaults, so a
 * user who never touches the control sees exactly the stylesheet's look.
 */
export const DEFAULT_CARD_OPACITY_PERCENT = 38;

const DEFAULT_LEVEL: CardOpacityLevel =
  CARD_OPACITY_LEVELS.find((l) => l.dark === DEFAULT_CARD_OPACITY_PERCENT) ??
  { dark: 38, light: 42, label: "Standard" };

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
