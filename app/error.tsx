"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { useT } from "@/components/i18n/language-provider";

/**
 * Error boundary for pages outside the app shell: sign-in, sign-up, password
 * reset, invitations, the legal pages and the print routes. The server logged
 * the failure under its digest (instrumentation.ts); the ref shown here is
 * that digest, so a user can quote it.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-2 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h1 className="text-xl font-semibold text-fg">{t("Something went wrong")}</h1>
      <p className="max-w-md text-sm text-muted">
        {t("This page hit an unexpected error. Try again; if it keeps happening, tell us the reference below.")}
      </p>
      {error.digest ? <p className="font-mono text-[11px] text-faint">ref: {error.digest}</p> : null}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <RotateCw className="h-4 w-4" />
          {t("Try again")}
        </button>
        <Link
          href="/login"
          className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-2"
        >
          {t("Back to sign in")}
        </Link>
      </div>
    </main>
  );
}
