"use client";

/**
 * INTERACTIVE-GUIDE for the Estimates editor.
 *
 * A button and, while it is lit, a self-running tour: one part of the screen
 * is outlined at a time and a callout card beside it says what it is for. The
 * card holds for five seconds, then flies to the next part.
 *
 * NARRATION. When the platform has a Fish Audio voice configured, each card is
 * also read aloud: the clip starts when the card arrives, and the card then
 * holds for max(5 s, clip + a short gap) so speech is never cut off. Pause
 * pauses both; Next, Back, stop, Esc and the end of the tour silence it at
 * once. A speaker button on the card turns sound off for this browser. With no
 * voice configured, a clip that fails, or a browser that blocks sound, the tour
 * is exactly the silent five-second tour (narration-player.ts fails quiet).
 *
 * This lives OUTSIDE components/estimates/ on purpose. Estimates is a protected
 * system; the editor only mounts <EstimateGuide /> and carries `data-guide`
 * attributes. The guide reads rectangles off the page and draws on top of it.
 * It never writes to the estimate, never focuses or scrolls sideways inside it,
 * takes no pointer events except on its own card, and stores nothing.
 *
 * Offered in the languages of GUIDE_LANGS only (Spanish and English); in any
 * other language this component renders nothing at all. The cards and the
 * clips follow the interface language: switch language and the next run of the
 * tour is in that language.
 *
 * Before an estimate is open there is no editor to tour; the Estimates landing
 * screen has its own single card (estimate-guide-picker.tsx), and this
 * component tells it when to step aside (registerEditorGuide).
 *
 * Every label below sits in its own <span>. A text node beside a conditionally
 * rendered sibling is what browser page translation breaks React on.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import {
  GUIDE_FLY_MS,
  GUIDE_STEPS,
  GUIDE_TONE_HEX,
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
} from "@/lib/estimates/interactive-guide";
import { guideContentFor } from "@/lib/estimates/interactive-guide-content";
import {
  NARRATION_GAP_MS,
  narratedHoldMs,
  readNarrationPref,
  writeNarrationPref,
  type NarrationManifest,
} from "@/lib/guide-narration/timing";
import {
  GUIDE_CSS as CSS,
  GuideButtons,
  browserStorage,
  prefersReducedMotion,
  registerEditorGuide,
  toRect,
  useNarrationManifest,
} from "./guide-chrome";
import { GuideNarrationPlayer, primeGuideAudio } from "./narration-player";

// ---------------------------------------------------------------------------
// Reading the page
// ---------------------------------------------------------------------------

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

function GuideOverlay({
  content,
  lang,
  narration,
  onClose,
}: {
  content: GuideContent;
  lang: string;
  /** What the server said about narration when the page loaded; "off" is silence. */
  narration: NarrationManifest;
  onClose: () => void;
}) {
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
  const fillRef = useRef<HTMLDivElement>(null);

  // Narration. `player` exists only when the server says the guide is narrated
  // in this language; until then, and whenever it is null, the tour is silent.
  const [player, setPlayer] = useState<GuideNarrationPlayer | null>(null);
  const [soundOn, setSoundOn] = useState(() => readNarrationPref(browserStorage()));
  // A card moves on when BOTH are true: its five seconds are up, and its clip
  // (if any) has finished. With no clip the second is true from the start.
  const holdDoneRef = useRef(false);
  const audioDoneRef = useRef(true);
  const audioStartedRef = useRef(false);
  const pausedRef = useRef(false);
  /** Did the card fly to the step on screen (so the clip waits for it to land)? */
  const arrivedFlyingRef = useRef(false);
  /** A clip that became ready while paused: started by Resume. */
  const deferredStartRef = useRef<(() => void) | null>(null);

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
      holdDoneRef.current = false;
      arrivedFlyingRef.current = true;
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

  const maybeAdvance = useCallback(() => {
    if (holdDoneRef.current && audioDoneRef.current && !pausedRef.current) go(1);
  }, [go]);

  // One player per run of the tour, and only when the tour is narrated.
  useEffect(() => {
    if (!narration.enabled) return;
    const made = new GuideNarrationPlayer(lang, narration);
    // The player owns blob URLs, so it is made and disposed with this effect.
    setPlayer(made);
    return () => {
      made.dispose();
      setPlayer(null);
    };
  }, [lang, narration]);

  // Pause holds the clip where it is; Resume continues it.
  useEffect(() => {
    pausedRef.current = paused;
    if (!player) return;
    if (paused) {
      player.pause();
      return;
    }
    const start = deferredStartRef.current;
    deferredStartRef.current = null;
    if (start) start();
    else player.resume();
  }, [paused, player]);

  // The 5 seconds. Any step change or Resume starts them again from zero.
  useEffect(() => {
    holdDoneRef.current = false;
    if (index < 0 || paused) return;
    const ms = stepDurationMs({ flies, reducedMotion: prefersReducedMotion() });
    const id = window.setTimeout(() => {
      holdDoneRef.current = true;
      // A clip that has not begun by now is not waited for: the card moves on
      // exactly as it would in silence.
      if (!audioStartedRef.current) audioDoneRef.current = true;
      maybeAdvance();
    }, ms);
    return () => window.clearTimeout(id);
  }, [index, flies, run, paused, maybeAdvance]);

  // The clip of the step on screen: starts when the card has landed, and the
  // next step's clip is fetched meanwhile so it can start on time too.
  const narrating = soundOn && player !== null && step !== undefined && player.has(step.id);
  useEffect(() => {
    const s = GUIDE_STEPS[index];
    audioStartedRef.current = false;
    if (!s || !player || !soundOn || !player.has(s.id)) {
      audioDoneRef.current = true;
      // Sound switched off after the five seconds were already up.
      maybeAdvance();
      return;
    }
    audioDoneRef.current = false;
    let cancelled = false;
    let gap = 0;
    const finish = () => {
      if (cancelled) return;
      audioDoneRef.current = true;
      maybeAdvance();
    };
    const flyMs = arrivedFlyingRef.current && !prefersReducedMotion() ? GUIDE_FLY_MS : 0;
    const arrivesAt = performance.now() + flyMs;
    const start = window.setTimeout(() => {
      void player.load(s.id).then((url) => {
        // Moved on, or given up on, while the clip was still loading.
        if (cancelled || audioDoneRef.current) return;
        if (!url) return finish();
        const begin = () => {
          if (cancelled || audioDoneRef.current) return;
          audioStartedRef.current = true;
          const late = Math.max(0, performance.now() - arrivesAt);
          void player
            .play(url, () => {
              gap = window.setTimeout(finish, NARRATION_GAP_MS);
            })
            .then((playing) => {
              if (cancelled) return;
              if (!playing) return finish();
              // The progress bar runs for as long as the card will really hold.
              const fill = fillRef.current;
              if (fill && playing.durationMs) fill.style.animationDuration = `${narratedHoldMs(playing.durationMs, late)}ms`;
            });
        };
        if (pausedRef.current) deferredStartRef.current = begin;
        else begin();
      });
    }, flyMs);

    const next = nextStepIndex(GUIDE_STEPS.length, index, 1, stepIsAvailable);
    if (next >= 0) void player.load(GUIDE_STEPS[next].id);

    return () => {
      cancelled = true;
      window.clearTimeout(start);
      window.clearTimeout(gap);
      deferredStartRef.current = null;
      player.stop();
    };
  }, [index, player, soundOn, maybeAdvance]);

  const toggleSound = () => {
    const next = !soundOn;
    writeNarrationPref(browserStorage(), next);
    setSoundOn(next);
  };

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
      data-narration={narrating ? "1" : "0"}
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
            {player ? (
              <button
                type="button"
                className="aeg-btn"
                style={{ padding: "0 6px" }}
                data-guide-sound=""
                aria-pressed={soundOn}
                onClick={toggleSound}
                aria-label={soundOn ? content.ui.mute : content.ui.unmute}
                title={soundOn ? content.ui.mute : content.ui.unmute}
              >
                <span style={{ display: "inline-flex" }} aria-hidden="true">
                  {soundOn ? <Volume2 width={14} height={14} /> : <VolumeX width={14} height={14} />}
                </span>
              </button>
            ) : null}
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
              ref={fillRef}
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

export function EstimateGuide() {
  const { lang } = useLanguage();
  const content = guideEnabledFor(lang) ? guideContentFor(lang) : null;

  // The language the guide was started in. Leaving that language stops it, and
  // coming back does not restart it: `running` is derived, never stored twice.
  const [startedIn, setStartedIn] = useState<string | null>(null);
  const running = content !== null && startedIn === lang;
  const stop = useCallback(() => setStartedIn(null), []);

  // Is the guide narrated? Asked once when the editor opens, and again when
  // the language changes.
  const offered = content !== null;
  const manifest = useNarrationManifest(lang, offered);

  // While this button is on the page the landing screen's button is not.
  // Layout effect: it steps aside in the same frame this one appears.
  useLayoutEffect(() => {
    if (!offered) return;
    return registerEditorGuide();
  }, [offered]);

  if (!content) return null;

  return (
    <>
      <GuideButtons
        lit={running}
        title={running ? content.ui.stop : content.ui.start}
        onPress={() => {
          // Inside the click, so browsers that only allow sound from a gesture let the clips play.
          if (!running) primeGuideAudio();
          setStartedIn(running ? null : lang);
        }}
      />
      {running ? createPortal(<GuideOverlay content={content} lang={lang} narration={manifest} onClose={stop} />, document.body) : null}
    </>
  );
}
