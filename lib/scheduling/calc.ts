/**
 * Scheduling arithmetic. PURE — no Prisma, no React, no I/O.
 *
 * WALL-CLOCK AS UTC. A visit booked for 09:00 is stored as 09:00Z, so every
 * function here reads and writes times with UTC accessors only, and "now" is
 * first turned into the office's wall clock expressed the same way
 * (`wallClockNow`). Mixing a real UTC instant with a wall-clock-as-UTC one is
 * the bug this module exists to prevent: in Aruba (UTC−4) a nine o'clock
 * visit would otherwise count as "past" from five in the morning.
 */
import type {
  AppointmentStatus,
  AppointmentType,
} from "./types";
import { APPOINTMENT_TYPES } from "./types";

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** The minimum an appointment needs for the arithmetic below. */
export type Timed = {
  type: AppointmentType;
  status: AppointmentStatus;
  startsAt: string | Date;
  endsAt: string | Date;
  actualHours?: number | null;
};

function ms(v: string | Date): number {
  return typeof v === "string" ? Date.parse(v) : v.getTime();
}

/** Two decimals, never negative, never NaN. */
export function roundHours(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
}

/** `YYYY-MM-DD` + `HH:MM` as the stored instant (09:00 → 09:00Z). Null when invalid. */
export function toWallClockUtc(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !/^\d{2}:\d{2}$/.test(time ?? "")) return null;
  const [h, m] = time.split(":").map(Number);
  if (h > 23 || m > 59) return null;
  const d = new Date(`${date}T${time}:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  // Reject a date the calendar does not have (2026-02-31 rolls over in JS).
  if (d.toISOString().slice(0, 10) !== date) return null;
  return d;
}

/** The form's fields back out of a stored instant. */
export function splitWallClock(v: string | Date): { date: string; time: string } {
  const iso = new Date(ms(v)).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** `HH:MM`, 24-hour, of a stored instant. */
export function hhmm(v: string | Date): string {
  return splitWallClock(v).time;
}

/**
 * The office's wall clock now, expressed as a UTC instant — the same frame the
 * stored times are in. `timeZone` is an IANA name ("America/Aruba").
 */
export function wallClockNow(now: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return new Date(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}.000Z`,
  );
}

/** Hours between start and end — what was booked. */
export function plannedHours(startsAt: string | Date, endsAt: string | Date): number {
  return roundHours((ms(endsAt) - ms(startsAt)) / HOUR_MS);
}

/**
 * The hours a visit counts for: what was entered on completion, or what was
 * booked when nobody entered a figure. Only a COMPLETED visit counts — a
 * scheduled one has not happened and a cancelled one never will.
 */
export function effectiveHours(a: Timed): number {
  if (a.status !== "COMPLETED") return 0;
  const actual = a.actualHours;
  return actual !== null && actual !== undefined && Number.isFinite(actual)
    ? roundHours(actual)
    : plannedHours(a.startsAt, a.endsAt);
}

/** Still to happen (or to be closed off): scheduled or postponed. */
export function isOpen(status: AppointmentStatus): boolean {
  return status === "SCHEDULED" || status === "POSTPONED";
}

/**
 * Upcoming = open and not yet over; past = everything else. Upcoming soonest
 * first, past most recent first. An open visit whose end has gone by is PAST —
 * it is the one waiting for someone to record how it went.
 */
export function splitUpcoming<T extends Timed>(list: T[], now: Date): { upcoming: T[]; past: T[] } {
  const t = now.getTime();
  const upcoming = list.filter((a) => isOpen(a.status) && ms(a.endsAt) >= t);
  const past = list.filter((a) => !(isOpen(a.status) && ms(a.endsAt) >= t));
  upcoming.sort((a, b) => ms(a.startsAt) - ms(b.startsAt));
  past.sort((a, b) => ms(b.startsAt) - ms(a.startsAt));
  return { upcoming, past };
}

/** Open and already over: the visit happened (or not) and nobody said. */
export function awaitingCompletion(a: Timed, now: Date): boolean {
  return isOpen(a.status) && ms(a.endsAt) < now.getTime();
}

/** Group by calendar day (`YYYY-MM-DD`), keeping the incoming order. */
export function groupByDay<T extends Timed>(list: T[]): { date: string; items: T[] }[] {
  const out: { date: string; items: T[] }[] = [];
  for (const a of list) {
    const date = splitWallClock(a.startsAt).date;
    const last = out[out.length - 1];
    if (last && last.date === date) last.items.push(a);
    else out.push({ date, items: [a] });
  }
  return out;
}

export type TypeSummary = { type: AppointmentType; count: number; hours: number };

export type FieldSummary = {
  /** Completed visits and the hours they took. */
  completedCount: number;
  completedHours: number;
  upcomingCount: number;
  cancelledCount: number;
  /** Completed visits by type, every type listed in form order. */
  byType: TypeSummary[];
};

