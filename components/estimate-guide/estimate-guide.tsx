"use client";

/**
 * INTERACTIVE-GUIDE for the Estimates editor.
 *
 * A button and, while it is lit, a self-running tour: one part of the screen
 * is outlined at a time and a callout card beside it says what it is for. The
 * card holds for five seconds, then flies to the next part.
 *
 * This lives OUTSIDE components/estimates/ on purpose. Estimates is a protected
 * system; the editor only mounts <EstimateGuide /> and carries `data-guide`
 * attributes. The guide reads rectangles off the page and draws on top of it.
 * It never writes to the estimate, never focuses or scrolls sideways inside it,
 * takes no pointer events except on its own card, and stores nothing.
 *
 * Offered in the languages of GUIDE_LANGS only (Spanish, for now); in any other
 * language this component renders nothing at all.
 *
 * Every label below sits in its own <span>. A text node beside a conditionally
 * rendered sibling is what browser page translation breaks React on.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Compass, Pause, Play, X } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import {
  GUIDE_BUTTON_LABEL,
  GUIDE_FLY_MS,
  GUIDE_HOLD_MS,
  GUIDE_STEPS,
  GUIDE_TONE_HEX,
  GUIDE_TOPBAR_SLOT_ID,
  availableIndices,
  clampRect,
  guideEnabledFor,
  horizontalOverlap,
  nextStepIndex,
  placeCard,
  scrollDeltaToReveal,
  stepDurationMs,
  stepPosition,
  unionRect,
  type GuideContent,
  type GuideStep,
  type Rect,
} from "@/lib/estimates/interactive-guide";
import { guideContentFor } from "@/lib/estimates/interactive-guide-content";

// ---------------------------------------------------------------------------
// Reading the page
// ---------------------------------------------------------------------------

const toRect = (r: DOMRect): Rect => ({ left: r.left, top: r.top, width: r.width, height: r.height });

/**
 * Is this element really on the page? Rendered, with a size, not `visibility:
 * hidden`, and not squeezed out sideways by a clipping parent (the collapsed
 * sidebar is zero wide but its children still report a size). Being scrolled
 * out of view does NOT count against it: the guide scrolls to it.
 */
function isOnPage(el: Element): boolean {
  if (el.getClientRects().length === 0) return false;
  const rect = toRect(el.getBoundingClientRect());
  if (rect.width < 1 || rect.height < 1) return false;
  if (getComputedStyle(el).visibility === "hidden") return false;
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    if (getComputedStyle(p).overflowX === "visible") continue;
    if (horizontalOverlap(rect, toRect(p.getBoundingClientRect())) < 1) return false;
  }
  return true;
}

/** The elements a step lights up: empty when its target is not on the page. */
function stepElements(step: GuideStep): Element[] {
  const found: Element[] = [];
  for (const name of step.targets) {
    const el = Array.from(document.querySelectorAll(`[data-guide="${name}"]`)).find(isOnPage);
    if (!el) continue;
    found.push(el);
    if (step.match === "first") break;
  }
  return found;
}

const stepIsAvailable = (index: number) => stepElements(GUIDE_STEPS[index]).length > 0;

/** Scroll the nearest vertical scroller (never sideways) so the target shows. */
function reveal(el: Element, smooth: boolean) {
  const behavior: ScrollBehavior = smooth ? "smooth" : "auto";
  const r = el.getBoundingClientRect();
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy !== "auto" && oy !== "scroll") || p.scrollHeight <= p.clientHeight + 1) continue;
    const pr = p.getBoundingClientRect();
    const dy = scrollDeltaToReveal(r.top, r.bottom, Math.max(pr.top, 0), Math.min(pr.bottom, window.innerHeight), 24);
    if (dy !== 0) p.scrollBy({ top: dy, behavior });
    return;
  }
  const dy = scrollDeltaToReveal(r.top, r.bottom, 0, window.innerHeight, 24);
  if (dy !== 0) window.scrollBy({ top: dy, behavior });
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

// ---------------------------------------------------------------------------
// Styles. One static block, mounted with the overlay and gone with it.
// ---------------------------------------------------------------------------

const FLY = `${GUIDE_FLY_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;

const CSS = `
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
// The tour
// ---------------------------------------------------------------------------

type Cursor = {
  /** Index into GUIDE_STEPS; -1 when the page has nothing to show. */
  index: number;
  /** Did the card fly here from another step (false for the first one)? */
  flies: boolean;
  /** Bumped to restart the 5 seconds without changing step (Resume). */
  run: number;
};

