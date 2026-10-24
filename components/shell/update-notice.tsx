"use client";

/**
 * "A new version is available — Reload." The updater of a web app.
 *
 * This tab was served one release (`version` + `build`, from the server that
 * rendered it). Every few minutes, and whenever the person comes back to the
 * tab, it asks /api/version what is deployed now. When that is a different
 * release it shows this strip. See lib/update/check.ts for the rule.
 *
 * IT NEVER RELOADS BY ITSELF. There may be a half-written estimate or an
 * unsent form in the tab; the person chooses the moment. "Later" hides the
 * strip for that release only: the next deploy brings it back.
 *
 * Failing quietly is the design: offline, a session that ran out, a deploy in
 * progress — none of them is a reason to interrupt anyone. It asks again later.
 */
import { useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";
import {
  CHECK_EVERY_MS,
  FIRST_CHECK_MS,
  dueForCheck,
  parseRelease,
  releaseId,
  updateAvailable,
  type Release,
} from "@/lib/update/check";

export function UpdateNotice({ version, build }: { version: string; build: string }) {
  const t = useT();
  const [deployed, setDeployed] = useState<Release | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const lastCheck = useRef(0);

  useEffect(() => {
    let alive = true;
    const running: Release = { version, build };

    const check = async () => {
      if (document.visibilityState === "hidden") return;
      if (!dueForCheck(lastCheck.current, Date.now())) return;
      lastCheck.current = Date.now();
      try {
        const res = await fetch("/api/version", { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) return;
        const found = parseRelease(await res.json());
        if (alive && updateAvailable(running, found)) setDeployed(found);
      } catch {
        // Offline, a sign-in page instead of JSON, a deploy mid-flight: ask again later.
      }
    };

    const first = window.setTimeout(check, FIRST_CHECK_MS);
    const every = window.setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      alive = false;
      window.clearTimeout(first);
      window.clearInterval(every);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [version, build]);

  if (!deployed || dismissed === releaseId(deployed)) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-update-notice=""
      className="no-print flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-brand/30 bg-brand/10 px-4 py-2 text-sm text-fg print:hidden"
    >
      <RefreshCw className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
      <span className="min-w-0">
        {fmt(t("A new version of AEC-flow is available (v{version}). Save your work, then reload to get it."), {
          version: deployed.version,
        })}
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex h-7 items-center gap-1.5 rounded-md bg-brand px-2.5 text-xs font-semibold text-brand-fg hover:bg-brand/90"
      >
        <span>{t("Reload now")}</span>
      </button>
      <button
        type="button"
        onClick={() => setDismissed(releaseId(deployed))}
        className="ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted hover:text-fg"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{t("Later")}</span>
      </button>
    </div>
  );
}
