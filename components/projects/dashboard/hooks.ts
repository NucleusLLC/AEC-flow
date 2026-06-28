"use client";

import { useCallback, useEffect, useState } from "react";

/* Same-tab pub/sub so every widget bound to a key (e.g. the Tasks and Agenda
 * widgets sharing the project task list) stays in sync without a reload. The
 * native `storage` event only fires across tabs, so we add our own bus. */
const subscribers = new Map<string, Set<() => void>>();
function subscribe(key: string, fn: () => void) {
  let set = subscribers.get(key);
  if (!set) {
    set = new Set();
    subscribers.set(key, set);
  }
  set.add(fn);
  return () => set!.delete(fn);
}
function notify(key: string) {
  subscribers.get(key)?.forEach((fn) => fn());
}

/**
 * State backed by localStorage and shared across all hooks using the same key.
 * SSR-safe: renders `initial` on the server and first client paint, then
 * hydrates from storage after mount. `loaded` flips true once storage is read.
 */
export function useSharedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const read = () => {
      try {
        const raw = window.localStorage.getItem(key);
        setValue(raw != null ? (JSON.parse(raw) as T) : initial);
      } catch {
        /* ignore malformed storage */
      }
    };
    read();
    setLoaded(true);
    const unsub = subscribe(key, read);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) read();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(v));
        } catch {
          /* ignore quota errors */
        }
        notify(key);
        return v;
      });
    },
    [key],
  );

  return [value, set, loaded] as const;
}

/** A ticking clock. Returns null until mounted (avoids SSR time mismatch). */
export function useNow(intervalMs = 1000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const raf = requestAnimationFrame(tick);
    const t = setInterval(tick, intervalMs);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(t);
    };
  }, [intervalMs]);
  return now;
}

/** Short, stable client-side id for new list items. */
export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}
