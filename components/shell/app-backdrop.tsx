"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import Image from "next/image";
import { Shuffle } from "lucide-react";
import { useT } from "@/components/i18n/language-provider";
import {
  DASHBOARD_BACKGROUNDS,
  coerceBackgroundIntervalSeconds,
  nextBackgroundIndex,
} from "@/lib/dashboard/backgrounds";
import { cardOpacityVars } from "@/lib/dashboard/glass";
import { cn } from "@/lib/utils";

/** How long the cross-fade to the next photo takes. The hold is a preference. */
const FADE_MS = 1_000;
/** Delay before the standby layer mounts, so its fetch can't compete with LCP. */
const WARM_MS = 2_000;

type Slot = 0 | 1;

type State = {
  /** Manifest index held by each of the two layers. */
  slots: [number, number];
  /** The layer currently on top. */
  active: Slot;
  /** Whether each layer is faded in. */
  shown: [boolean, boolean];
  /** True from an advance until the fade has finished. */
  fading: boolean;
  /** Manifest indices whose file failed to load — never shown again. */
  dead: number[];
  /** True once the first advance happened; drops the LCP priority hint. */
  moved: boolean;
  /** Every image failed: give up and let the dashboard render plain. */
  blank: boolean;
};

type Action = { type: "advance" } | { type: "rearm" } | { type: "fail"; slot: Slot };

function init(initialIndex: number): State {
  return {
    slots: [initialIndex, nextBackgroundIndex(initialIndex) ?? initialIndex],
    active: 0,
    shown: [true, false],
    fading: false,
    dead: [],
    moved: false,
    blank: false,
  };
}

/**
 * Two fixed layers, never more. The standby layer already holds the next photo
 * (mounted at opacity 0, so the browser has fetched it), which is what makes an
 * advance a pure opacity change rather than a src swap on a visible element —
 * no flash, no remount, no layout shift. The outgoing layer deliberately stays
 * at opacity 1 underneath while the incoming one fades in over it; fading both
 * at once would wash the canvas through at the midpoint.
 */
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "advance": {
      if (state.blank || state.fading) return state;
      const other = (1 - state.active) as Slot;
      const shown: [boolean, boolean] = [...state.shown];
      shown[other] = true;
      return { ...state, active: other, shown, fading: true, moved: true };
    }
    case "rearm": {
      const standby = (1 - state.active) as Slot;
      const next = nextBackgroundIndex(state.slots[state.active], state.dead);
      if (next === null) return { ...state, fading: false };
      const slots: [number, number] = [...state.slots];
      const shown: [boolean, boolean] = [...state.shown];
      slots[standby] = next;
      shown[standby] = false;
      return { ...state, slots, shown, fading: false };
    }
    case "fail": {
      const bad = state.slots[action.slot];
      const dead = state.dead.includes(bad) ? state.dead : [...state.dead, bad];
      const replacement = nextBackgroundIndex(bad, dead);
      if (replacement === null) return { ...state, dead, blank: true };
      const slots: [number, number] = [...state.slots];
      slots[action.slot] = replacement;
      return { ...state, slots, dead };
    }
  }
}

/**
 * Full-bleed photo behind EVERY view in the app shell, with cards turned to
 * glass over it (the styling hangs off `[data-dashboard-bg="on"]` in globals.css).
 *
 * It began on the dashboard alone, which turned out to be almost nobody's
 * screen: a user whose active module is 1, 2 or 3 lands on `/modules/<key>` and
 * the sidebar offers no route to `/dashboard` at all, so the feature was
 * invisible to them. It now wraps the shell's content area. The attribute and
 * the preference keys keep their original `dashboard*` names deliberately —
 * renaming them would orphan the values already saved in users' preference blobs.
 *
 * Rendered only when the user's `dashboardBackground` preference is on, so with
 * it off the app emits exactly the markup it always did.
 *
 * `initialIndex` is chosen on the server and hydrated from this prop — the
 * rotation and the Shuffle button are the only sources of change, and both run
 * after mount, so there is nothing here for the server and client to disagree
 * about.
 */
