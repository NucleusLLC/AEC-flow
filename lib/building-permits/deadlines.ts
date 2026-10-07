/**
 * Permit DEADLINES — the dated deadlines a user sets on a building permit file,
 * and the colour each one shows in on the dashboards.
 *
 * The owner's rule, verbatim in spirit: a saved deadline shows in YELLOW; two
 * weeks out it turns RED; within days it BLINKS red. So, from the deadline's
 * date and today:
 *   - YELLOW  more than RED_DAYS (14) days away;
 *   - RED     RED_DAYS days or fewer;
 *   - BLINK   BLINK_DAYS (3) days or fewer, the day itself, and every day after
 *             it until somebody marks it met.
 *
 * PURE and CLIENT-SAFE: no Prisma, no React, no clock. Days are counted on
 * `YYYY-MM-DD` strings, never through a local Date, so no timezone or DST can
 * move a deadline by a day.
 */

/** Mirrors `enum PermitDeadlineKind` in prisma/schema.prisma (tripwire in the tests). */
export const PERMIT_DEADLINE_KINDS = ["SUBMIT_REVIEW", "REPLY", "OTHER"] as const;
export type PermitDeadlineKind = (typeof PERMIT_DEADLINE_KINDS)[number];

/** Military labels. OTHER shows the typed label instead (see deadlineLabel). */
export const PERMIT_DEADLINE_KIND_LABEL: Record<PermitDeadlineKind, string> = {
  SUBMIT_REVIEW: "DEADLINE TO SUBMIT REVIEW",
  REPLY: "DEADLINE TO REPLY / RESPOND",
  OTHER: "OTHER",
};

/** Red from this many days out (two weeks' notice). */
export const RED_DAYS = 14;
/** Blinking red from this many days out, on the day, and once it has passed. */
export const BLINK_DAYS = 3;
/** The longest typed label for an OTHER deadline. */
export const DEADLINE_LABEL_MAX = 120;

export type DeadlineState = "YELLOW" | "RED" | "BLINK";

/** One deadline as the browser sees it. Dates are `YYYY-MM-DD`; timestamps ISO. */
export type PermitDeadlineDTO = {
  id: string;
  permitId: string;
  kind: PermitDeadlineKind;
  label: string | null;
  dueDate: string;
  metAt: string | null;
  createdByName: string | null;
  createdAt: string;
};

/** An open deadline with the permit it belongs to — what the dashboards list. */
export type OpenPermitDeadline = PermitDeadlineDTO & {
  reference: string;
  permitNumber: string | null;
  title: string;
  authority: string | null;
};

/** Whole days from `from` to `to`, both `YYYY-MM-DD`; negative when `to` is earlier. */
export function daysUntil(from: string, to: string): number {
  const utc = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** The colour a deadline shows in today. */
export function deadlineState(dueDate: string, today: string): DeadlineState {
  const days = daysUntil(today, dueDate);
  if (days <= BLINK_DAYS) return "BLINK";
  if (days <= RED_DAYS) return "RED";
  return "YELLOW";
}

/** `IN 9D`, `TODAY`, `3D OVERDUE` — military shorthand. */
export function deadlineWhen(days: number): string {
  if (days === 0) return "TODAY";
  return days < 0 ? `${-days}D OVERDUE` : `IN ${days}D`;
}

/** What the deadline is called, in capitals: the kind's label, or the typed one for OTHER. */
export function deadlineLabel(d: { kind: PermitDeadlineKind; label: string | null }): string {
  if (d.kind === "OTHER") return (d.label ?? "").trim().toUpperCase() || PERMIT_DEADLINE_KIND_LABEL.OTHER;
  return PERMIT_DEADLINE_KIND_LABEL[d.kind];
}

/** Soonest first; the same day by kind, then by label, so the order never jitters. */
export function sortDeadlines<T extends { dueDate: string; kind: PermitDeadlineKind; label: string | null }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) ||
      PERMIT_DEADLINE_KINDS.indexOf(a.kind) - PERMIT_DEADLINE_KINDS.indexOf(b.kind) ||
      (a.label ?? "").localeCompare(b.label ?? ""),
  );
}

// ── Validation ──────────────────────────────────────────────────────────────

export type PermitDeadlineInput = {
  kind: PermitDeadlineKind;
  /** Null unless kind is OTHER. */
  label: string | null;
  /** `YYYY-MM-DD` */
  dueDate: string;
};

export type DeadlineField = "kind" | "label" | "dueDate";

export type DeadlineCheck =
  | { ok: true; value: PermitDeadlineInput }
  | { ok: false; errors: Partial<Record<DeadlineField, string>> };

/** A real calendar day, `YYYY-MM-DD`, between 2000 and 2100. */
export function isCalendarDay(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 2000 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/**
 * The one gate for a new deadline — the dialog runs it before sending, the
 * server action runs it again (the form is a convenience, not a control).
 * Messages are English keys the UI translates.
 */
export function checkDeadlineInput(raw: unknown): DeadlineCheck {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: Partial<Record<DeadlineField, string>> = {};

  const kind = typeof o.kind === "string" && (PERMIT_DEADLINE_KINDS as readonly string[]).includes(o.kind)
    ? (o.kind as PermitDeadlineKind)
    : null;
  if (!kind) errors.kind = "Choose the type of deadline.";

  const typed = typeof o.label === "string" ? o.label.replace(/\s+/g, " ").trim() : "";
  let label: string | null = null;
  if (kind === "OTHER") {
    if (!typed) errors.label = "Type what the deadline is for.";
    else if (typed.length > DEADLINE_LABEL_MAX) errors.label = "Keep it to 120 characters.";
    else label = typed;
  }

  const dueDate = typeof o.dueDate === "string" ? o.dueDate.trim() : "";
  if (!dueDate) errors.dueDate = "Pick the deadline date.";
  else if (!isCalendarDay(dueDate)) errors.dueDate = "That is not a valid date.";

  if (Object.keys(errors).length > 0 || !kind) return { ok: false, errors };
  return { ok: true, value: { kind, label, dueDate } };
}
