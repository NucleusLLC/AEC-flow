/**
 * Lightweight i18n. The English string is the lookup key, so any UI string
 * becomes translatable just by wrapping it in `t("…")`; missing translations
 * fall back to the English text. Start with the navigation + chrome; expand
 * page bodies incrementally.
 */

import { AREAS } from "./dict";
import { MENU_EXTRA } from "./dict/menu-extra";
import { type Dict, type FullLang, type Lang } from "./types";

export { LANG_CODES, isLang, type Lang } from "./types";

export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "es", label: "Español", short: "SP" },
  { code: "nl", label: "Nederlands", short: "NL" },
  // Menu and app chrome only; page bodies stay in English (dict/menu-extra.ts).
  { code: "de", label: "Deutsch", short: "DE" },
  { code: "zh", label: "中文", short: "中文" },
  { code: "ja", label: "日本語", short: "日本語" },
  { code: "pt", label: "Português", short: "PT" },
];

export const DEFAULT_LANG: Lang = "en";

function merge(lang: FullLang): Dict {
  return Object.assign({}, ...Object.values(AREAS).map((a) => a[lang]));
}

export const DICT: Record<Lang, Dict> = {
  en: {},
  es: merge("es"),
  nl: merge("nl"),
  ...MENU_EXTRA,
};

export function translate(lang: Lang, text: string): string {
  if (lang === "en") return text;
  return DICT[lang]?.[text] ?? text;
}
