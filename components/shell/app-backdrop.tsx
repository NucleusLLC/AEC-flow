"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Shuffle } from "lucide-react";
import { useT } from "@/components/i18n/language-provider";
import {
  type DashboardBackground,
  coerceBackgroundIntervalSeconds,
} from "@/lib/dashboard/backgrounds";
import {
  type BackgroundSection,
  nextBackground,
  sectionForPath,
  startBackground,
} from "@/lib/dashboard/sections";
import { cardOpacityVars } from "@/lib/dashboard/glass";
import { cn } from "@/lib/utils";

/** How long the cross-fade to the next photo takes. The hold is a preference. */
const FADE_MS = 1_000;
/** Delay before the standby layer mounts, so its fetch can't compete with LCP. */
const WARM_MS = 2_000;

type Slot = 0 | 1;

type State = {
  /** Section the URL currently asks for. Where we are heading. */
  section: BackgroundSection;
  /** Section the VISIBLE photo belongs to. Catches up when a fade completes. */
  shownSection: BackgroundSection;
  /** Server-picked index, reused as the deterministic opener of every set. */
  seed: number;
  /** The photo held by each of the two layers. */
  slots: [DashboardBackground | null, DashboardBackground | null];
  /** The layer currently on top. */
  active: Slot;
  /** Whether each layer is faded in. */
  shown: [boolean, boolean];
  /** True from an advance until the fade has finished. */
  fading: boolean;
  /** The standby layer is holding a NEW section's photo, waiting for it to load. */
  armed: boolean;
  /** Ids whose file failed to load — never shown again. */
  dead: string[];
  /** True once the first advance happened; drops the LCP priority hint. */
  moved: boolean;
  /** Every image failed: give up and let the app render plain. */
  blank: boolean;
};

type Action =
  | { type: "advance" }
  | { type: "rearm" }
  | { type: "section"; section: BackgroundSection }
  | { type: "loaded"; slot: Slot }
  | { type: "fail"; slot: Slot };

function init({ section, seed }: { section: BackgroundSection; seed: number }): State {
  const first = startBackground(section, [], seed);
  const second = first ? nextBackground(section, first.id, []) : null;
  return {
    section,
    shownSection: section,
    seed,
    slots: [first, second],
    active: 0,
    shown: [true, false],
    fading: false,
    armed: false,
    dead: [],
    moved: false,
    blank: first === null,
  };
}

/** Flip to the standby layer. Shared by the timer, Shuffle and a section swap. */
function crossFade(state: State): State {
  const other = (1 - state.active) as Slot;
  if (state.blank || state.fading || !state.slots[other]) return state;
  const shown: [boolean, boolean] = [...state.shown];
  shown[other] = true;
  return {
    ...state,
    active: other,
    shown,
    fading: true,
    moved: true,
    armed: false,
    // A swap into a freshly-armed section is the moment the visible photo stops
    // belonging to the old one.
    shownSection: state.armed ? state.section : state.shownSection,
  };
}

