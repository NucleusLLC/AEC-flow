/**
 * PROJECT PHASES — the rules, kept free of Prisma and React so they test and so
 * the `"use client"` phase editor can import them.
 *
 * ─── WHAT A PHASE IS HERE ─────────────────────────────────────────────────────
 * A stage of the job — CONCEPT DESIGN, SCHEMATIC DESIGN, … — with a start and an
 * end date, a status, a percent complete and, optionally, a discipline. It lives
 * in the existing `ProjectPhase` table; nothing in this feature needs a column
 * that table does not already have. The editor sends the WHOLE list in its new
 * order every time it saves, and the array index becomes `sortOrder`.
 *
 * ─── PROJECT PROGRESS IS DERIVED (equal weight) ──────────────────────────────
 * `Project.progressPct` is recomputed from the phases on every save and written
 * back to the column, so every existing reader (the Projects list, the project
 * dashboard, the Office Dash) shows it without changing.
 *
 * The formula is the PLAIN AVERAGE of the phases' percent complete, every phase
 * weighted the same, CANCELLED phases left out, rounded to a whole percent.
 * Equal weight rather than weight-by-duration because a phase's dates are
 * optional and are often blank when the phase list is first set up: a
 * duration-weighted average would either have to invent a duration for an
 * undated phase or quietly drop it, and both make the project figure jump when
 * somebody types a date. Equal weight moves only when somebody moves a phase.
 *
 * No phase to count (none at all, or every one cancelled) → `null`, meaning
 * "leave the stored figure alone" rather than overwrite it with a made-up 0.
 *
 * ─── HOURS BY PHASE ───────────────────────────────────────────────────────────
 * The timesheet stamps `phaseId` on an entry. `phaseHours` rolls a project's
 * entries up per phase and per person: approved hours, hours still in the
 * pipeline (draft or submitted), the cost at each entry's SNAPSHOTTED cost rate
 * and the value at its snapshotted charge rate — through the same `timeValue`
 * and exact-money primitive the timesheet uses (lib/finance/timesheet.ts,
 * lib/proposals/engine/money.ts), so a phase's figures add up to the project's.
 * Rejected hours are counted nowhere, as in `projectProfitability`.
 */
import { add, fromMajor, toMajor } from "@/lib/proposals/engine/money";
import { roundHours, timeValue } from "@/lib/finance/timesheet";
import type { FinanceApprovalStatus } from "@/lib/finance/types";

export type PhaseStatusValue = "NOT_STARTED" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED";

export type PhaseDiscipline =
  | "ARCHITECTURE"
  | "STRUCTURAL"
  | "INTERIOR"
  | "MEP"
  | "PROJECT_MANAGEMENT"
  | "CONSTRUCTION";

/** Every value of the PhaseStatus enum, in the order the dropdown lists them. */
export const PHASE_STATUSES: PhaseStatusValue[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
];

/** The dropdown's labels (English keys; the screen translates them). */
export const PHASE_STATUS_OPTION: Record<PhaseStatusValue, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const PHASE_DISCIPLINES: PhaseDiscipline[] = [
  "ARCHITECTURE",
  "STRUCTURAL",
  "INTERIOR",
  "MEP",
  "PROJECT_MANAGEMENT",
  "CONSTRUCTION",
];

/**
 * The quick-add presets, in the order a design job runs. LOAD STANDARD PHASES
 * creates all seven on a project that has none.
 */
export const PHASE_PRESETS: string[] = [
  "Concept Design",
  "Schematic Design",
  "Design Development",
  "Construction Documents",
  "Tender / Bidding",
  "Construction Administration",
  "Handover",
];

export const MAX_PHASES = 40;
export const MAX_PHASE_NAME = 120;

/** One phase as the editor holds it. `id` absent/null = a new phase. */
export type PhaseDraft = {
  id?: string | null;
  name: string;
  discipline?: PhaseDiscipline | null;
  status?: PhaseStatusValue;
  progressPct?: number | string | null;
  startDate?: string | null;
  endDate?: string | null;
};

/** A phase after validation, ready to write. `sortOrder` is its index. */
export type CleanPhase = {
  id: string | null;
  name: string;
  discipline: PhaseDiscipline | null;
  status: PhaseStatusValue;
  progressPct: number;
  startDate: string | null;
  endDate: string | null;
  sortOrder: number;
};

/**
 * Why a phase list cannot be saved. `code` is stable for the screen to
 * translate; `index` is the row (0-based) and `name` the phase it is about.
 */
export type PhaseIssue = {
  code:
    | "NAME_REQUIRED"
    | "NAME_TOO_LONG"
    | "DUPLICATE_NAME"
    | "BAD_DATE"
    | "END_BEFORE_START"
    | "BAD_STATUS"
    | "BAD_DISCIPLINE"
    | "TOO_MANY";
  index: number;
  name: string;
};

