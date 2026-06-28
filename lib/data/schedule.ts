/**
 * Schedule data-access layer (project time-schedules / Gantt).
 *
 * IMPORTANT (single-tenant -> SaaS hedge): pages call functions from this module
 * rather than touching Prisma directly. Live version derives tasks from
 * `ProjectPhase` (+ `PhaseDependency`) per project. Placeholder data for now;
 * project numbers/names match `lib/data/projects.ts` so they line up.
 */

export type ScheduleStatus = "NOT_STARTED" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
export type Discipline =
  | "ARCHITECTURE"
  | "STRUCTURAL"
  | "INTERIOR"
  | "MEP"
  | "PROJECT_MANAGEMENT";

export type ScheduleTask = {
  id: string;
  name: string;
  discipline: Discipline;
  status: ScheduleStatus;
  start: string; // ISO yyyy-mm-dd
  end: string; // ISO yyyy-mm-dd
  progressPct: number;
  dependsOn: string[]; // task ids (finish-to-start)
  assignee?: string;
  parentId?: string | null; // for sub-categories / sub-tasks
  durationUnit?: "days" | "hours"; // how the duration is entered/displayed
  category?: string; // editable category id (overrides discipline for colour/label)
  subCategory?: string; // editable sub-category (e.g. construction activity)
};

/** Working hours per day used to convert an hours-based duration to grid days. */
export const HOURS_PER_DAY = 8;

/** Board-level settings persisted alongside the tasks (categories, calendar, data date). */
export type ScheduleBoardConfig = {
  categories?: { id: string; label: string; color: string }[];
  subcats?: Record<string, string[]>;
  hoursPerDay?: number;
  offDays?: number[];
  holidays?: string[];
  statusDate?: string;
};

export type ProjectSchedule = {
  projectId: string;
  projectNumber: string;
  projectName: string;
  client: string;
  manager: string;
  start: string;
  end: string;
  tasks: ScheduleTask[];
  config?: ScheduleBoardConfig;
};

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  ARCHITECTURE: "Architecture",
  STRUCTURAL: "Structural",
  INTERIOR: "Interior",
  MEP: "MEP",
  PROJECT_MANAGEMENT: "Project Mgmt",
};

