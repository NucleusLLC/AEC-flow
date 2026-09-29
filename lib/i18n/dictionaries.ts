/**
 * Lightweight i18n. The English string is the lookup key, so any UI string
 * becomes translatable just by wrapping it in `t("…")`; missing translations
 * fall back to the English text. Start with the navigation + chrome; expand
 * page bodies incrementally.
 */

import { AREAS } from "./dict";
import { EXTRA_AREAS } from "./dict/extra";
import { type AreaLang, type Dict, type ExtraLang, type Lang } from "./types";

export { LANG_CODES, isLang, type Lang } from "./types";

export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "es", label: "Español", short: "SP" },
  { code: "nl", label: "Nederlands", short: "NL" },
  { code: "de", label: "Deutsch", short: "DE" },
  { code: "zh", label: "中文", short: "中文" },
  { code: "ja", label: "日本語", short: "日本語" },
  { code: "pt", label: "Português", short: "PT" },
];

export const DEFAULT_LANG: Lang = "en";

function merge(lang: AreaLang): Dict {
  return Object.assign({}, ...Object.values(AREAS).map((a) => a[lang]));
}

function mergeExtra(lang: ExtraLang): Dict {
  return Object.assign({}, ...Object.values(EXTRA_AREAS[lang]));
}

export const DICT: Record<Lang, Dict> = {
  en: {},
  es: merge("es"),
  nl: merge("nl"),
  de: mergeExtra("de"),
  zh: mergeExtra("zh"),
  ja: mergeExtra("ja"),
  pt: mergeExtra("pt"),
};

export function translate(lang: Lang, text: string): string {
  if (lang === "en") return text;
  return DICT[lang]?.[text] ?? text;
}
