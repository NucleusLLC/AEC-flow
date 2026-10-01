"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/observability/report-client-error";

/**
 * Catches what no error boundary sees — an exception in an event handler, a
 * timer, or a promise nobody awaited — and reports it. Mounted once in the app
 * shell, where every request is signed in.
 */
export function ClientErrorListener() {
  useEffect(() => {
    const onError = (ev: ErrorEvent) => {
      // A failed <img>/<script> load fires "error" with no error object; skip it.
      if (!ev.error && !ev.message) return;
      // Cross-origin scripts report only "Script error." with nothing to act on.
      if (ev.message === "Script error.") return;
      reportClientError(ev.error ?? ev.message, "window");
    };
    const onRejection = (ev: PromiseRejectionEvent) => {
      reportClientError(ev.reason, "promise");
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
