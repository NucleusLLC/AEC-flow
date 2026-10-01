"use client";

import { useEffect } from "react";
import { AlertTriangle, Bug, RotateCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useT } from "@/components/i18n/language-provider";
import { openBetaReport } from "@/components/beta-report/open-beta-report";
import { bugReportPrefill } from "@/lib/observability/error-record";
import { reportClientError } from "@/lib/observability/report-client-error";
import { APP_VERSION } from "@/lib/version";

/**
 * Group-level error boundary for /(app) routes. Catches render/data errors so a
 * single failing page doesn't blank the whole shell.
 *
 * The error is logged twice over: the server already logged it under its digest
 * (instrumentation.ts), and this reports what the browser saw, under the same
 * digest. "Report this problem" opens the Bug/Wish widget with the ref filled
 * in, so a report in /beta-reports leads straight to the log line.
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
    console.error(error);
    reportClientError(error, "boundary", error.digest);
  }, [error]);

  const report = () =>
    openBetaReport(
      bugReportPrefill({
        message: error.message,
        digest: error.digest,
        path: window.location.pathname,
        version: APP_VERSION,
      }),
    );

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
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
          >
            <RotateCw className="h-4 w-4" />
            {t("Try again")}
          </button>
          <button
            type="button"
            onClick={report}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Bug className="h-4 w-4" />
            {t("Report this problem")}
          </button>
        </div>
      </Card>
    </div>
  );
}
