"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_LANG, translate, type Lang } from "@/lib/i18n/dictionaries";

const STORAGE_KEY = "aecflow:lang";

type LanguageContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (text: string) => string;
};

const LanguageContext = createContext<LanguageContextValue>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  t: (text) => text,
});

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}

/** Convenience hook: `const t = useT();` then `t("Settings")`. */
export function useT(): (text: string) => string {
  return useContext(LanguageContext).t;
}

const isLang = (v: unknown): v is Lang => v === "en" || v === "es" || v === "nl";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Always render the default (en) on the server + first client paint to avoid a
  // hydration mismatch; load the saved choice after mount.
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate after mount
      if (isLang(saved)) setLangState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback((text: string) => translate(lang, text), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
  );
}
