/**
 * Lightweight i18n. The English string is the lookup key, so any UI string
 * becomes translatable just by wrapping it in `t("…")`; missing translations
 * fall back to the English text. Start with the navigation + chrome; expand
 * page bodies incrementally.
 */

import { AREAS } from "./dict";
import { type Dict, type Lang } from "./types";

export { LANG_CODES, isLang, type Lang } from "./types";

export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "es", label: "Español", short: "SP" },
  { code: "nl", label: "Nederlands", short: "NL" },
];

export const DEFAULT_LANG: Lang = "en";

function merge(lang: "es" | "nl"): Dict {
  return Object.assign({}, ...Object.values(AREAS).map((a) => a[lang]));
}

export const DICT: Record<Lang, Dict> = {
  en: {},
  es: merge("es"),
  nl: merge("nl"),
};

export function translate(lang: Lang, text: string): string {
  if (lang === "en") return text;
  return DICT[lang]?.[text] ?? text;
}