export type PhaseValidation = { ok: true; value: CleanPhase[] } | { ok: false; issue: PhaseIssue };

function cleanDate(raw: string | null | undefined): string | null | "BAD" {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return "BAD";
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  // 2026-02-31 parses to 3 March — reject a date the calendar does not have.
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) {
    return "BAD";
  }
  return v;
}

/** 0–100, whole numbers. Anything unreadable is 0. */
export function cleanPct(raw: number | string | null | undefined): number {
  const n = typeof raw === "string" ? Number(raw.replace(",", ".").trim()) : raw;
  if (n === null || n === undefined || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Check and tidy the whole list in the order it will be saved.
 *
 * Names are trimmed, required, at most 120 characters and unique within the
 * project (ignoring case) — the timesheet's PHASE dropdown lists them by name,
 * and two phases called "Schematic Design" is a coin toss for whoever books the
 * hours. A COMPLETED phase is 100% whatever was typed: the two fields saying
 * different things is how a project report contradicts itself.
 */
export function validatePhases(drafts: PhaseDraft[]): PhaseValidation {
  if (drafts.length > MAX_PHASES) {
    return { ok: false, issue: { code: "TOO_MANY", index: MAX_PHASES, name: "" } };
  }
  const seen = new Set<string>();
  const out: CleanPhase[] = [];
  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i];
    const name = (d.name ?? "").trim().replace(/\s+/g, " ");
    const fail = (code: PhaseIssue["code"]): PhaseValidation => ({ ok: false, issue: { code, index: i, name } });
    if (!name) return fail("NAME_REQUIRED");
    if (name.length > MAX_PHASE_NAME) return fail("NAME_TOO_LONG");
    const key = name.toLowerCase();
    if (seen.has(key)) return fail("DUPLICATE_NAME");
    seen.add(key);

    const status = d.status ?? "NOT_STARTED";
    if (!PHASE_STATUSES.includes(status)) return fail("BAD_STATUS");
    const discipline = d.discipline || null;
    if (discipline && !PHASE_DISCIPLINES.includes(discipline)) return fail("BAD_DISCIPLINE");

    const startDate = cleanDate(d.startDate);
    const endDate = cleanDate(d.endDate);
    if (startDate === "BAD" || endDate === "BAD") return fail("BAD_DATE");
    if (startDate && endDate && endDate < startDate) return fail("END_BEFORE_START");

    out.push({
      id: d.id ? String(d.id) : null,
      name,
      discipline,
      status,
      progressPct: status === "COMPLETED" ? 100 : cleanPct(d.progressPct),
      startDate,
      endDate,
      sortOrder: i,
    });
  }
  return { ok: true, value: out };
}

/** The seven standard phases as new drafts: not started, 0%, no dates. */
export function standardPhaseDrafts(): PhaseDraft[] {
  return PHASE_PRESETS.map((name) => ({ id: null, name, status: "NOT_STARTED", progressPct: 0 }));
}

/** The presets not already on the list (by name, ignoring case) — the quick-add buttons. */
export function missingPresets(names: string[]): string[] {
  const have = new Set(names.map((n) => n.trim().toLowerCase()));
  return PHASE_PRESETS.filter((p) => !have.has(p.toLowerCase()));
}

/**
 * Project percent complete from its phases: equal-weighted average, CANCELLED
 * left out, whole percent. `null` when there is nothing to average — the
 * caller then leaves the stored figure as it is. See the file header for why
 * equal weight and not duration.
 */
export function deriveProjectProgress(
  phases: { status: PhaseStatusValue | string; progressPct: number | string | null | undefined }[],
): number | null {
  const counted = phases.filter((p) => p.status !== "CANCELLED");
  if (counted.length === 0) return null;
  const total = counted.reduce((s, p) => s + (p.status === "COMPLETED" ? 100 : cleanPct(p.progressPct)), 0);
  return Math.max(0, Math.min(100, Math.round(total / counted.length)));
}

/** Move one row up (-1) or down (+1). Out of range is a no-op, never a wrap. */
export function movePhase<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list;
  const next = list.slice();
  const [row] = next.splice(index, 1);
  next.splice(to, 0, row);
  return next;
}

/**
 * Which existing phases a save removes, and which submitted ids are not this
 * project's at all. A submitted id that is not on the project is REFUSED, never
 * treated as new — trusting it would let a request rename another project's
 * (or another practice's) phase.
 */
export function phaseChanges(
  existingIds: string[],
  submitted: { id: string | null }[],
): { removed: string[]; foreign: string[] } {
  const have = new Set(existingIds);
  const kept = new Set<string>();
  const foreign: string[] = [];
  for (const s of submitted) {
    if (!s.id) continue;
    if (have.has(s.id)) kept.add(s.id);
    else foreign.push(s.id);
  }
  return { removed: existingIds.filter((id) => !kept.has(id)), foreign };
}

