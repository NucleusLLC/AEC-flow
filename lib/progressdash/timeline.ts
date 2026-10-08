/**
 * Pure arithmetic behind the /progressdash Gantt: calendar days → horizontal
 * positions, the axis ticks, the overall %, and the colour of a chip or a phase.
 * No React, no clock of its own: "today" is always passed in.
 *
 * Positions are percentages (0–100) of the Gantt lane. Day i of the axis covers
 * [i, i + 1) / totalDays, so a span starts at the left edge of its first day and a
 * single-day mark (release diamond, today line) sits in the middle of its day.
 */
import type { ChipKind, Phase, WorkedSpan } from "./data";

const DAY_MS = 86_400_000;
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" → UTC midnight of that calendar day (ms). Throws on anything else. */
export function isoToUtc(iso: string): number {
  const m = ISO.exec(iso);
  if (!m) throw new Error(`Not an ISO date: ${iso}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Whole calendar days from `a` to `b` (negative when b is earlier). */
export function daysBetween(a: string, b: string): number {
  return Math.round((isoToUtc(b) - isoToUtc(a)) / DAY_MS);
}

/** `iso` plus `n` days. */
export function addDays(iso: string, n: number): string {
  return new Date(isoToUtc(iso) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Today's calendar date in `timeZone` (the office's day, not UTC's). */
export function officeToday(now: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** "14 SEP" */
export function dayLabel(iso: string): string {
  const d = new Date(isoToUtc(iso));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "08 OCT 2026" */
export function longDate(iso: string): string {
  const d = new Date(isoToUtc(iso));
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function weekday(iso: string): string {
  return WEEKDAYS[new Date(isoToUtc(iso)).getUTCDay()];
}

/** The last day anything in the data happens on: a worked span's end or a release. */
export function lastDataDay(phases: Pick<Phase, "worked">[], releases: string[]): string | null {
  let last: string | null = null;
  const take = (iso: string) => {
    if (!last || daysBetween(last, iso) > 0) last = iso;
  };
  for (const p of phases) for (const w of p.worked) if (w.days > 0) take(addDays(w.from, w.days - 1));
  for (const r of releases) take(r);
  return last;
}

/** % of the lane kept clear before the TODAY label: two tick labels side by side, with air. */
export const TICK_GAP = 16;

export type Tick = { iso: string; x: number; label: string; sub: string; today: boolean };

export type Axis = {
  start: string;
  /** Last day on the axis (inclusive). */
  end: string;
  totalDays: number;
  /** Today's index on the axis, or null when today is before the start. */
  todayIndex: number | null;
  /** Middle of today, % of the lane — where the today line goes. Null before the start. */
  todayX: number | null;
  ticks: Tick[];
};

/**
 * The axis runs from `start` to whichever is later: today or the last day in the
 * data. So it grows by a day every day — nothing is hard-coded to a fixed length.
 * Ticks: every `step` days from the start (weekly, wider once the axis passes ten
 * weeks), plus a TODAY tick; a regular tick within TICK_GAP % of TODAY is dropped
 * so the labels never overprint.
 */
export function buildAxis(start: string, today: string, dataEnd: string | null): Axis {
  let end = start;
  for (const d of [today, dataEnd]) if (d && daysBetween(end, d) > 0) end = d;
  const totalDays = daysBetween(start, end) + 1;
  const ti = daysBetween(start, today);
  const todayIndex = ti >= 0 && ti < totalDays ? ti : null;
  const step = 7 * Math.max(1, Math.ceil(totalDays / 70));
  const todayX = todayIndex === null ? null : ((todayIndex + 0.5) / totalDays) * 100;
  const ticks: Tick[] = [];
  for (let i = 0; i < totalDays; i += step) {
    const x = (i / totalDays) * 100;
    // A label is ~7 % of the lane wide: one starting within TICK_GAP before the
    // right-aligned TODAY label (or after it, up to the line) would overprint it.
    if (todayX !== null && x > todayX - TICK_GAP && x <= todayX) continue;
    const iso = addDays(start, i);
    ticks.push({ iso, x, label: dayLabel(iso), sub: weekday(iso), today: false });
  }
  if (todayIndex !== null && todayX !== null) {
    // Anchored on the today line (middle of today): the board right-aligns this label
    // against the line, so it never runs past the lane into the NEXT column.
    ticks.push({ iso: today, x: todayX, label: dayLabel(today), sub: "TODAY", today: true });
  }
  return { start, end, totalDays, todayIndex, todayX, ticks };
}

/** A worked span as a block on the lane: left + width in %, clipped to the axis. Null if it falls outside. */
export function spanBox(axis: Axis, span: WorkedSpan): { left: number; width: number } | null {
  const a = Math.max(0, daysBetween(axis.start, span.from));
  const b = Math.min(axis.totalDays, daysBetween(axis.start, span.from) + span.days);
  if (span.days <= 0 || b <= a) return null;
  return { left: (a / axis.totalDays) * 100, width: ((b - a) / axis.totalDays) * 100 };
}

/** A one-day mark (a release diamond): the middle of that day in %, or null when off the axis. */
export function dayMark(axis: Axis, iso: string): number | null {
  const i = daysBetween(axis.start, iso);
  return i < 0 || i >= axis.totalDays ? null : ((i + 0.5) / axis.totalDays) * 100;
}

/** BUILT % in the header: the plain mean of the phase percentages, rounded. 0 with no phases. */
export function overallPct(phases: Pick<Phase, "pct">[]): number {
  if (!phases.length) return 0;
  return Math.round(phases.reduce((n, p) => n + Math.min(100, Math.max(0, p.pct)), 0) / phases.length);
}

/** Phase colour: cyan from 80 % up, amber from 50 %, red below. */
export function pctTone(pct: number): "ok" | "amber" | "red" {
  return pct >= 80 ? "ok" : pct >= 50 ? "amber" : "red";
}

/** NEXT chip style: amber solid = on you, cyan solid = in hand, dashed grey = later. */
export function chipStyle(kind: ChipKind): "you" | "go" | "plain" {
  return kind === "you" || kind === "go" ? kind : "plain";
}

/** The deployed commit, 7 characters, or "local" off Vercel. */
export function shortCommit(sha: string | undefined | null): string {
  const s = (sha ?? "").trim();
  return s ? s.slice(0, 7) : "local";
}
