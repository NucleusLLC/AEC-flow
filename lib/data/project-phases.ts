/**
 * Project PHASES — data access. SERVER-ONLY.
 *
 * ─── TENANCY ───────────────────────────────────────────────────────────────
 * `ProjectPhase` is NOT in TENANT_MODELS (lib/db.ts) and has no companyId, so
 * the Prisma extension does not scope it. Every read and write here therefore
 * starts by loading the PROJECT through the tenant-scoped client — `findFirst`
 * with a narrow select, not `findUnique` (see updateClient in lib/data/clients.ts)
 * — and only then touches phases, always filtered by that project's id. A phase
 * id sent from the browser is never trusted on its own: it must be one of the
 * project's phases or the save is refused.
 *
 * ─── WHO MAY EDIT ──────────────────────────────────────────────────────────
 * Any signed-in member of the practice, the same rule as saving the project
 * itself (saveProject). Money on the hours report (cost and charge value) is
 * shown to member administrators only: a colleague's cost rate is not public
 * (lib/data/time-entries.ts listTimekeepers), and cost ÷ hours would print it.
 *
 * ─── REMOVING A PHASE ──────────────────────────────────────────────────────
 * BLOCKED while time entries point at it ("12.5 h are booked to this phase —
 * move or delete them first"). Re-pointing the hours silently would rewrite
 * what people reported they worked on. A removable phase takes its assignments
 * and dependencies with it, and its sub-phases are lifted to the top level —
 * the same order deleteProject uses (lib/data/project-lifecycle.ts).
 *
 * ─── PROJECT PROGRESS ──────────────────────────────────────────────────────
 * Every save recomputes Project.progressPct from the phases
 * (deriveProjectProgress — equal-weighted) and writes it in the same
 * transaction, so the Projects list, dashboards and the Office Dash read the
 * new figure with no change of their own.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";
import {
  bookedHoursByPhase,
  deriveProjectProgress,
  phaseChanges,
  phaseHours,
  validatePhases,
  type PhaseDiscipline,
  type PhaseDraft,
  type PhaseHoursReport,
  type PhaseIssue,
  type PhaseStatusValue,
} from "@/lib/projects/phases";

export type PhaseRow = {
  id: string;
  name: string;
  discipline: PhaseDiscipline | null;
  status: PhaseStatusValue;
  progressPct: number;
  startDate: string | null;
  endDate: string | null;
  sortOrder: number;
};

export type PhaseScreen = {
  projectId: string;
  progressPct: number;
  currency: string;
  phases: PhaseRow[];
  hours: PhaseHoursReport;
  /** Cost and charge value are shown only to member administrators. */
  showMoney: boolean;
};

/** Why a save was refused, as a code the action translates. */
export class PhaseSaveError extends Error {
  constructor(
    readonly code: "NOT_FOUND" | "FOREIGN_PHASE" | "HOURS_BOOKED" | "INVALID",
    readonly params: { name?: string; hours?: number; row?: number; issue?: PhaseIssue["code"] } = {},
  ) {
    super(code);
    this.name = "PhaseSaveError";
  }
}

type DecimalLike = { toNumber(): number } | number | string | null | undefined;
const num = (v: DecimalLike): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "object" ? v.toNumber() : Number(v);
  return Number.isFinite(n) ? n : null;
};
const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const toDate = (s: string | null) => (s ? new Date(`${s}T00:00:00.000Z`) : null);

/** The project, through the tenant-scoped client. Another practice's id is "not found". */
async function loadProject(id: string) {
  const p = await prisma.project.findFirst({
    where: { id },
    select: { id: true, progressPct: true, currency: true },
  });
  if (!p) throw new PhaseSaveError("NOT_FOUND");
  return p;
}

async function readPhases(projectId: string): Promise<PhaseRow[]> {
  const rows = await prisma.projectPhase.findMany({
    where: { projectId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      discipline: true,
      status: true,
      progressPct: true,
      startDate: true,
      endDate: true,
      sortOrder: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    discipline: (r.discipline as PhaseDiscipline | null) ?? null,
    status: r.status as PhaseStatusValue,
    progressPct: r.progressPct,
    startDate: ymd(r.startDate),
    endDate: ymd(r.endDate),
    sortOrder: r.sortOrder,
  }));
}

