"use client";

import { useT } from "@/components/i18n/language-provider";

/**
 * Renders an English UI string translated into the user's UI language. Lets
 * server-safe primitives (badges, cards) translate a label without becoming
 * client components themselves.
 */
export function TranslatedText({ text }: { text: string }) {
  const t = useT();
  return <>{t(text)}</>;
}
