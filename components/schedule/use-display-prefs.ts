"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DISPLAY_ITEMS,
  DISPLAY_PREFS_KEY,
  defaultDisplayPrefs,
  parseDisplayPrefs,
  serializeDisplayPrefs,
  type DisplayKey,
  type DisplayPrefs,
} from "@/lib/schedule/display-prefs";

/**
 * Display Control preferences, persisted in localStorage.
 *
 * PROTECTED SYSTEM (schedule) — display/chrome change, approved 2026-08-04.
 *
 * WHY localStorage: it is the convention this repo already uses for client-side
 * UI preference — `aecflow:lang` (components/i18n/language-provider.tsx), the
 * dashboard widgets' `useSharedState` (components/projects/dashboard/hooks.ts),
 * the estimate print templates. The module cookie is the other convention, but
 * a cookie exists so the *server* can render the right thing on first paint;
 * nothing on the server needs to know which tiles a user hides, so paying the
 * cookie's per-request bytes would buy nothing.
 *
 * WHY `useSyncExternalStore` rather than the read-in-an-effect shape used by the
 * older widgets: the server and the first client paint must agree (all-on) or
 * React reports a hydration mismatch, and this is the built-in way to say
 * "server snapshot differs from client snapshot" without a setState in an
 * effect. It also gives cross-tab sync for free.
 */

/** Stable identity for SSR + the hydration pass; never mutated. */
const SERVER_SNAPSHOT: DisplayPrefs = defaultDisplayPrefs();

/**
 * `getSnapshot` must return a referentially stable value or React re-renders
 * forever, so the parse is memoised against the raw string it came from. The
 * invariant is `cache.value === parseDisplayPrefs(cache.raw)`, and it holds at
 * rest because `parseDisplayPrefs(null)` is exactly the all-on default.
 */
let cache: { raw: string | null; value: DisplayPrefs } = { raw: null, value: SERVER_SNAPSHOT };

/**
 * Flipped the first time storage throws (Safari private mode, blocked
 * third-party storage, quota). From then on the choice lives in memory for the
 * session instead of snapping back on the next read.
 */
let storageAvailable = true;

function readRaw(): string | null {
  if (!storageAvailable) return cache.raw;
  try {
    return window.localStorage.getItem(DISPLAY_PREFS_KEY);
  } catch {
    storageAvailable = false;
    return cache.raw;
  }
}

function getSnapshot(): DisplayPrefs {
  const raw = readRaw();
  if (raw !== cache.raw) cache = { raw, value: parseDisplayPrefs(raw) };
  return cache.value;
}

function getServerSnapshot(): DisplayPrefs {
  return SERVER_SNAPSHOT;
}

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // The native `storage` event only fires in *other* tabs; same-tab updates go
  // through the listener set. `e.key === null` is a whole-store clear.
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === DISPLAY_PREFS_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function write(next: DisplayPrefs) {
  const raw = serializeDisplayPrefs(next);
  cache = { raw, value: next };
  try {
    window.localStorage.setItem(DISPLAY_PREFS_KEY, raw);
  } catch {
    storageAvailable = false; // keep the choice for this session; see above
  }
  listeners.forEach((fn) => fn());
}

export function useDisplayPrefs() {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback((key: DisplayKey) => {
    const current = getSnapshot();
    write({ ...current, [key]: !current[key] });
  }, []);

  const showAll = useCallback(() => {
    write(defaultDisplayPrefs());
  }, []);

  return { prefs, toggle, showAll };
}

/** How many readouts the user has hidden — drives the trigger's badge. */
export function hiddenCount(prefs: DisplayPrefs): number {
  return DISPLAY_ITEMS.reduce((n, i) => (prefs[i.key] ? n : n + 1), 0);
}