function GuideOverlay({ content, lang, onClose }: { content: GuideContent; lang: string; onClose: () => void }) {
  const [cursor, setCursor] = useState<Cursor>(() => ({
    index: nextStepIndex(GUIDE_STEPS.length, -1, 1, stepIsAvailable),
    flies: false,
    run: 0,
  }));
  const [paused, setPaused] = useState(false);
  // "3 / 17": counted when the step changes, among the steps on the page then.
  const [position, setPosition] = useState(() =>
    stepPosition(availableIndices(GUIDE_STEPS.length, stepIsAvailable), cursor.index),
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const tailRef = useRef<HTMLSpanElement>(null);

  const { index, flies, run } = cursor;
  const step: GuideStep | undefined = GUIDE_STEPS[index];

  // The step on screen, for the handlers below (timer, buttons, the frame loop).
  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const go = useCallback(
    (dir: 1 | -1) => {
      const next = nextStepIndex(GUIDE_STEPS.length, indexRef.current, dir, stepIsAvailable);
      if (next < 0) {
        // Past the last step the tour is over; before the first there is nowhere to go.
        if (dir === 1) onClose();
        return;
      }
      indexRef.current = next;
      setPosition(stepPosition(availableIndices(GUIDE_STEPS.length, stepIsAvailable), next));
      setCursor((c) => ({ index: next, flies: true, run: c.run + 1 }));
    },
    [onClose],
  );

  // Pause stops the clock; Resume gives the step a fresh 5 seconds (the card is
  // already there, so no flight time is added).
  const togglePause = useCallback(() => {
    setPaused((v) => !v);
    setCursor((c) => ({ index: c.index, flies: false, run: c.run + 1 }));
  }, []);

  // A page with nothing to point at: end at once rather than show an empty card.
  useEffect(() => {
    if (index < 0) onClose();
  }, [index, onClose]);

  // The 5 seconds. Any step change or Resume starts them again from zero.
  useEffect(() => {
    if (index < 0 || paused) return;
    const ms = stepDurationMs({ flies, reducedMotion: prefersReducedMotion() });
    const id = window.setTimeout(() => go(1), ms);
    return () => window.clearTimeout(id);
  }, [index, flies, run, paused, go]);

  // Esc stops the tour.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Follow the target. Positions are written straight to the two elements each
  // frame (no React render), so the outline stays glued to its target while the
  // page scrolls or reflows; the fly is a CSS transition switched on only for
  // the half second after a step change.
  useEffect(() => {
    const s = GUIDE_STEPS[index];
    const root = rootRef.current;
    const ring = ringRef.current;
    const card = cardRef.current;
    const tail = tailRef.current;
    if (!s || !root || !ring || !card || !tail) return;

    const reduced = prefersReducedMotion();
    const first = stepElements(s)[0];
    if (first) reveal(first, false);

    root.dataset.fly = flies && !reduced ? "1" : "0";
    const flyOff = window.setTimeout(() => {
      root.dataset.fly = "0";
    }, GUIDE_FLY_MS + 40);

    let raf = 0;
    let missing = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const target = unionRect(stepElements(s).map((el) => toRect(el.getBoundingClientRect())));
      if (!target) {
        // The target left the page under us (Client view switched on, a section
        // deleted). Give it a moment, then move on rather than point at nothing.
        if (++missing === 20) go(1);
        return;
      }
      missing = 0;
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const lit = clampRect(
        { left: target.left - 4, top: target.top - 4, width: target.width + 8, height: target.height + 8 },
        viewport,
        3,
      );
      ring.style.left = `${lit.left}px`;
      ring.style.top = `${lit.top}px`;
      ring.style.width = `${lit.width}px`;
      ring.style.height = `${lit.height}px`;

      // On narrower screens the button floats in the bottom corner; keep the
      // card clear of it so its controls are never underneath.
      const floating = document.querySelector("[data-guide-button][data-float]");
      const reserved =
        floating && floating.getClientRects().length > 0
          ? Math.max(0, viewport.height - floating.getBoundingClientRect().top)
          : 0;
      const at = placeCard({
        target: lit,
        card: { width: card.offsetWidth, height: card.offsetHeight },
        viewport: { width: viewport.width, height: viewport.height - reserved },
      });
      card.style.transform = `translate3d(${Math.round(at.x)}px, ${Math.round(at.y)}px, 0)`;
      card.dataset.side = at.side;
      const along = `${Math.round(at.arrow - 7)}px`;
      const vertical = at.side === "bottom" || at.side === "top";
      tail.style.left = vertical ? along : "";
      tail.style.top = vertical ? "" : along;
      root.dataset.ready = "1";
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(flyOff);
    };
  }, [index, flies, go]);

  if (!step) return null;
  const text = content.steps[step.id];
  const fly = flies && !prefersReducedMotion() ? GUIDE_FLY_MS : 0;

  return (
    <div
      ref={rootRef}
      className="aeg-root"
      data-guide-overlay=""
      data-step={step.id}
      data-step-number={step.number}
      data-paused={paused ? "1" : "0"}
      style={{ ["--aeg" as string]: GUIDE_TONE_HEX[step.tone] }}
    >
      <style>{CSS}</style>
      <div ref={ringRef} className="aeg-ring" aria-hidden="true" />
      <div ref={cardRef} className="aeg-card" role="region" aria-label={content.ui.label} lang={lang}>
        <span ref={tailRef} className="aeg-tail" aria-hidden="true" />
        <div style={{ padding: "12px 14px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="aeg-badge" data-guide-number="">
              {step.number}
            </span>
            <span className="aeg-title" data-guide-title="" style={{ flex: 1, minWidth: 0 }}>
              {text.title}
            </span>
            <button type="button" className="aeg-btn" style={{ padding: "0 6px" }} onClick={onClose} aria-label={content.ui.close} title={content.ui.close}>
              <X width={14} height={14} aria-hidden="true" />
            </button>
          </div>

          <div aria-live="polite" style={{ marginTop: 6 }}>
            <p data-guide-body="" style={{ margin: 0 }}>
              <span>{text.body}</span>
            </p>
            {text.points ? (
              <ul style={{ margin: "4px 0 0", paddingLeft: 16, listStyle: "disc" }}>
                {text.points.map((p) => (
                  <li key={p.term}>
                    <b>
                      <span>{p.term}</span>
                    </b>
                    <span>: </span>
                    <span>{p.text}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="aeg-track" style={{ marginTop: 10 }} aria-hidden="true">
            <div
              key={`${index}:${run}:${paused ? "p" : "r"}`}
              className="aeg-fill"
              data-run={paused ? "0" : "1"}
              style={{ animationDelay: `${fly}ms` }}
            />
          </div>

          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <button type="button" className="aeg-btn" data-guide-back="" onClick={() => go(-1)} disabled={position.n <= 1}>
              <ChevronLeft width={14} height={14} aria-hidden="true" />
              <span>{content.ui.back}</span>
            </button>
            <button type="button" className="aeg-btn" data-guide-pause="" aria-pressed={paused} onClick={togglePause}>
              <span style={{ display: "inline-flex" }} aria-hidden="true">
                {paused ? <Play width={13} height={13} /> : <Pause width={13} height={13} />}
              </span>
              <span>{paused ? content.ui.resume : content.ui.pause}</span>
            </button>
            <button type="button" className="aeg-btn" data-guide-next="" onClick={() => go(1)}>
              <span>{content.ui.next}</span>
              <ChevronRight width={14} height={14} aria-hidden="true" />
            </button>
            <span
              data-guide-count=""
              style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#475569", whiteSpace: "nowrap" }}
            >
              {`${position.n} / ${position.total}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The button
// ---------------------------------------------------------------------------

/** Olive when idle, the same military look as the Estimates ADD NEW dialog; magenta while the guide runs. */
const IDLE =
  "border-[#5c6633] bg-[#4b5320] text-[#e4e8dc] hover:bg-[#3f4a1c]";
const LIT =
  "border-[#ff8cff] bg-[#ff00ff] text-[#1a001a] shadow-[0_0_0_2px_rgba(255,0,255,0.35),0_0_18px_2px_rgba(255,0,255,0.75)]";

export function EstimateGuide() {
  const { lang } = useLanguage();
  const content = guideEnabledFor(lang) ? guideContentFor(lang) : null;

  // The language the guide was started in. Leaving that language stops it, and
  // coming back does not restart it: `running` is derived, never stored twice.
  const [startedIn, setStartedIn] = useState<string | null>(null);
  const running = content !== null && startedIn === lang;
  const stop = useCallback(() => setStartedIn(null), []);

  // The slot in the shell's top bar, beside the full-screen button. The top bar
  // sits behind a Suspense boundary, so it can arrive a few frames after us.
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let raf = 0;
    let tries = 0;
    const look = () => {
      const el = document.getElementById(GUIDE_TOPBAR_SLOT_ID);
      if (el) setSlot(el);
      else if (++tries < 120) raf = requestAnimationFrame(look);
    };
    raf = requestAnimationFrame(look);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!content) return null;

  const button = (visibility: string, floating: boolean) => (
    <button
      type="button"
      translate="no"
      data-guide-button=""
      data-float={floating ? "" : undefined}
      aria-pressed={running}
      onClick={() => setStartedIn(running ? null : lang)}
      title={running ? content.ui.stop : content.ui.start}
      className={`no-print notranslate h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-xs font-bold uppercase tracking-wider transition-colors print:hidden ${running ? LIT : IDLE} ${visibility}`}
    >
      <Compass className="h-4 w-4" aria-hidden="true" />
      <span>{GUIDE_BUTTON_LABEL}</span>
    </button>
  );

  return (
    <>
      {/* Wide screens: in the top bar, beside the full-screen button. Narrower
          (and phones): floating in the bottom corner, above the dimming, so it
          takes no room from the editor's own rows. Same button, same state. */}
      {slot ? createPortal(button("hidden xl:inline-flex", false), slot) : null}
      {createPortal(
        button(`fixed bottom-4 right-4 z-[85] shadow-lg ${slot ? "inline-flex xl:hidden" : "inline-flex"}`, true),
        document.body,
      )}
      {running ? createPortal(<GuideOverlay content={content} lang={lang} onClose={stop} />, document.body) : null}
    </>
  );
}
