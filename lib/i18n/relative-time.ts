/**
 * "3 days ago" in the viewer's language. date-fns ships the wording per locale;
 * this only picks the one for each UI language, English staying en-GB.
 */
import { formatDistanceToNow, type Locale } from "date-fns";
import { de } from "date-fns/locale/de";
import { enGB } from "date-fns/locale/en-GB";
import { es } from "date-fns/locale/es";
import { ja } from "date-fns/locale/ja";
import { nl } from "date-fns/locale/nl";
import { ptBR } from "date-fns/locale/pt-BR";
import { zhCN } from "date-fns/locale/zh-CN";
import type { Lang } from "./types";

const RELATIVE_LOCALE: Record<Lang, Locale> = { en: enGB, es, nl, de, zh: zhCN, ja, pt: ptBR };

export function timeAgo(date: Date | string, lang: Lang = "en"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: RELATIVE_LOCALE[lang] ?? enGB });
}
