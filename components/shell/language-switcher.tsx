"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { LANGS, type Lang } from "@/lib/i18n/dictionaries";

/** Compact EN / SP / NL language picker for the topbar. */
export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  return (
    <label className="relative inline-flex items-center" title="Language">
      <Languages className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        aria-label="Language"
        className="h-9 cursor-pointer appearance-none rounded-lg border border-border bg-surface pl-7 pr-6 text-xs font-medium text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.short}
          </option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-faint" viewBox="0 0 12 12" fill="none">
        <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}
