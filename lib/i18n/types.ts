/** The UI languages. English is the key language and needs no dictionary. */
export type Lang = "en" | "es" | "nl" | "de" | "zh" | "ja" | "pt";

/** Languages whose strings live beside English in each area file (dict/<area>.ts). */
export type AreaLang = "es" | "nl";

/** Languages with one folder of area files each (dict/<lang>/<area>.ts). */
export type ExtraLang = "de" | "zh" | "ja" | "pt";

export const LANG_CODES: readonly Lang[] = ["en", "es", "nl", "de", "zh", "ja", "pt"];

export const isLang = (v: unknown): v is Lang =>
  typeof v === "string" && (LANG_CODES as readonly string[]).includes(v);

export type Dict = Record<string, string>;

/** One area's strings. Both languages are required so neither can fall behind. */
export type AreaDict = { es: Dict; nl: Dict };