export function summarize(list: Timed[], now: Date): FieldSummary {
  const byType = new Map<AppointmentType, TypeSummary>(
    APPOINTMENT_TYPES.map((type) => [type, { type, count: 0, hours: 0 }]),
  );
  let completedCount = 0;
  let completedHours = 0;
  let upcomingCount = 0;
  let cancelledCount = 0;
  for (const a of list) {
    if (a.status === "COMPLETED") {
      const h = effectiveHours(a);
      completedCount += 1;
      completedHours += h;
      const row = byType.get(a.type);
      if (row) {
        row.count += 1;
        row.hours = roundHours(row.hours + h);
      }
    } else if (a.status === "CANCELLED") {
      cancelledCount += 1;
    } else if (ms(a.endsAt) >= now.getTime()) {
      upcomingCount += 1;
    }
  }
  return {
    completedCount,
    completedHours: roundHours(completedHours),
    upcomingCount,
    cancelledCount,
    byType: [...byType.values()],
  };
}

/** Monday 00:00 to the next Monday 00:00 (exclusive), around `now`. */
export function weekRange(now: Date): { from: Date; to: Date } {
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dow = (new Date(day).getUTCDay() + 6) % 7; // Monday = 0
  const from = new Date(day - dow * DAY_MS);
  return { from, to: new Date(from.getTime() + 7 * DAY_MS) };
}

/** First of the month to the first of the next (exclusive). */
export function monthRange(now: Date): { from: Date; to: Date } {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { from, to };
}

function within(v: string | Date, r: { from: Date; to: Date }): boolean {
  const t = ms(v);
  return t >= r.from.getTime() && t < r.to.getTime();
}

/** The register's three tiles. */
export function registerTiles(list: Timed[], now: Date): {
  thisWeek: number;
  upcoming: number;
  hoursThisMonth: number;
} {
  const week = weekRange(now);
  const month = monthRange(now);
  let thisWeek = 0;
  let hoursThisMonth = 0;
  for (const a of list) {
    if (a.status !== "CANCELLED" && within(a.startsAt, week)) thisWeek += 1;
    if (a.status === "COMPLETED" && within(a.startsAt, month)) hoursThisMonth += effectiveHours(a);
  }
  const upcoming = list.filter((a) => isOpen(a.status) && ms(a.endsAt) >= now.getTime()).length;
  return { thisWeek, upcoming, hoursThisMonth: roundHours(hoursThisMonth) };
}

/**
 * `SCH-{year}-{NNN}`: one more than the highest number used this year.
 *
 * `existing` must include soft-deleted rows, so a number is never handed out
 * twice. Numbers from other years, or not in this form, are ignored.
 */
export function nextAppointmentNumber(existing: string[], year: number): string {
  const re = new RegExp(`^SCH-${year}-(\\d+)$`);
  let max = 0;
  for (const n of existing) {
    const m = re.exec(n.trim());
    if (m && Number(m[1]) > max) max = Number(m[1]);
  }
  return `SCH-${year}-${String(max + 1).padStart(3, "0")}`;
}

// ── What may happen next ───────────────────────────────────────────────────

export function canEdit(status: AppointmentStatus): boolean {
  return isOpen(status);
}
export function canComplete(status: AppointmentStatus): boolean {
  return isOpen(status);
}
export function canCancel(status: AppointmentStatus): boolean {
  return isOpen(status);
}
export function canPostpone(status: AppointmentStatus): boolean {
  return isOpen(status);
}
/** Only a visit still SCHEDULED with nothing on a timesheet may disappear. */
export function canDelete(a: { status: AppointmentStatus; timeLoggedAt: string | Date | null }): boolean {
  return a.status === "SCHEDULED" && !a.timeLoggedAt;
}

/**
 * Why the hours of this visit cannot go on the timesheets, or null when they can.
 * A timesheet entry is kept against a project, so a visit booked only on a
 * proposal has nowhere to put them until the proposal becomes a project.
 */
export function timesheetBlocker(a: {
  projectId: string | null;
  timeLoggedAt: string | Date | null;
  attendeeIds: string[];
}): string | null {
  if (a.timeLoggedAt) return "These hours are already on the timesheets.";
  if (!a.projectId)
    return "Timesheets are kept by project. Link this visit to a project to put its hours on them.";
  if (a.attendeeIds.length === 0) return "Nobody from the team is listed as attending.";
  return null;
}

/** Whose hours this person may log: everyone if they administer members, else only their own. */
export function timesheetTargets(
  attendees: { id: string; name: string }[],
  actor: { id: string; isApprover: boolean },
): { log: { id: string; name: string }[]; skipped: { id: string; name: string }[] } {
  if (actor.isApprover) return { log: attendees, skipped: [] };
  return {
    log: attendees.filter((a) => a.id === actor.id),
    skipped: attendees.filter((a) => a.id !== actor.id),
  };
}

/** "2.5 h" — one or two decimals only when there are any. */
export function formatHours(n: number): string {
  const r = roundHours(n);
  return `${Number.isInteger(r) ? r : r.toFixed(2).replace(/0$/, "")} h`;
}