const SCHEDULES: Omit<ProjectSchedule, "start" | "end">[] = [
  {
    projectId: "ZA-2026-014",
    projectNumber: "ZA-2026-014",
    projectName: "Marina Heights Tower — Phase 2",
    client: "Emaar Developments",
    manager: "Layla Hassan",
    tasks: [
      { id: "t1", name: "Concept Design", discipline: "ARCHITECTURE", status: "COMPLETED", start: "2026-01-15", end: "2026-02-20", progressPct: 100, dependsOn: [], assignee: "Idris Mansour" },
      { id: "t2", name: "Schematic Design", discipline: "ARCHITECTURE", status: "COMPLETED", start: "2026-02-21", end: "2026-04-10", progressPct: 100, dependsOn: ["t1"], assignee: "Idris Mansour" },
      { id: "t3", name: "Design Development", discipline: "ARCHITECTURE", status: "IN_PROGRESS", start: "2026-04-01", end: "2026-06-30", progressPct: 70, dependsOn: ["t2"], assignee: "Idris Mansour" },
      { id: "t4", name: "Structural Coordination", discipline: "STRUCTURAL", status: "IN_PROGRESS", start: "2026-04-15", end: "2026-07-15", progressPct: 55, dependsOn: ["t2"], assignee: "Wei Chen" },
      { id: "t5", name: "MEP Coordination", discipline: "MEP", status: "IN_PROGRESS", start: "2026-05-01", end: "2026-07-31", progressPct: 40, dependsOn: ["t2"], assignee: "Nadia Roy" },
      { id: "t6", name: "IFC / Tender Docs", discipline: "PROJECT_MANAGEMENT", status: "NOT_STARTED", start: "2026-08-01", end: "2026-09-30", progressPct: 0, dependsOn: ["t3", "t4", "t5"], assignee: "Layla Hassan" },
    ],
  },
  {
    projectId: "ZA-2026-011",
    projectNumber: "ZA-2026-011",
    projectName: "Saadiyat Cultural Pavilion",
    client: "DCT Abu Dhabi",
    manager: "Omar Farouk",
    tasks: [
      { id: "s1", name: "Concept Design", discipline: "ARCHITECTURE", status: "COMPLETED", start: "2026-03-10", end: "2026-04-15", progressPct: 100, dependsOn: [], assignee: "Hana Yusuf" },
      { id: "s2", name: "Heritage Authority Review", discipline: "PROJECT_MANAGEMENT", status: "IN_PROGRESS", start: "2026-04-16", end: "2026-06-20", progressPct: 60, dependsOn: ["s1"], assignee: "Omar Farouk" },
      { id: "s3", name: "Design Development", discipline: "ARCHITECTURE", status: "IN_PROGRESS", start: "2026-05-01", end: "2026-07-15", progressPct: 35, dependsOn: ["s1"], assignee: "Hana Yusuf" },
      { id: "s4", name: "Structural Engineering", discipline: "STRUCTURAL", status: "IN_PROGRESS", start: "2026-06-01", end: "2026-07-31", progressPct: 25, dependsOn: ["s3"], assignee: "Wei Chen" },
      { id: "s5", name: "Interior Concept", discipline: "INTERIOR", status: "NOT_STARTED", start: "2026-07-01", end: "2026-08-15", progressPct: 0, dependsOn: ["s3"], assignee: "Tom Becker" },
    ],
  },
  {
    projectId: "ZA-2026-006",
    projectNumber: "ZA-2026-006",
    projectName: "Emirates Hills Private Villa",
    client: "Al Fahim Residence",
    manager: "Layla Hassan",
    tasks: [
      { id: "v1", name: "Concept Design", discipline: "ARCHITECTURE", status: "COMPLETED", start: "2026-01-20", end: "2026-03-10", progressPct: 100, dependsOn: [], assignee: "Hana Yusuf" },
      { id: "v2", name: "Interior Concept", discipline: "INTERIOR", status: "COMPLETED", start: "2026-03-01", end: "2026-04-20", progressPct: 100, dependsOn: ["v1"], assignee: "Tom Becker" },
      { id: "v3", name: "Structural Design", discipline: "STRUCTURAL", status: "IN_PROGRESS", start: "2026-04-15", end: "2026-07-30", progressPct: 55, dependsOn: ["v1"], assignee: "Wei Chen" },
      { id: "v4", name: "Authority Approval", discipline: "PROJECT_MANAGEMENT", status: "NOT_STARTED", start: "2026-08-01", end: "2026-09-15", progressPct: 0, dependsOn: ["v3"], assignee: "Layla Hassan" },
      { id: "v5", name: "Construction Supervision", discipline: "PROJECT_MANAGEMENT", status: "NOT_STARTED", start: "2026-09-16", end: "2026-12-15", progressPct: 0, dependsOn: ["v4"], assignee: "Layla Hassan" },
    ],
  },
  {
    projectId: "ZA-2025-097",
    projectNumber: "ZA-2025-097",
    projectName: "Downtown Retail Fit-out",
    client: "Majid Al Futtaim",
    manager: "Layla Hassan",
    tasks: [
      { id: "r1", name: "Detailed Design", discipline: "INTERIOR", status: "COMPLETED", start: "2025-11-20", end: "2026-01-15", progressPct: 100, dependsOn: [], assignee: "Tom Becker" },
      { id: "r2", name: "MEP Fit-out", discipline: "MEP", status: "IN_PROGRESS", start: "2026-02-01", end: "2026-06-15", progressPct: 80, dependsOn: ["r1"], assignee: "Nadia Roy" },
      { id: "r3", name: "Snagging & Handover", discipline: "PROJECT_MANAGEMENT", status: "IN_PROGRESS", start: "2026-06-01", end: "2026-07-05", progressPct: 60, dependsOn: ["r2"], assignee: "Layla Hassan" },
    ],
  },
];

/** Derive the schedule window (earliest start / latest end) from its tasks. */
export function withWindow(s: Omit<ProjectSchedule, "start" | "end">): ProjectSchedule {
  const starts = s.tasks.map((t) => t.start).sort();
  const ends = s.tasks.map((t) => t.end).sort();
  return { ...s, start: starts[0] ?? "", end: ends[ends.length - 1] ?? "" };
}

