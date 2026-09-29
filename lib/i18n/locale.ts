/**
 * Which Intl locale formats dates for each UI language.
 *
 * Dates only. Money and plain numbers keep SYSTEM_LOCALE (lib/format.ts), so
 * digit grouping never changes under a user who switches language — a figure
 * that reads 1,234.50 in English and 1.234,50 in Dutch on the same invoice is a
 * support call. English stays "en-GB" (day-first, as before); the rest use the
 * language's own conventions, so a Dutch user reads "27 sep 2026" and a
 * Japanese user "2026年9月27日".
 */
import type { Lang } from "./types";

export const DATE_LOCALE: Record<Lang, string> = {
  en: "en-GB",
  es: "es",
  nl: "nl",
  de: "de",
  zh: "zh-CN",
  ja: "ja",
  pt: "pt-BR",
};

export function dateLocale(lang: Lang): string {
  return DATE_LOCALE[lang] ?? DATE_LOCALE.en;
}
