"use client";

/**
 * INTERACTIVE-GUIDE: what the tour in the Estimates editor (estimate-guide.tsx)
 * and the single card on the Estimates landing screen (estimate-guide-picker.tsx)
 * have in common. The button and where it sits, the overlay's styles, the
 * narration manifest, and the one fact the two need to agree on: whether the
 * editor's own guide is on the page.
 *
 * Every label sits in its own <span>. A text node beside a conditionally
 * rendered sibling is what browser page translation breaks React on.
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Compass } from "lucide-react";
import {
  GUIDE_BUTTON_LABEL,
  GUIDE_FLY_MS,
  GUIDE_HOLD_MS,
  GUIDE_TOPBAR_SLOT_ID,
  GUIDE_TOPBAR_SLOT_READY,
  type Rect,
} from "@/lib/estimates/interactive-guide";
import { NARRATION_OFF, type NarrationManifest } from "@/lib/guide-narration/timing";
import { fetchNarrationManifest } from "./narration-player";

// ---------------------------------------------------------------------------
// Reading the page
// ---------------------------------------------------------------------------

export const toRect = (r: DOMRect): Rect => ({ left: r.left, top: r.top, width: r.width, height: r.height });

/** localStorage, or null where the browser refuses even to hand it over. */
export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

// ---------------------------------------------------------------------------
// Styles. One static block, mounted with an overlay and gone with it.
// ---------------------------------------------------------------------------