/** The phase screen: the phases in order, the derived progress, and hours by phase. */
export async function getPhaseScreen(projectId: string): Promise<PhaseScreen> {
  const actor = await requireActor();
  const project = await loadProject(projectId);
  const phases = await readPhases(project.id);
  // TimeEntry IS tenant-scoped by the extension.
  const entries = await prisma.timeEntry.findMany({
    where: { projectId: project.id, deletedAt: null },
    select: {
      userId: true,
      userName: true,
      phaseId: true,
      hours: true,
      billable: true,
      status: true,
      chargeRate: true,
      costRate: true,
    },
  });
  const showMoney = canManagePasswords(actor.role, actor.isFounder);
  const hours = phaseHours(
    entries.map((e) => ({
      ...e,
      hours: num(e.hours as DecimalLike),
      chargeRate: num(e.chargeRate as DecimalLike),
      costRate: num(e.costRate as DecimalLike),
    })),
    phases.map((p) => p.id),
    project.currency,
  );
  if (!showMoney) {
    for (const f of [hours.total, ...hours.rows, ...hours.rows.flatMap((r) => r.people)]) {
      f.cost = 0;
      f.value = 0;
    }
  }
  return { projectId: project.id, progressPct: project.progressPct, currency: project.currency, phases, hours, showMoney };
}

/**
 * The phases a timesheet may offer, for the projects the caller can see.
 * `projectIds` must come from a tenant-scoped project read (getProjects); the
 * filter here is what keeps another practice's phases out.
 */
export async function listPhasesForProjects(
  projectIds: string[],
): Promise<{ id: string; name: string; projectId: string }[]> {
  if (projectIds.length === 0) return [];
  return prisma.projectPhase.findMany({
    where: { projectId: { in: projectIds }, status: { not: "CANCELLED" } },
    orderBy: [{ projectId: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, projectId: true },
  });
}

/**
 * Save the whole phase list in its new order. New rows have no id; rows left
 * out are removed (unless hours are booked to them); the project's progress is
 * recomputed in the same transaction. Returns the fresh screen.
 */
export async function savePhases(projectId: string, drafts: PhaseDraft[]): Promise<PhaseScreen> {
  await requireActor();
  const project = await loadProject(projectId);

  const checked = validatePhases(drafts);
  if (!checked.ok) {
    throw new PhaseSaveError("INVALID", { row: checked.issue.index + 1, name: checked.issue.name, issue: checked.issue.code });
  }
  const clean = checked.value;

  const existing = await prisma.projectPhase.findMany({
    where: { projectId: project.id },
    select: { id: true, name: true },
  });
  const { removed, foreign } = phaseChanges(existing.map((p) => p.id), clean);
  if (foreign.length > 0) throw new PhaseSaveError("FOREIGN_PHASE");

  if (removed.length > 0) {
    const booked = bookedHoursByPhase(
      await prisma.timeEntry.findMany({
        where: { phaseId: { in: removed }, deletedAt: null },
        select: { phaseId: true, hours: true },
      }).then((rows) => rows.map((r) => ({ phaseId: r.phaseId, hours: num(r.hours as DecimalLike) }))),
    );
    for (const id of removed) {
      const h = booked.get(id);
      if (h) {
        throw new PhaseSaveError("HOURS_BOOKED", { hours: h, name: existing.find((p) => p.id === id)?.name ?? "" });
      }
    }
  }

  const progress = deriveProjectProgress(clean);

  await prisma.$transaction(async (tx) => {
    if (removed.length > 0) {
      await tx.phaseDependency.deleteMany({
        where: { OR: [{ dependentId: { in: removed } }, { requiredId: { in: removed } }] },
      });
      await tx.phaseAssignment.deleteMany({ where: { phaseId: { in: removed } } });
      await tx.projectPhase.updateMany({ where: { parentId: { in: removed } }, data: { parentId: null } });
      await tx.projectPhase.deleteMany({ where: { id: { in: removed }, projectId: project.id } });
    }
    for (const p of clean) {
      const data = {
        name: p.name,
        discipline: p.discipline,
        status: p.status,
        progressPct: p.progressPct,
        startDate: toDate(p.startDate),
        endDate: toDate(p.endDate),
        sortOrder: p.sortOrder,
      };
      if (p.id) {
        // updateMany with the project in the WHERE: an id that slipped past the
        // check above still cannot reach another project's row.
        await tx.projectPhase.updateMany({ where: { id: p.id, projectId: project.id }, data });
      } else {
        await tx.projectPhase.create({ data: { ...data, projectId: project.id } });
      }
    }
    if (progress !== null) {
      await tx.project.update({ where: { id: project.id }, data: { progressPct: progress } });
    }
  });

  return getPhaseScreen(project.id);
}