// ── Hours by phase ─────────────────────────────────────────────────────────

/** A time entry as the phase roll-up reads it. */
export type PhaseTimeEntry = {
  userId: string;
  userName: string;
  phaseId: string | null;
  hours: number | string | null | undefined;
  billable?: boolean;
  status: FinanceApprovalStatus;
  chargeRate?: number | string | null;
  costRate?: number | string | null;
};

export type PhaseHoursFigures = {
  /** Approved hours. */
  approved: number;
  /** Draft and submitted hours — logged, not yet signed off. */
  pending: number;
  /** approved + pending (rejected hours are counted nowhere). */
  hours: number;
  /** Every counted hour at its snapshotted cost rate. */
  cost: number;
  /** Billable counted hours at their snapshotted charge rate. */
  value: number;
};

export type PhasePersonHours = PhaseHoursFigures & { userId: string; userName: string };

export type PhaseHoursRow = PhaseHoursFigures & {
  /** null = hours booked to the project with no phase chosen. */
  phaseId: string | null;
  people: PhasePersonHours[];
};

export type PhaseHoursReport = {
  /** One row per phase that has hours, plus a `phaseId: null` row when any have none. */
  rows: PhaseHoursRow[];
  total: PhaseHoursFigures;
};

function emptyFigures(): PhaseHoursFigures {
  return { approved: 0, pending: 0, hours: 0, cost: 0, value: 0 };
}

function addInto(f: PhaseHoursFigures, h: number, approved: boolean, cost: number, value: number, currency: string) {
  if (approved) f.approved = roundHours(f.approved + h);
  else f.pending = roundHours(f.pending + h);
  f.hours = roundHours(f.hours + h);
  f.cost = toMajor(add(fromMajor(f.cost, currency), fromMajor(cost, currency)));
  f.value = toMajor(add(fromMajor(f.value, currency), fromMajor(value, currency)));
}

/**
 * Roll a project's time entries up per phase and per person.
 *
 * An entry whose phase is not in `phaseIds` (a phase since removed, or one that
 * never belonged here) falls into the "no phase" row rather than vanishing — the
 * hours were worked whether or not the phase still exists. Rows come back in
 * `phaseIds` order, the no-phase row last; people by most hours.
 */
export function phaseHours(entries: PhaseTimeEntry[], phaseIds: string[], currency: string): PhaseHoursReport {
  const known = new Set(phaseIds);
  const rows = new Map<string, PhaseHoursRow & { byPerson: Map<string, PhasePersonHours> }>();
  const total = emptyFigures();

  for (const e of entries) {
    if (e.status === "REJECTED") continue;
    const h = roundHours(e.hours);
    if (h === 0) continue;
    const phaseId = e.phaseId && known.has(e.phaseId) ? e.phaseId : null;
    const key = phaseId ?? "";
    let row = rows.get(key);
    if (!row) {
      row = { phaseId, ...emptyFigures(), people: [], byPerson: new Map() };
      rows.set(key, row);
    }
    let person = row.byPerson.get(e.userId);
    if (!person) {
      person = { userId: e.userId, userName: e.userName, ...emptyFigures() };
      row.byPerson.set(e.userId, person);
    }
    const approved = e.status === "APPROVED";
    const cost = timeValue(h, e.costRate, currency);
    const value = e.billable === false ? 0 : timeValue(h, e.chargeRate, currency);
    addInto(row, h, approved, cost, value, currency);
    addInto(person, h, approved, cost, value, currency);
    addInto(total, h, approved, cost, value, currency);
  }

  const order = new Map(phaseIds.map((id, i) => [id, i]));
  const out: PhaseHoursRow[] = [...rows.values()]
    .sort((a, b) => (a.phaseId === null ? 1 : b.phaseId === null ? -1 : (order.get(a.phaseId) ?? 0) - (order.get(b.phaseId) ?? 0)))
    .map(({ byPerson, ...row }) => ({
      ...row,
      people: [...byPerson.values()].sort((a, b) => b.hours - a.hours || a.userName.localeCompare(b.userName)),
    }));
  return { rows: out, total };
}

/** Hours booked to each phase (any status but rejected, deleted rows excluded by the caller). */
export function bookedHoursByPhase(entries: { phaseId: string | null; hours: number | string | null | undefined }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of entries) {
    if (!e.phaseId) continue;
    const h = roundHours(e.hours);
    if (h === 0) continue;
    out.set(e.phaseId, roundHours((out.get(e.phaseId) ?? 0) + h));
  }
  return out;
}