const FLY = `${GUIDE_FLY_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;

export const GUIDE_CSS = `
.aeg-root{position:fixed;inset:0;z-index:80;pointer-events:none;overflow:hidden;--aeg:#ec4899}
.aeg-ring{position:absolute;left:0;top:0;width:0;height:0;border-radius:10px;border:2px solid var(--aeg);opacity:0;
  box-shadow:0 0 0 3px color-mix(in srgb,var(--aeg) 40%,transparent),0 0 26px 6px color-mix(in srgb,var(--aeg) 75%,transparent),inset 0 0 18px 0 color-mix(in srgb,var(--aeg) 30%,transparent),0 0 0 200vmax rgba(2,6,23,.3)}
.aeg-card{position:absolute;left:0;top:0;width:min(340px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:visible;pointer-events:auto;opacity:0;
  border-radius:22px;border:2px solid var(--aeg);background:color-mix(in srgb,var(--aeg) 13%,#fff);color:#0f172a;
  box-shadow:0 18px 44px -10px rgba(2,6,23,.55),0 0 0 4px color-mix(in srgb,var(--aeg) 22%,transparent),0 0 28px 2px color-mix(in srgb,var(--aeg) 45%,transparent);
  font-size:13px;line-height:1.4}
.aeg-root[data-ready="1"] .aeg-ring,.aeg-root[data-ready="1"] .aeg-card{opacity:1;transition:opacity 180ms ease-out}
.aeg-root[data-fly="1"] .aeg-ring{transition:left ${FLY},top ${FLY},width ${FLY},height ${FLY},border-color 300ms ease,box-shadow 300ms ease}
.aeg-root[data-fly="1"] .aeg-card{transition:transform ${FLY},border-color 300ms ease,background-color 300ms ease,box-shadow 300ms ease}
.aeg-tail{position:absolute;width:14px;height:14px;background:inherit;border:2px solid var(--aeg);transform:rotate(45deg);display:none}
.aeg-card[data-side="bottom"] .aeg-tail{display:block;top:-9px;border-right-color:transparent;border-bottom-color:transparent}
.aeg-card[data-side="top"] .aeg-tail{display:block;bottom:-9px;border-left-color:transparent;border-top-color:transparent}
.aeg-card[data-side="right"] .aeg-tail{display:block;left:-9px;border-right-color:transparent;border-top-color:transparent}
.aeg-card[data-side="left"] .aeg-tail{display:block;right:-9px;border-left-color:transparent;border-bottom-color:transparent}
.aeg-badge{display:inline-flex;height:26px;min-width:26px;padding:0 6px;align-items:center;justify-content:center;border-radius:9999px;background:var(--aeg);color:#fff;font-weight:800;font-size:13px;font-variant-numeric:tabular-nums;flex-shrink:0;text-shadow:0 1px 1px rgba(0,0,0,.35)}
.aeg-title{font-size:15px;font-weight:800;letter-spacing:.01em;color:color-mix(in srgb,var(--aeg) 62%,#0f172a)}
.aeg-btn{display:inline-flex;height:28px;align-items:center;gap:3px;padding:0 8px;border-radius:8px;border:1px solid color-mix(in srgb,var(--aeg) 45%,#cbd5e1);background:rgba(255,255,255,.75);color:#0f172a;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;cursor:pointer}
.aeg-btn:hover{background:#fff}
.aeg-btn:disabled{opacity:.4;cursor:default}
.aeg-btn:focus-visible{outline:2px solid var(--aeg);outline-offset:2px}
.aeg-track{height:3px;border-radius:9999px;background:color-mix(in srgb,var(--aeg) 22%,transparent);overflow:hidden}
.aeg-fill{height:100%;width:100%;border-radius:9999px;background:var(--aeg);transform-origin:left center;transform:scaleX(0)}
.aeg-fill[data-run="1"]{animation:aeg-fill ${GUIDE_HOLD_MS}ms linear forwards}
@keyframes aeg-fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@media (prefers-reduced-motion: reduce){
  .aeg-root .aeg-ring,.aeg-root .aeg-card{transition:none !important}
}
@media print{.aeg-root{display:none !important}}
`;

// ---------------------------------------------------------------------------
// Is the editor's own guide on the page?
// ---------------------------------------------------------------------------

let editorGuides = 0;
const editorGuideListeners = new Set<() => void>();

/**
 * Called by the editor's guide while its button is on the page; returns the
 * undo. The landing-screen button reads this and steps aside at once, so there
 * are never two INTERACTIVE-GUIDE buttons.
 */
export function registerEditorGuide(): () => void {
  editorGuides += 1;
  editorGuideListeners.forEach((notify) => notify());
  return () => {
    editorGuides -= 1;
    editorGuideListeners.forEach((notify) => notify());
  };
}

function subscribeEditorGuide(notify: () => void): () => void {
  editorGuideListeners.add(notify);
  return () => void editorGuideListeners.delete(notify);
}

export function useEditorGuideMounted(): boolean {
  return useSyncExternalStore(
    subscribeEditorGuide,
    () => editorGuides > 0,
    () => false,
  );
}

// ---------------------------------------------------------------------------
// Narration
// ---------------------------------------------------------------------------

/**
 * Is the guide narrated in this language? Asked once per language (one small
 * request, no audio), so that a card's clip can start with the card. "No", or
 * no answer, is silence. A changed language is asked again, so the next run
 * plays that language's clips.
 */
export function useNarrationManifest(lang: string, wanted: boolean): NarrationManifest {
  const [narration, setNarration] = useState<{ lang: string; manifest: NarrationManifest } | null>(null);
  useEffect(() => {
    if (!wanted) return;
    const ctl = new AbortController();
    void fetchNarrationManifest(lang, ctl.signal).then((manifest) => {
      if (!ctl.signal.aborted) setNarration({ lang, manifest });
    });
    return () => ctl.abort();
  }, [lang, wanted]);
  return wanted && narration && narration.lang === lang ? narration.manifest : NARRATION_OFF;
}

// ---------------------------------------------------------------------------
// The button
// ---------------------------------------------------------------------------

/** Olive when idle, the same military look as the Estimates ADD NEW dialog; magenta while the guide runs. */
const IDLE = "border-[#5c6633] bg-[#4b5320] text-[#e4e8dc] hover:bg-[#3f4a1c]";
const LIT =
  "border-[#ff8cff] bg-[#ff00ff] text-[#1a001a] shadow-[0_0_0_2px_rgba(255,0,255,0.35),0_0_18px_2px_rgba(255,0,255,0.75)]";

/**
 * The INTERACTIVE-GUIDE button. Wide screens: in the top bar, beside the
 * full-screen button. Narrower (and phones): floating in the bottom corner,
 * above the dimming, so it takes no room from the page's own rows. Same
 * button, same state. Client only: it portals into the document.
 */
export function GuideButtons({ lit, title, onPress }: { lit: boolean; title: string; onPress: () => void }) {
  // The slot in the shell's top bar, once the top bar says it is live
  // (GUIDE_TOPBAR_SLOT_READY). The top bar sits behind a Suspense boundary: it
  // can be adopted by React after this button exists, and it can be replaced,
  // so the slot is looked up again whenever the page changes. Until there is a
  // live slot the button floats.
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let raf = 0;
    const look = () => {
      raf = 0;
      const el = document.getElementById(GUIDE_TOPBAR_SLOT_ID);
      const live = el && el.isConnected && el.hasAttribute(GUIDE_TOPBAR_SLOT_READY) ? el : null;
      setSlot((was) => (was === live ? was : live));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(look);
    };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: [GUIDE_TOPBAR_SLOT_READY] });
    return () => {
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const button = (visibility: string, floating: boolean) => (
    <button
      type="button"
      translate="no"
      data-guide-button=""
      data-float={floating ? "" : undefined}
      aria-pressed={lit}
      onClick={onPress}
      title={title}
      className={`no-print notranslate h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-xs font-bold uppercase tracking-wider transition-colors print:hidden ${lit ? LIT : IDLE} ${visibility}`}
    >
      <Compass className="h-4 w-4" aria-hidden="true" />
      <span>{GUIDE_BUTTON_LABEL}</span>
    </button>
  );

  return (
    <>
      {slot ? createPortal(button("hidden xl:inline-flex", false), slot) : null}
      {createPortal(
        button(`fixed bottom-4 right-4 z-[85] shadow-lg ${slot ? "inline-flex xl:hidden" : "inline-flex"}`, true),
        document.body,
      )}
    </>
  );
}
