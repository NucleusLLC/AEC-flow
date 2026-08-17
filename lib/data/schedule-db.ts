/**
 * Schedule persistence (server-only — imports Prisma).
 *
 * Reads use a "DB row if present, else seed" fallback so existing demo projects
 * keep working until they're first saved (mirrors the Construction-Admin repos).
 * Writes replace the task list wholesale (the editor sends the whole programme),
 * like the estimate save. The client Gantt imports types + pure utils from
 * `./schedule` (which stays Prisma-free). See [[aec-prisma-client-boundary]].
 */
import { prisma } from "@/lib/db";
import {
  SEED_SCHEDULES,
  withWindow,
  type ProjectSchedule,
  type ScheduleTask,
  type ScheduleBoardConfig,
  type Discipline,
  type ScheduleStatus,
} from "@/lib/data/schedule";
import type { Prisma } from "@prisma/client";

type ScheduleRow = Prisma.ProjectScheduleGetPayload<{ include: { tasks: true } }>;

function rowToSchedule(row: ScheduleRow): ProjectSchedule {
  const tasks: ScheduleTask[] = [...row.tasks]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((t) => ({
      id: t.taskKey,
      name: t.name,
      discipline: t.discipline as Discipline,
      status: t.status as ScheduleStatus,
      start: t.start,
      end: t.end,
      progressPct: t.progressPct,
      dependsOn: t.dependsOn,
      assignee: t.assignee ?? undefined,
      parentId: t.parentId ?? undefined,
      durationUnit: (t.durationUnit as "days" | "hours" | null) ?? undefined,
      category: t.category ?? undefined,
      subCategory: t.subCategory ?? undefined,
      // PROTECTED SYSTEM (schedule) — additive cost fields, approved 2026-08-04.
      // Decimal → number at the boundary, exactly as procurement does. The rollup
      // re-enters exact integer minor units immediately (lib/schedule/budget.ts);
      // this hop is only to cross the server/client line, where a Decimal cannot go.
      budgetAmount: t.budgetAmount === null ? null : Number(t.budgetAmount),
      budgetSource: (t.budgetSource as "manual" | "estimate" | null) ?? null,
      budgetRef: t.budgetRef ?? null,
    }));
  return {
    ...withWindow({
      projectId: row.projectId,
      projectNumber: row.projectNumber,
      projectName: row.projectName,
      client: row.client ?? "",
      manager: row.manager ?? "",
      tasks,
    }),
    config: (row.config as ScheduleBoardConfig | null) ?? undefined,
  };
}

export async function getSchedule(projectId: string): Promise<ProjectSchedule | null> {
  const row = await prisma.projectSchedule.findUnique({
    where: { projectId },
    include: { tasks: true },
  });
  if (row) return rowToSchedule(row);
  const seed = SEED_SCHEDULES.find((s) => s.projectId === projectId);
  return seed ? withWindow(seed) : null;
}

export async function getSchedules(): Promise<ProjectSchedule[]> {
  const rows = await prisma.projectSchedule.findMany({ include: { tasks: true } });
  const byId = new Map(rows.map((r) => [r.projectId, rowToSchedule(r)]));
  const result: ProjectSchedule[] = [...byId.values()];
  // Seeds for projects not yet persisted keep showing the demo programme.
  for (const s of SEED_SCHEDULES) if (!byId.has(s.projectId)) result.push(withWindow(s));
  return result;
}

export type SaveScheduleInput = {
  projectId: string;
  projectNumber: string;
  projectName: string;
  client?: string;
  manager?: string;
  tasks: ScheduleTask[];
  config?: unknown;
};

/** Upsert a schedule and replace its tasks wholesale. */
export async function saveSchedule(input: SaveScheduleInput): Promise<{ id: string }> {
  const tasksCreate = input.tasks.map((t, i) => ({
    taskKey: t.id,
    name: t.name,
    discipline: t.discipline,
    status: t.status,
    start: t.start,
    end: t.end,
    progressPct: t.progressPct,
    dependsOn: t.dependsOn ?? [],
    assignee: t.assignee ?? null,
    parentId: t.parentId ?? null,
    durationUnit: t.durationUnit ?? null,
    category: t.category ?? null,
    subCategory: t.subCategory ?? null,
    // PROTECTED SYSTEM (schedule) — additive cost fields, approved 2026-08-04.
    // `undefined` and `null` both mean "no budget set" and both must persist as NULL:
    // a task whose budget was cleared has to come back cleared, not as zero.
    budgetAmount: t.budgetAmount ?? null,
    budgetSource: t.budgetSource ?? null,
    budgetRef: t.budgetRef ?? null,
    sortOrder: i,
  }));
  const scalars = {
    projectNumber: input.projectNumber,
    projectName: input.projectName,
    client: input.client ?? null,
    manager: input.manager ?? null,
    ...(input.config !== undefined ? { config: input.config as Prisma.InputJsonValue } : {}),
  };
  const saved = await prisma.$transaction(async (tx) => {
    // findFirst, NOT findUnique. Behaviour-preserving fix, not a redesign: the
    // tenant extension's findUnique guard reads `companyId` off the returned row,
    // and a `select` of just `id` leaves it undefined — so for a signed-in user
    // this read came back null, the upsert took the CREATE branch below, and the
    // save died on projectId's unique index. findFirst puts the company scope in
    // the WHERE instead; `projectId` is unique, so it is the same single row.
    const existing = await tx.projectSchedule.findFirst({
      where: { projectId: input.projectId },
      select: { id: true },
    });
    if (existing) {
      await tx.scheduleTask.deleteMany({ where: { scheduleId: existing.id } });
      return tx.projectSchedule.update({
        where: { id: existing.id },
        data: { ...scalars, tasks: { create: tasksCreate } },
      });
    }
    return tx.projectSchedule.create({
      data: { projectId: input.projectId, ...scalars, tasks: { create: tasksCreate } },
    });
  });
  return { id: saved.id };
}
