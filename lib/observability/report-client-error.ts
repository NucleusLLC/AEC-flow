/**
 * Sends a browser error to /api/client-error, which logs it next to the server
 * errors. Browser-only. Fire and forget: reporting must never throw, never
 * block, and never loop — so at most MAX_PER_PAGE reports leave one page load,
 * and the same message is sent once.
 */

export const MAX_PER_PAGE = 5;

let sent = 0;
const seen = new Set<string>();

export type ClientErrorSource = "boundary" | "window" | "promise";

export function reportClientError(
  error: unknown,
  source: ClientErrorSource,
  digest?: string,
): void {
  try {
    if (typeof window === "undefined") return;
    const e = (error && typeof error === "object" ? error : {}) as {
      name?: unknown;
      message?: unknown;
      stack?: unknown;
    };
    const message =
      typeof e.message === "string" ? e.message : typeof error === "string" ? error : String(error ?? "");
    if (!message) return;
    const key = `${source}:${digest ?? ""}:${message}`;
    if (seen.has(key) || sent >= MAX_PER_PAGE) return;
    seen.add(key);
    sent += 1;

    const body = JSON.stringify({
      source,
      message,
      name: typeof e.name === "string" ? e.name : undefined,
      stack: typeof e.stack === "string" ? e.stack.slice(0, 8000) : undefined,
      digest,
      path: window.location.pathname,
      userAgent: navigator.userAgent,
    });
    const blob = new Blob([body], { type: "application/json" });
    if (!navigator.sendBeacon?.("/api/client-error", blob)) {
      void fetch("/api/client-error", {
        method: "POST",
        body,
        headers: { "content-type": "application/json" },
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Never let error reporting become the error.
  }
}