/**
 * Seed schedules — the demo programmes. Read-through fallback for any project that
 * has no persisted schedule yet (see `lib/data/schedule-db.ts`). Project numbers
 * line up with `lib/data/projects.ts`. This module stays Prisma-free so the client
 * Gantt can import the types + pure utilities below.
 */
export const SEED_SCHEDULES: Omit<ProjectSchedule, "start" | "end">[] = SCHEDULES;

/* ───────────────────────────────────────────────────────────────────────────
 * Scheduling utilities — pure, run client-side over the (mutable) task list.
 * ────────────────────────────────────────────────────────────────────────── */

const DAY_MS = 86_400_000;
export const toScheduleDate = (iso: string) => new Date(iso + "T00:00:00");
export const isoFromDate = (d: Date) => d.toISOString().slice(0, 10);
export const addDaysIso = (iso: string, n: number) => {
  const d = toScheduleDate(iso);
  d.setDate(d.getDate() + n);
  return isoFromDate(d);
};
export const diffDaysIso = (a: string, b: string) =>
  Math.round((toScheduleDate(b).getTime() - toScheduleDate(a).getTime()) / DAY_MS);
/** Inclusive duration in calendar days. */
export const durationDays = (t: { start: string; end: string }) => diffDaysIso(t.start, t.end) + 1;

export type CpmResult = {
  critical: Set<string>;
  slack: Record<string, number>;
  projectDays: number;
};

/**
 * Critical Path Method over finish-to-start dependencies. Durations are derived
 * from each task's current start/end (so it recomputes as bars are resized).
 * Cycle-safe: a back-edge contributes 0 rather than looping forever.
 */
export function computeCpm(
  tasks: Array<{ id: string; start: string; end: string; dependsOn: string[] }>,
): CpmResult {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const dur = (id: string) => {
    const t = byId.get(id);
    return t ? durationDays(t) : 0;
  };

  const es: Record<string, number> = {};
  const ef: Record<string, number> = {};
  const inProgressEF = new Set<string>();
  const calcEF = (id: string): number => {
    if (ef[id] !== undefined) return ef[id];
    if (inProgressEF.has(id)) return 0; // cycle guard
    inProgressEF.add(id);
    const t = byId.get(id);
    let start = 0;
    if (t) {
      for (const d of t.dependsOn) if (byId.has(d)) start = Math.max(start, calcEF(d));
    }
    es[id] = start;
    ef[id] = start + dur(id);
    inProgressEF.delete(id);
    return ef[id];
  };
  tasks.forEach((t) => calcEF(t.id));
  const projectDays = tasks.reduce((m, t) => Math.max(m, ef[t.id] ?? 0), 0);

  const succ: Record<string, string[]> = {};
  tasks.forEach((t) => t.dependsOn.forEach((d) => (succ[d] ??= []).push(t.id)));

  const lf: Record<string, number> = {};
  const ls: Record<string, number> = {};
  const inProgressLS = new Set<string>();
  const calcLS = (id: string): number => {
    if (ls[id] !== undefined) return ls[id];
    if (inProgressLS.has(id)) return projectDays;
    inProgressLS.add(id);
    const successors = succ[id] ?? [];
    lf[id] =
      successors.length === 0
        ? projectDays
        : Math.min(...successors.map((s) => calcLS(s)));
    ls[id] = lf[id] - dur(id);
    inProgressLS.delete(id);
    return ls[id];
  };
  tasks.forEach((t) => calcLS(t.id));

  const slack: Record<string, number> = {};
  const critical = new Set<string>();
  tasks.forEach((t) => {
    const sl = (ls[t.id] ?? 0) - (es[t.id] ?? 0);
    slack[t.id] = sl;
    if (sl <= 0) critical.add(t.id);
  });

  return { critical, slack, projectDays };
}

/* ───────────────────────────────────────────────────────────────────────────
 * Schedule health — compares actual progress against where each task SHOULD be
 * at the "status date" (data date), to surface delays + critical-path slippage.
 * ────────────────────────────────────────────────────────────────────────── */

export type TaskHealthState =
  | "done"
  | "not-started"
  | "on-track"
  | "ahead"
  | "behind"
  | "overdue";

export type TaskHealth = {
  id: string;
  name: string;
  state: TaskHealthState;
  expectedPct: number;
  actualPct: number;
  daysBehind: number;
  daysOverdue: number;
  isCritical: boolean;
};

