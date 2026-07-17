/**
 * Schedule integration adapter (spec §8).
 *
 * READ-ONLY bridge between the module shell and the protected Schedule system.
 * It reuses the existing data-access layer and the existing pure algorithms
 * (`computeCpm`, `computeScheduleHealth`) — it never recreates a calculation,
 * never writes, and never alters schedule behavior. See docs/protected-systems.md.
 *
 * NOTE: Schedule has no version mechanism (see docs/protected-schedule-files.md
 * §6). A schedule is identified by projectId; there is no "Version N".
 */
import "server-only";
import { getSchedule, getSchedules } from "@/lib/data/schedule-db";
import { computeCpm, computeScheduleHealth } from "@/lib/data/schedule";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface ScheduleSummary {
  found: boolean;
  projectId: string;
  projectName: string;
  overall: "on-track" | "watch" | "at-risk" | "empty";
  /** Overall actual progress % (duration-weighted, from computeScheduleHealth). */
  pctActual: number;
  pctPlanned: number;
  plannedStart: string;
  plannedFinish: string;
  baselineFinish: string | null;
  forecastFinish: string | null;
  spi: number;
  varianceDays: number;
  criticalCount: number;
  taskCount: number;
}

const NOT_FOUND: ScheduleSummary = {
  found: false,
  projectId: "",
  projectName: "",
  overall: "empty",
  pctActual: 0,
  pctPlanned: 0,
  plannedStart: "",
  plannedFinish: "",
  baselineFinish: null,
  forecastFinish: null,
  spi: 1,
  varianceDays: 0,
  criticalCount: 0,
  taskCount: 0,
};

/**
 * Read-only schedule summary for a project's dashboard tile. Progress, SPI,
 * variance and the critical set all come from the schedule's own algorithms —
 * nothing is recomputed with a competing engine. Returns `{ found: false }` when
 * the project has no schedule.
 */
export async function getProjectScheduleSummary(projectId: string): Promise<ScheduleSummary> {
  const sched = await getSchedule(projectId);
  if (!sched) return NOT_FOUND;

  if (sched.tasks.length === 0) {
    return {
      ...NOT_FOUND,
      found: true,
      projectId: sched.projectId,
      projectName: sched.projectName,
      plannedStart: sched.start,
      plannedFinish: sched.end,
    };
  }

  const cpm = computeCpm(sched.tasks);
  const statusDate = sched.config?.statusDate ?? todayIso();
  const health = computeScheduleHealth(sched.tasks, statusDate, cpm.critical);

  return {
    found: true,
    projectId: sched.projectId,
    projectName: sched.projectName,
    overall: health.overall,
    pctActual: Math.round(health.pctActual),
    pctPlanned: Math.round(health.pctPlanned),
    plannedStart: sched.start,
    plannedFinish: sched.end,
    baselineFinish: health.baselineFinish,
    forecastFinish: health.forecastFinish,
    spi: health.spi,
    varianceDays: health.varianceDays,
    criticalCount: cpm.critical.size,
    taskCount: sched.tasks.length,
  };
}

export interface ScheduleListItem {
  projectId: string;
  projectName: string;
  taskCount: number;
  plannedStart: string;
  plannedFinish: string;
}

/** Lightweight list of all schedules (no health computation). */
export async function getScheduleSummaries(): Promise<ScheduleListItem[]> {
  const schedules = await getSchedules();
  return schedules.map((s) => ({
    projectId: s.projectId,
    projectName: s.projectName,
    taskCount: s.tasks.length,
    plannedStart: s.start,
    plannedFinish: s.end,
  }));
}

/** Stable URL into the existing Schedule system (routes unchanged). */
export function getScheduleUrl(): string {
  return "/schedule";
}

/** The existing printable programme sheet for a project (unchanged). */
export function getSchedulePrintUrl(projectId: string): string {
  return `/print/schedule/${encodeURIComponent(projectId)}`;
}

/** Access is enforced by the tenant boundary (lib/db.ts). This hook is where
 *  per-user module entitlement would attach. */
export async function canAccess(): Promise<boolean> {
  return true;
}
