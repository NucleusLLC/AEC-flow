/**
 * GUIDE NARRATION: the Fish Audio voices and models the guide may be read in.
 *
 * One entry per narrated language. The default voice of a language is what
 * Settings is prefilled with and what is used when nothing was saved. Adding a
 * language is one entry here plus its rules in spoken.ts.
 *
 * The Spanish voices were auditioned on 10 OCT 2026 against the cards with
 * units and numbers in them, and every one read them back correctly when the
 * clips were transcribed. They are community voices on Fish Audio, addressed by
 * their reference id; a voice its owner withdraws simply fails, and the guide
 * then runs silent.
 *
 * Pure data, safe to import from a client component.
 */

export type NarrationVoice = {
  /** Fish Audio reference id: 32 hex characters. */
  id: string;
  name: string;
  /** One line for the Settings list; an i18n key (it goes through t()). */
  note: string;
};

export type NarrationLanguage = {
  defaultVoice: string;
  voices: readonly NarrationVoice[];
  /** The fixed sentence the "Test voice" button speaks. Never taken from the client. */
  sample: string;
};

export const NARRATION_LANGUAGES: Record<string, NarrationLanguage> = {
  es: {
    defaultVoice: "8b7187104e32481bb675f0cca0b0a002",
    voices: [
      { id: "8b7187104e32481bb675f0cca0b0a002", name: "Narrador Documental", note: "Male, clear and unhurried (default)" },
      { id: "70fb19852a484f3eb1d040423e2a8be7", name: "Nagi", note: "Female, professional and clear" },
      { id: "e296306da5d449999f6e35c2b9f60aea", name: "Colombiana IA", note: "Female, warm, Colombian accent" },
      { id: "692eb1e1023242219dc8caae8c56fb12", name: "Verity", note: "Female, friendly assistant" },
    ],
    sample: "Hola. Esta es la voz de la guía interactiva: ochenta y tres coma ocho metros cuadrados.",
  },
};

/**
 * Fish Audio TTS models, newest first (the `model` request header). The free
 * developer tier is the default because it needs no API credit; the paid
 * models answer 402 until the Fish Audio account holds API credit.
 */
export const NARRATION_MODELS = ["s2.1-pro-free", "s2.1-pro", "s2-pro", "s1"] as const;
export type NarrationModel = (typeof NARRATION_MODELS)[number];
export const DEFAULT_NARRATION_MODEL: NarrationModel = "s2.1-pro-free";

export function isNarrationModel(value: unknown): value is NarrationModel {
  return typeof value === "string" && (NARRATION_MODELS as readonly string[]).includes(value);
}

/** A Fish Audio reference id is 32 lowercase hex characters. */
export function isVoiceId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{32}$/.test(value);
}

export function narrationLanguage(lang: string | null | undefined): NarrationLanguage | null {
  if (typeof lang !== "string") return null;
  return Object.prototype.hasOwnProperty.call(NARRATION_LANGUAGES, lang) ? NARRATION_LANGUAGES[lang] : null;
}
