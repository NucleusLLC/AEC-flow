"use client";

import { Printer } from "lucide-react";
import { useT } from "@/components/i18n/language-provider";

export function PrintButton() {
  const t = useT();
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
    >
      <Printer className="h-4 w-4" />
      {t("Print / Save as PDF")}
    </button>
  );
}
