/**
 * Next.js instrumentation. `onRequestError` is called for every error the
 * server hits while rendering a page, running a server action, handling a
 * route or running the proxy — including the ones an error page then hides
 * from the user behind a "ref" digest.
 *
 * Each becomes one `[aecflow-error]` line in the Vercel function logs; see
 * lib/observability/error-record.ts for what the line holds and what it never
 * holds. Logging must never throw: a failure here would replace the original
 * error with a worse one.
 */
import type { Instrumentation } from "next";
import { formatLogLine, serverErrorRecord } from "@/lib/observability/error-record";
import { APP_VERSION, appBuildId } from "@/lib/version";

export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  try {
    const record = serverErrorRecord(error, request, context, {
      version: APP_VERSION,
      build: appBuildId() || "dev",
    });
    console.error(formatLogLine(record));
  } catch {
    // Never let error reporting become the error.
  }
};
