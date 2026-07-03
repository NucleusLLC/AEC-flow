"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Bug,
  Lightbulb,
  Camera,
  Trash2,
  Send,
  X,
  Check,
  Loader2,
  MessageSquarePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { submitBetaReport } from "@/app/(app)/beta-reports/actions";
import { MAX_SCREENSHOT_CHARS, type BetaReportKind } from "@/lib/data/beta-reports.types";

/** Longest edge of the saved screenshot, in px. Downscaling keeps the JPEG well
 * under the server action's body-size limit. */
const SCREENSHOT_MAX_EDGE = 1600;

type Phase = "form" | "sending" | "done";

/**
 * Floating BETA-Report widget — mounted once in the (app) layout. Lets beta
 * testers send a Bug or a Wish, optionally with a screenshot of the current
 * screen (captured via the browser's native screen-capture API — no extra
 * dependency, and unlike html2canvas it copes with Tailwind v4's oklch colors).
 */
export function BetaReportWidget() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [kind, setKind] = useState<BetaReportKind>("BUG");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setKind("BUG");
    setTitle("");
    setDescription("");
    setScreenshot(null);
    setError(null);
    setPhase("form");
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // Defer the reset so it doesn't flash during the close transition.
    setTimeout(resetForm, 200);
  }, [resetForm]);

  // Esc closes the panel; focus the summary when it opens.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => titleRef.current?.focus(), 60);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, close]);

  /** Grab one frame of the screen the user selects, downscaled to a JPEG data-URL. */
  const captureScreenshot = useCallback(async () => {
    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!md?.getDisplayMedia) {
      setError("Screen capture isn't supported in this browser.");
      return;
    }
    setError(null);
    setCapturing(true);
    let stream: MediaStream | null = null;
    try {
      // Hide our own panel so it doesn't appear in the shot, then yield a frame
      // for the browser to repaint before the picker opens.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      stream = await md.getDisplayMedia({
        // `preferCurrentTab` (Chromium) pre-selects this tab to cut friction.
        video: { displaySurface: "browser" },
        audio: false,
        preferCurrentTab: true,
      } as DisplayMediaStreamOptions);

      const track = stream.getVideoTracks()[0];
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      // Give the stream a moment to deliver real pixels (first frame can be blank).
      await new Promise((r) => setTimeout(r, 180));

      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;
      const scale = Math.min(1, SCREENSHOT_MAX_EDGE / Math.max(vw, vh));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(vw * scale);
      canvas.height = Math.round(vh * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Couldn't read the screen.");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      track.stop();

      let quality = 0.72;
      let dataUrl = canvas.toDataURL("image/jpeg", quality);
      // Step quality down if a busy screen still exceeds the payload ceiling.
      while (dataUrl.length > MAX_SCREENSHOT_CHARS && quality > 0.4) {
        quality -= 0.12;
        dataUrl = canvas.toDataURL("image/jpeg", quality);
      }
      if (dataUrl.length > MAX_SCREENSHOT_CHARS) {
        setError("That screen is too detailed to attach — try a smaller window.");
      } else {
        setScreenshot(dataUrl);
      }
    } catch (e) {
      // The user dismissing the picker throws — treat that as a quiet no-op.
      const name = e instanceof DOMException ? e.name : "";
      if (name !== "NotAllowedError" && name !== "AbortError") {
        setError("Couldn't capture the screen. You can still send the report without it.");
      }
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
      setCapturing(false);
    }
  }, []);

  const submit = useCallback(async () => {
    if (!title.trim()) {
      setError("Add a short summary so we know what this is.");
      titleRef.current?.focus();
      return;
    }
    if (!description.trim()) {
      setError("Tell us a little more in the description.");
      return;
    }
    setError(null);
    setPhase("sending");
    const res = await submitBetaReport({
      kind,
      title: title.trim(),
      description: description.trim(),
      pageUrl: typeof window !== "undefined" ? window.location.href : pathname,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      screenshot,
      reporterName: session?.user?.name ?? null,
      reporterEmail: session?.user?.email ?? null,
    });
    if (res.ok) {
      setPhase("done");
    } else {
      setError(res.error);
      setPhase("form");
    }
  }, [kind, title, description, screenshot, pathname, session]);

  const isWish = kind === "WISH";

  return (
    <>
      {/* Floating launcher */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-24 z-40 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/20 transition-transform hover:scale-[1.03] active:scale-95"
          aria-label="Report a new bug or wish"
        >
          <MessageSquarePlus className="h-4 w-4" />
          <span className="hidden sm:inline">New Bug/Wish</span>
        </button>
      ) : null}

      {open ? (
        <>
          {/* Backdrop (click to dismiss) — invisible while capturing so it's not in the shot */}
          <div
            className={cn(
              "fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]",
              capturing && "invisible",
            )}
            onClick={close}
            aria-hidden
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Beta feedback"
            className={cn(
              "fixed bottom-4 right-4 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl",
              capturing && "invisible",
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border bg-surface-2/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <MessageSquarePlus className="h-4 w-4" />
                </span>
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-fg">Beta feedback</div>
                  <div className="text-[11px] text-muted">Report a bug or share a wish</div>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-md p-1 text-faint transition-colors hover:bg-surface-2 hover:text-fg"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {phase === "done" ? (
              <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
                  <Check className="h-6 w-6" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-fg">Thanks — it&apos;s on its way!</div>
                  <p className="mt-1 text-xs text-muted">
                    Your {isWish ? "wish" : "bug report"} was sent to the team.
                  </p>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
                  >
                    Send another
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand/90"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
                {/* Kind toggle */}
                <div className="grid grid-cols-2 gap-2">
                  <KindButton
                    active={kind === "BUG"}
                    onClick={() => setKind("BUG")}
                    icon={<Bug className="h-4 w-4" />}
                    label="Bug"
                    hint="Something's broken"
                    activeClass="border-red-300 bg-red-50 text-red-700"
                  />
                  <KindButton
                    active={kind === "WISH"}
                    onClick={() => setKind("WISH")}
                    icon={<Lightbulb className="h-4 w-4" />}
                    label="Wish"
                    hint="An idea or request"
                    activeClass="border-violet-300 bg-violet-50 text-violet-700"
                  />
                </div>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Summary</span>
                  <input
                    ref={titleRef}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={140}
                    placeholder={isWish ? "I wish I could…" : "What went wrong?"}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg outline-none placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Details</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    placeholder={
                      isWish
                        ? "Describe the idea and why it would help…"
                        : "Steps to reproduce, what you expected, what happened…"
                    }
                    className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg outline-none placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                </label>

                {/* Screenshot */}
                <div>
                  <span className="mb-1 block text-xs font-medium text-muted">
                    Screenshot <span className="text-faint">(optional)</span>
                  </span>
                  {screenshot ? (
                    <div className="group relative overflow-hidden rounded-lg border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={screenshot}
                        alt="Captured screenshot"
                        className="max-h-44 w-full object-cover object-top"
                      />
                      <button
                        type="button"
                        onClick={() => setScreenshot(null)}
                        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/75"
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={captureScreenshot}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-2/40 px-3 py-3 text-sm font-medium text-muted transition-colors hover:border-brand/40 hover:bg-surface-2 hover:text-fg"
                    >
                      <Camera className="h-4 w-4" />
                      Capture screenshot
                    </button>
                  )}
                  <p className="mt-1 text-[11px] text-faint">
                    Your browser will ask which screen or window to share.
                  </p>
                </div>

                {error ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {error}
                  </div>
                ) : null}
              </div>
            )}

            {/* Footer */}
            {phase !== "done" ? (
              <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-2/40 px-4 py-3">
                <span className="truncate text-[11px] text-faint">
                  {session?.user?.name ? `Sending as ${session.user.name}` : "Sending anonymously"}
                </span>
                <button
                  type="button"
                  onClick={submit}
                  disabled={phase === "sending"}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand/90 disabled:opacity-60"
                >
                  {phase === "sending" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {phase === "sending" ? "Sending…" : "Send"}
                </button>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}

function KindButton({
  active,
  onClick,
  icon,
  label,
  hint,
  activeClass,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
  activeClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors",
        active
          ? activeClass
          : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {label}
      </span>
      <span className="text-[11px] opacity-80">{hint}</span>
    </button>
  );
}
