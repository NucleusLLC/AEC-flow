/**
 * Server-side translation. Page bodies are React Server Components and can't use
 * the client `useT` hook, so they read the `lang` cookie (set by the client
 * LanguageProvider) and translate with the shared dictionary.
 *
 *   const t = await getServerT();
 *   <h2>{t("Clients")}</h2>
 */
import { cookies } from "next/headers";
import { DEFAULT_LANG, isLang, translate, type Lang } from "./dictionaries";
import { dateLocale } from "./locale";

export async function getServerLang(): Promise<Lang> {
  try {
    const c = await cookies();
    const v = c.get("lang")?.value;
    return isLang(v) ? v : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

export async function getServerT(): Promise<(text: string) => string> {
  const lang = await getServerLang();
  return (text: string) => translate(lang, text);
}

/**
 * The Intl locale for dates in the viewer's language:
 *
 *   const locale = await getServerLocale();
 *   formatDate(row.createdAt, locale)
 */
export async function getServerLocale(): Promise<string> {
  return dateLocale(await getServerLang());
}