/**
 * Two fixed layers, never more — thirteen sections are thirteen manifests, not
 * thirteen preloads. The standby layer already holds the next photo (mounted at
 * opacity 0, so the browser has fetched it), which is what makes an advance a
 * pure opacity change rather than a src swap on a visible element — no flash,
 * no remount of the layers themselves, no layout shift. The outgoing layer
 * deliberately stays at opacity 1 underneath while the incoming one fades in
 * over it; fading both at once would wash the canvas through at the midpoint.
 *
 * Every branch that changes nothing returns `state` by identity. The section
 * effect below re-dispatches until the state settles, and a fresh object with
 * identical fields would re-render forever.
 */
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "advance":
      return crossFade(state);

    case "loaded": {
      // A section switch waits for its photo to arrive before fading, so the
      // fade is never to a half-fetched layer.
      if (!state.armed || action.slot === state.active) return state;
      return crossFade(state);
    }

    case "section": {
      const { section } = action;
      const standby = (1 - state.active) as Slot;
      const activeId = state.slots[state.active]?.id ?? null;

      if (section === state.shownSection) {
        // Already showing the right section. If a now-stale target is parked on
        // the standby layer (user went A → B → A before B loaded), put the
        // ordinary next photo back so the rotation stays inside this section.
        if (!state.armed) return state.section === section ? state : { ...state, section };
        const next = nextBackground(section, activeId, state.dead);
        const slots: [DashboardBackground | null, DashboardBackground | null] = [...state.slots];
        const shown: [boolean, boolean] = [...state.shown];
        slots[standby] = next;
        shown[standby] = false;
        return { ...state, section, armed: false, slots, shown };
      }

      // Mid-fade the standby layer is the OUTGOING photo, still at opacity 1
      // underneath. Re-pointing it now would change the picture being faded
      // away from. Record the destination; the effect re-fires when the fade
      // ends and arms it then.
      if (state.blank || state.fading) {
        return state.section === section ? state : { ...state, section };
      }

      const target = startBackground(section, state.dead, state.seed);
      if (!target || target.id === activeId) {
        return state.section === section ? state : { ...state, section };
      }
      // Already waiting on exactly this photo — re-arming would re-render for
      // nothing (the effect re-fires once after every arm).
      if (state.armed && state.section === section && state.slots[standby]?.id === target.id) {
        return state;
      }
      const slots: [DashboardBackground | null, DashboardBackground | null] = [...state.slots];
      const shown: [boolean, boolean] = [...state.shown];
      slots[standby] = target;
      shown[standby] = false;
      return { ...state, section, armed: true, slots, shown };
    }

    case "rearm": {
      const standby = (1 - state.active) as Slot;
      // The URL moved on during the fade: leave the standby layer alone, the
      // section effect is about to arm it with the real destination.
      if (state.section !== state.shownSection) return { ...state, fading: false };
      const next = nextBackground(state.shownSection, state.slots[state.active]?.id ?? null, state.dead);
      if (next === null) return { ...state, fading: false };
      const slots: [DashboardBackground | null, DashboardBackground | null] = [...state.slots];
      const shown: [boolean, boolean] = [...state.shown];
      slots[standby] = next;
      shown[standby] = false;
      return { ...state, slots, shown, fading: false };
    }

    case "fail": {
      const bad = state.slots[action.slot];
      if (!bad) return state;
      const dead = state.dead.includes(bad.id) ? state.dead : [...state.dead, bad.id];
      // Which set the replacement comes from depends on what that layer was
      // showing: the armed standby is already in the new section.
      const from =
        state.armed && action.slot !== state.active ? state.section : state.shownSection;
      // `nextBackground` falls through to the generic set once a section is
      // exhausted, so an unfilled `public/backgrounds/<section>/` folder costs
      // four 404s and then quietly shows the dashboard photos.
      const replacement = nextBackground(from, bad.id, dead);
      if (replacement === null) return { ...state, dead, blank: true };
      const slots: [DashboardBackground | null, DashboardBackground | null] = [...state.slots];
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
 * THE PHOTO FOLLOWS THE SECTION
 * -----------------------------
 * `usePathname()` resolves the section here rather than in the layout because a
 * server layout has no pathname. The hook runs during the server render of this
 * client component too, so the first paint already carries the right set and
 * there is nothing for hydration to disagree about. Navigating cross-section
 * arms the standby layer and cross-fades into it on load — the same two layers,
 * never remounted, so a click does not flash. Navigating WITHIN a section
 * touches nothing at all: the effect keys on the section, not the path, so
 * clicking through five pages of Estimates is inert.
 *
 * Rendered only when the user's `dashboardBackground` preference is on, so with
 * it off the app emits exactly the markup it always did.
 *
 * `initialIndex` is chosen on the server and hydrated from this prop — the
 * rotation, the Shuffle button and navigation are the only sources of change,
 * and none of them runs during the first render, so the two sides agree.
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
  const pathname = usePathname();
  const section = useMemo(() => sectionForPath(pathname), [pathname]);
  const [state, dispatch] = useReducer(
    reducer,
    { section, seed: initialIndex },
    init,
  );
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

  // Follow the URL. Fires on a real section change only — `section` is a
  // thirteen-value key, so page-to-page clicks inside one section produce no
  // dispatch, no arm and no timer restart. There is no queue: a user clicking
  // through five sections while a fade is in flight ends on the last one they
  // asked for, not on a backlog of five fades. Re-runs while the state settles
  // (fade ending, a stale arm being cleared); every settled path returns the
  // same state object, which is what stops it looping.
  useEffect(() => {
    if (section === state.section && section === state.shownSection) return;
    dispatch({ type: "section", section });
  }, [section, state.section, state.shownSection, state.fading, state.armed]);

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
  // Keyed on `active`, so a manual Shuffle (or a section swap, which is just as
  // much a change of picture) restarts the hold rather than racing it; the
  // cleanup covers unmount and tab-hidden.
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
            // The standby layer stays unmounted until after first paint —
            // unless it is holding a section switch, which has to load to fade.
            if (slot === 1 && !warm && !state.moved && !state.armed) return null;
            const bg = state.slots[slot];
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
                onLoad={() => dispatch({ type: "loaded", slot })}
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
              title={state.slots[state.active]?.label}
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
