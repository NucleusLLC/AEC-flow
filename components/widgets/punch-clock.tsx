"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Play, Square, Trash2 } from "lucide-react";

type Session = { start: number; end: number };
const KEY = "aecflow:punchclock";

function fmtClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${ss}`;
}
function fmtTime(t: number): string {
  return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function isSameDay(a: number, b: number): boolean {
  const d1 = new Date(a), d2 = new Date(b);
  return d1.toDateString() === d2.toDateString();
}

/** Punch clock — live clock plus a clock-in/out timer with a session log (today). */
export function PunchClock() {
  const [now, setNow] = useState(() => Date.now());
  const [clockedInAt, setClockedInAt] = useState<number | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const loaded = useRef(false);

  // Load persisted state after mount (avoids SSR/localStorage hydration mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw) as { clockedInAt: number | null; sessions: Session[] };
        setClockedInAt(data.clockedInAt ?? null);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe hydrate after mount
        setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      }
    } catch {
      /* ignore */
    }
    loaded.current = true;
  }, []);

  // Persist on change (after the initial load).
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ clockedInAt, sessions }));
    } catch {
      /* ignore */
    }
  }, [clockedInAt, sessions]);

  // Tick once a second.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const punchIn = () => setClockedInAt(Date.now());
  const punchOut = () => {
    if (clockedInAt) setSessions((s) => [{ start: clockedInAt, end: Date.now() }, ...s]);
    setClockedInAt(null);
  };
  const clearLog = () => setSessions([]);

  const todays = sessions.filter((s) => isSameDay(s.start, now));
  const loggedToday = todays.reduce((acc, s) => acc + (s.end - s.start), 0);
  const liveTotal = loggedToday + (clockedInAt ? now - clockedInAt : 0);

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
        <Clock className="h-4 w-4 text-brand" /> Punch Clock
      </div>

      <div className="text-center">
        <div className="font-mono text-3xl font-bold tabular-nums text-fg">
          {new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </div>
        <div className="mt-0.5 text-xs text-muted">
          {new Date(now).toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        {clockedInAt ? (
          <button
            type="button"
            onClick={punchOut}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
          >
            <Square className="h-4 w-4" /> Clock out
          </button>
        ) : (
          <button
            type="button"
            onClick={punchIn}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            <Play className="h-4 w-4" /> Clock in
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-lg border border-border bg-surface-2/40 py-2">
          <div className="text-[10px] uppercase tracking-wide text-faint">Current session</div>
          <div className="font-mono text-lg font-semibold tabular-nums text-fg">
            {clockedInAt ? fmtClock(now - clockedInAt) : "00:00:00"}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface-2/40 py-2">
          <div className="text-[10px] uppercase tracking-wide text-faint">Today total</div>
          <div className="font-mono text-lg font-semibold tabular-nums text-fg">{fmtClock(liveTotal)}</div>
        </div>
      </div>

      {todays.length > 0 ? (
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide text-faint">Today&apos;s sessions</span>
            <button type="button" onClick={clearLog} className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-red-600">
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          </div>
          <ul className="space-y-1">
            {todays.map((s, i) => (
              <li key={i} className="flex items-center justify-between rounded-md bg-surface-2/40 px-2 py-1 text-xs text-muted">
                <span>{fmtTime(s.start)} → {fmtTime(s.end)}</span>
                <span className="font-mono tabular-nums text-fg">{fmtClock(s.end - s.start)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
