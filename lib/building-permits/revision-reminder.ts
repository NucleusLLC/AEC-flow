/**
 * The revision deadline on a permit file, and when the dashboard starts
 * blinking about it.
 *
 * The authority asks for a revised submission by a date. Whoever records that
 * date on the permit also says how many days ahead they want warning (a week
 * by default). From that day the reminder is on the dashboard; on the deadline
 * it says "due today"; after it, "overdue".
 *
 * IT STOPS BY ITSELF when the revision goes in: a new version recorded after
 * the reminder was set answers it, so nobody has to remember to switch the
 * reminder off. A closed file (approved, issued, refused, withdrawn, expired)
 * has nothing left to revise, so it stops then too.
 *
 * PURE: dates in, verdict out. `today` is a yyyy-mm-dd string, the same local
 * day the register uses (ymd(new Date())).
 */
import type { BuildingPermitStatus } from "./types";

export const DEFAULT_REVISION_LEAD_DAYS = 7;
export const MAX_REVISION_LEAD_DAYS = 90;

/** Statuses after which no revision can be asked for. */
export const CLOSED_PERMIT_STATUSES: readonly BuildingPermitStatus[] = [
  "APPROVED",
  "APPROVED_WITH_CONDITIONS",
  "REJECTED",
  "WITHDRAWN",
  "ISSUED",
  "EXPIRED",
];

export type RevisionReminderState = "upcoming" | "today" | "overdue";

export type RevisionReminderInput = {
  status: BuildingPermitStatus;
  /** yyyy-mm-dd, or null when no revision is due. */
  revisionDueAt: string | null;
  revisionReminderDays: number;
  /** ISO timestamp of when the deadline was last set or changed. */
  revisionSetAt: string | null;
  /** ISO timestamp of the newest recorded version (submission), or null. */
  latestSubmissionRecordedAt: string | null;
};

export type RevisionReminderVerdict = {
  state: RevisionReminderState;
  /** Whole days until the deadline; negative once it has passed. */
  daysLeft: number;
};

/** One permit the dashboard is warning about. */
export type PermitRevisionReminder = RevisionReminderVerdict & {
  permitId: string;
  reference: string;
  title: string;
  authority: string | null;
  /** yyyy-mm-dd */
  dueAt: string;
  note: string | null;
};

/** Whole days from `from` to `to`, both yyyy-mm-dd, ignoring clocks and DST. */
export function dayDiff(from: string, to: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

/** Warning days kept to a sane range; anything unreadable is the one-week default. */
export function leadDays(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v) || v < 0) return DEFAULT_REVISION_LEAD_DAYS;
  return Math.min(v, MAX_REVISION_LEAD_DAYS);
}

/** Null when nothing should show; otherwise how urgent it is. */
export function revisionReminder(
  p: RevisionReminderInput,
  today: string,
): RevisionReminderVerdict | null {
  if (!p.revisionDueAt) return null;
  if (CLOSED_PERMIT_STATUSES.includes(p.status)) return null;
  // A version recorded after the deadline was set is the revision it asked for.
  if (p.revisionSetAt && p.latestSubmissionRecordedAt && p.latestSubmissionRecordedAt > p.revisionSetAt) {
    return null;
  }
  const daysLeft = dayDiff(today, p.revisionDueAt);
  if (daysLeft > leadDays(p.revisionReminderDays)) return null;
  const state: RevisionReminderState = daysLeft < 0 ? "overdue" : daysLeft === 0 ? "today" : "upcoming";
  return { state, daysLeft };
}
