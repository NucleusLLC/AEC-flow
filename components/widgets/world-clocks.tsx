"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, Plus, X } from "lucide-react";

const KEY = "aecflow:worldclocks";

type City = { label: string; tz: string };

// A small curated set covering the regions AEC-flow targets (incl. Aruba/Caribbean).
const PRESETS: City[] = [
  { label: "Oranjestad", tz: "America/Aruba" },
  { label: "Curaçao", tz: "America/Curacao" },
  { label: "Bonaire", tz: "America/Kralendijk" },
  { label: "Bogotá", tz: "America/Bogota" },
  { label: "New York", tz: "America/New_York" },
  { label: "Los Angeles", tz: "America/Los_Angeles" },
  { label: "São Paulo", tz: "America/Sao_Paulo" },
  { label: "London", tz: "Europe/London" },
  { label: "Amsterdam", tz: "Europe/Amsterdam" },
  { label: "Dubai", tz: "Asia/Dubai" },
  { label: "Mumbai", tz: "Asia/Kolkata" },
  { label: "Singapore", tz: "Asia/Singapore" },
  { label: "Tokyo", tz: "Asia/Tokyo" },
  { label: "Sydney", tz: "Australia/Sydney" },
];

const DEFAULTS: City[] = [PRESETS[0], PRESETS[4], PRESETS[8], PRESETS[9]];

function timeIn(tz: string, now: number): { time: string; day: string } {
  try {
    const time = new Intl.DateTimeFormat([], { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
    const day = new Intl.DateTimeFormat([], { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(now);
    return { time, day };
  } catch {
    return { time: "—", day: "" };
  }
}

/** World clocks — live time across chosen cities; add/remove from a preset list. */
export function WorldClocks() {
  const [now, setNow] = useState(() => Date.now());
  const [cities, setCities] = useState<City[]>(DEFAULTS);
  const [adding, setAdding] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const arr = JSON.parse(raw) as City[];
        // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe hydrate after mount
        if (Array.isArray(arr)) setCities(arr);
      }
    } catch {
      /* ignore */
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(cities));
    } catch {
      /* ignore */
    }
  }, [cities]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remove = (tz: string) => setCities((c) => c.filter((x) => x.tz !== tz));
  const add = (city: City) => {
    setCities((c) => (c.some((x) => x.tz === city.tz) ? c : [...c, city]));
    setAdding(false);
  };

  const available = PRESETS.filter((p) => !cities.some((c) => c.tz === p.tz));

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-fg">
          <Globe className="h-4 w-4 text-brand" /> World Clocks
        </div>
        {available.length > 0 ? (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-muted hover:bg-surface-2 hover:text-fg"
          >
            <Plus className="h-3 w-3" /> Add city
          </button>
        ) : null}
      </div>

      {adding ? (
        <div className="mb-3 flex flex-wrap gap-1.5 rounded-lg border border-border bg-surface-2/40 p-2">
          {available.map((c) => (
            <button
              key={c.tz}
              type="button"
              onClick={() => add(c)}
              className="rounded-md bg-surface px-2 py-1 text-[11px] text-fg ring-1 ring-border hover:bg-brand/10 hover:text-brand"
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : null}

      <ul className="divide-y divide-border">
        {cities.map((c) => {
          const { time, day } = timeIn(c.tz, now);
          return (
            <li key={c.tz} className="group flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-medium text-fg">{c.label}</div>
                <div className="text-[11px] text-faint">{day}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-semibold tabular-nums text-fg">{time}</span>
                <button
                  type="button"
                  onClick={() => remove(c.tz)}
                  className="rounded p-0.5 text-faint opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                  aria-label={`Remove ${c.label}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          );
        })}
        {cities.length === 0 ? <li className="py-4 text-center text-xs text-muted">Add a city to start.</li> : null}
      </ul>
    </div>
  );
}