export function AppBackdrop({
  initialIndex,
  intervalSeconds,
  cardOpacityPercent,
  children,
}: {
  initialIndex: number;
  intervalSeconds: number;
  /** Dark-theme card opacity %; the light value is derived. See lib/dashboard/glass.ts. */
  cardOpacityPercent: number;
  children: React.ReactNode;
}) {
  const t = useT();
  const [state, dispatch] = useReducer(reducer, initialIndex, init);
  const [warm, setWarm] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setWarm(true), WARM_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // A photo rotating in a tab nobody is looking at is pure battery burn.
  useEffect(() => {
    const sync = () => setPaused(document.visibilityState === "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  // When the visible photo last changed. Declared before the timer effect so it
  // is already up to date when that one re-runs.
  const shownSince = useRef(0);
  useEffect(() => {
    shownSince.current = Date.now();
  }, [state.active]);

  // Auto-advance. A single setTimeout that re-reads the clock, not an interval:
  // at 30 minutes a timer that keeps running through a hidden tab or a laptop
  // sleep either drifts or wakes up owing a burst of ticks. Because the delay is
  // recomputed from `shownSince` every time this effect re-runs — including when
  // the tab comes back — a sleep longer than the hold costs exactly one advance.
  // Keyed on `active`, so a manual Shuffle restarts the hold rather than racing
  // it; the cleanup covers unmount and tab-hidden.
  useEffect(() => {
    if (reduced || paused || state.blank) return;
    const holdMs = coerceBackgroundIntervalSeconds(intervalSeconds) * 1000;
    const remaining = Math.min(holdMs, Math.max(0, shownSince.current + holdMs - Date.now()));
    const id = setTimeout(() => dispatch({ type: "advance" }), remaining);
    return () => clearTimeout(id);
  }, [reduced, paused, state.blank, state.active, intervalSeconds]);

  // Once the fade is over, re-point the now-hidden layer at the next photo so
  // it is warm before its turn. Reduced motion has no fade, so no wait.
  useEffect(() => {
    if (!state.fading) return;
    const id = setTimeout(() => dispatch({ type: "rearm" }), reduced ? 0 : FADE_MS);
    return () => clearTimeout(id);
  }, [state.fading, state.active, reduced]);

  const on = !state.blank;

  return (
    <>
      {on ? (
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden">
          {([0, 1] as const).map((slot) => {
            // The standby layer stays unmounted until after first paint.
            if (slot === 1 && !warm && !state.moved) return null;
            const bg = DASHBOARD_BACKGROUNDS[state.slots[slot]];
            if (!bg) return null;
            return (
              <Image
                // Keyed on the photo: re-pointing a hidden layer remounts it at
                // opacity 0 instead of swapping the src of a live element.
                key={`${slot}:${bg.id}`}
                src={bg.src}
                alt=""
                fill
                sizes="100vw"
                priority={slot === 0 && !state.moved}
                onError={() => dispatch({ type: "fail", slot })}
                className={cn(
                  // `dashboard-bg-photo` carries the per-theme tone compression
                  // that makes a set spanning near-black to near-white legible.
                  "dashboard-bg-photo object-cover transition-opacity ease-out motion-reduce:transition-none",
                  state.shown[slot] ? "opacity-100" : "opacity-0",
                )}
                style={{ zIndex: state.active === slot ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
              />
            );
          })}
          <div className="dashboard-bg-scrim absolute inset-0 z-[2]" />
        </div>
      ) : null}

      {/* The two ends of the user's transparency preference ride on the wrapper
        * as custom properties; globals.css picks one of them into
        * `--glass-surface` per theme. It has to be done in two properties
        * rather than one: the theme is a `.dark` class decided in the browser,
        * this value is rendered on the server, and a single number written here
        * would apply to both themes — collapsing the 50/42 split the glass
        * depends on. Emitted only while the backdrop is live, so with the
        * preference off there is no wrapper and no style attribute at all. */}
      <div
        data-dashboard-bg={on ? "on" : undefined}
        style={on ? (cardOpacityVars(cardOpacityPercent) as React.CSSProperties) : undefined}
      >
        {on ? (
          <div className="mb-4 flex justify-end print:hidden">
            <button
              type="button"
              // Not `disabled` during the fade: disabling a focused button blurs
              // it, so a keyboard user would lose their place for a second. The
              // reducer already ignores an advance while one is in flight.
              onClick={() => dispatch({ type: "advance" })}
              title={DASHBOARD_BACKGROUNDS[state.slots[state.active]]?.label}
              // `dashboard-bg-chip` pulls the same glass knobs as the cards, so
              // the two never drift apart when the values are tuned.
              className="dashboard-bg-chip inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium text-muted transition-colors hover:text-fg"
            >
              <Shuffle className="h-3.5 w-3.5" />
              {t("Shuffle background")}
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </>
  );
}