export type ScheduleHealth = {
  pctActual: number;
  pctPlanned: number;
  spi: number; // schedule performance index (earned / planned)
  varianceDays: number; // + ahead, − behind
  total: number;
  doneCount: number;
  behindCount: number;
  overdueCount: number;
  aheadCount: number;
  criticalSlipDays: number;
  baselineFinish: string | null;
  forecastFinish: string | null;
  finishSlipDays: number;
  overall: "on-track" | "watch" | "at-risk";
  perTask: Record<string, TaskHealth>;
  attention: TaskHealth[];
};

export function computeScheduleHealth(
  tasks: Array<{ id: string; name: string; start: string; end: string; progressPct: number }>,
  statusDate: string,
  critical: Set<string>,
): ScheduleHealth {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  let totalDur = 0;
  let earned = 0; // actual work done (duration-weighted)
  let planned = 0; // work that should be done by statusDate
  let baselineFinishMs: number | null = null;
  let criticalSlipDays = 0;
  let doneCount = 0;
  let behindCount = 0;
  let overdueCount = 0;
  let aheadCount = 0;
  const perTask: Record<string, TaskHealth> = {};

  for (const t of tasks) {
    const dur = durationDays(t);
    totalDur += dur;
    const actual = t.progressPct;

    let expected: number;
    if (statusDate < t.start) expected = 0;
    else if (statusDate >= t.end) expected = 100;
    else expected = clamp(((diffDaysIso(t.start, statusDate) + 1) / dur) * 100);

    earned += (actual / 100) * dur;
    planned += (expected / 100) * dur;

    const variance = actual - expected;
    const overdueDays = statusDate > t.end && actual < 100 ? diffDaysIso(t.end, statusDate) : 0;
    const behindDays = variance < 0 ? Math.round((Math.abs(variance) / 100) * dur) : 0;
    const isCritical = critical.has(t.id);

    let state: TaskHealthState;
    if (actual >= 100) state = "done";
    else if (statusDate < t.start) state = "not-started";
    else if (overdueDays > 0) state = "overdue";
    else if (variance < -5) state = "behind";
    else if (variance > 5) state = "ahead";
    else state = "on-track";

    if (state === "done") doneCount++;
    else if (state === "overdue") overdueCount++;
    else if (state === "behind") behindCount++;
    else if (state === "ahead") aheadCount++;

    perTask[t.id] = {
      id: t.id,
      name: t.name,
      state,
      expectedPct: Math.round(expected),
      actualPct: actual,
      daysBehind: behindDays,
      daysOverdue: overdueDays,
      isCritical,
    };

    const endMs = Date.parse(t.end);
    if (baselineFinishMs === null || endMs > baselineFinishMs) baselineFinishMs = endMs;
    if (isCritical && actual < 100) {
      criticalSlipDays = Math.max(criticalSlipDays, overdueDays, behindDays);
    }
  }

  const pctActual = totalDur ? (earned / totalDur) * 100 : 0;
  const pctPlanned = totalDur ? (planned / totalDur) * 100 : 0;
  const spi = planned > 0 ? earned / planned : 1;
  const varianceDays = Math.round(((pctActual - pctPlanned) / 100) * totalDur);
  const baselineFinish = baselineFinishMs
    ? new Date(baselineFinishMs).toISOString().slice(0, 10)
    : null;
  const finishSlipDays = Math.ceil(criticalSlipDays);
  const forecastFinish = baselineFinish ? addDaysIso(baselineFinish, finishSlipDays) : null;

  const overall: ScheduleHealth["overall"] =
    criticalSlipDays > 0 ? "at-risk" : behindCount + overdueCount > 0 ? "watch" : "on-track";

  const attention = Object.values(perTask)
    .filter((h) => h.state === "overdue" || h.state === "behind")
    .sort(
      (a, b) =>
        Number(b.isCritical) - Number(a.isCritical) ||
        b.daysOverdue + b.daysBehind - (a.daysOverdue + a.daysBehind),
    );

  return {
    pctActual,
    pctPlanned,
    spi,
    varianceDays,
    total: tasks.length,
    doneCount,
    behindCount,
    overdueCount,
    aheadCount,
    criticalSlipDays,
    baselineFinish,
    forecastFinish,
    finishSlipDays,
    overall,
    perTask,
    attention,
  };
}
