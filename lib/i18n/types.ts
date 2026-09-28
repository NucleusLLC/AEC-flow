/** The UI languages. English is the key language and needs no dictionary. */
export type Lang = "en" | "es" | "nl" | "de" | "zh" | "ja" | "pt";

/** Languages that translate the whole app (one area dictionary each). */
export type FullLang = "es" | "nl";

/** Languages that translate the navigation and app chrome only. */
export type MenuLang = "de" | "zh" | "ja" | "pt";

export const LANG_CODES: readonly Lang[] = ["en", "es", "nl", "de", "zh", "ja", "pt"];

export const isLang = (v: unknown): v is Lang =>
  typeof v === "string" && (LANG_CODES as readonly string[]).includes(v);

export type Dict = Record<string, string>;

/** One area's strings. Both languages are required so neither can fall behind. */
export type AreaDict = { es: Dict; nl: Dict };
