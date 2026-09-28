"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useT } from "@/components/i18n/language-provider";

/**
 * Group-level error boundary for /(app) routes. Catches render/data errors so a
 * single failing page doesn't blank the whole shell. Becomes load-bearing once
 * the data layer hits a live database and queries can throw.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  useEffect(() => {
    // Surface for debugging; wire to a real logger when available.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-fg">{t("Something went wrong")}</h2>
        <p className="max-w-md text-sm text-muted">
          {t("This view hit an unexpected error. You can retry — if it keeps happening, the data source may be unavailable.")}
        </p>
        {error.digest ? (
          <p className="font-mono text-[11px] text-faint">ref: {error.digest}</p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <RotateCw className="h-4 w-4" />
          {t("Try again")}
        </button>
      </Card>
    </div>
  );
}
