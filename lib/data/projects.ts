/**
 * Projects data-access layer.
 *
 * IMPORTANT (single-tenant -> SaaS hedge): pages call functions from this
 * module rather than touching Prisma directly. When the suite becomes
 * multi-tenant, query scoping (orgId) gets added HERE and nowhere else.
 *
 * Backed by the database via Prisma. Pure transforms (summarizeProjects) and
 * the label maps stay app-side so call sites remain unchanged.
 */

import { prisma } from "@/lib/db";
import { getCurrentCompanyId } from "@/lib/server/tenant";
import { getSystemCurrency } from "@/lib/format";
import type {
  Discipline,
  PhaseStatus,
  Priority,
  ProjectListItem,
  ProjectPhase,
  ProjectRecord,
  ProjectStatus,
  ProjectTeamMember,
  ProjectWriteInput,
} from "./projects.types";

// Re-export client-safe types & helpers so existing call sites
// (`@/lib/data/projects`) keep working unchanged.
export * from "./projects.types";

// Reference "today" for overdue calculations (kept stable for placeholder data).
const TODAY = "2026-06-18";

const OPEN_PHASE: PhaseStatus[] = ["NOT_STARTED", "IN_PROGRESS", "ON_HOLD"];

const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

function isOverdue(p: { targetEndDate: string | null; status: ProjectStatus }): boolean {
  if (!p.targetEndDate) return false;
  if (p.status === "COMPLETED" || p.status === "CANCELLED") return false;
  return p.targetEndDate < TODAY;
}

const STATUS_ORDER: Record<ProjectStatus, number> = {
  ACTIVE: 0,
  ON_HOLD: 1,
  COMPLETED: 2,
  CANCELLED: 3,
};

export async function getProjects(): Promise<ProjectListItem[]> {
  const projects = await prisma.project.findMany({
    include: { client: true, manager: true, phases: true },
  });

  return projects
    .map((p): ProjectListItem => {
      const targetEndDate = ymd(p.targetEndDate);
      return {
        id: p.id,
        projectNumber: p.projectNumber,
        name: p.name,
        clientName: p.client.name,
        manager: p.manager.name,
        status: p.status as ProjectStatus,
        priority: p.priority as Priority,
        disciplines: p.disciplines as Discipline[],
        progressPct: p.progressPct,
        phasesCount: p.phases.length,
        openPhases: p.phases.filter((ph) => OPEN_PHASE.includes(ph.status as PhaseStatus)).length,
        startDate: ymd(p.startDate),
        targetEndDate,
        value: Number(p.contractValue ?? 0),
        isOverdue: isOverdue({ targetEndDate, status: p.status as ProjectStatus }),
      };
    })
    .sort((a, b) => {
      if (STATUS_ORDER[a.status] !== STATUS_ORDER[b.status]) {
        return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      }
      return (b.targetEndDate ?? "").localeCompare(a.targetEndDate ?? "");
    });
}

export async function getProject(id: string): Promise<ProjectRecord | null> {
  const p = await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      manager: true,
      phases: {
        orderBy: { sortOrder: "asc" },
        include: { assignments: { include: { user: true } } },
      },
    },
  });

  if (!p) return null;

  const phases: ProjectPhase[] = p.phases.map((ph) => ({
    id: ph.id,
    name: ph.name,
    discipline: (ph.discipline as Discipline | null) ?? null,
    status: ph.status as PhaseStatus,
    progressPct: ph.progressPct,
    startDate: ymd(ph.startDate),
    endDate: ymd(ph.endDate),
  }));

  const team: ProjectTeamMember[] = [];
  const seen = new Set<string>();
  for (const ph of p.phases) {
    for (const a of ph.assignments) {
      if (seen.has(a.user.name)) continue;
      seen.add(a.user.name);
      team.push({
        name: a.user.name,
        role: a.roleName ?? "Team Member",
        discipline: (a.user.discipline as Discipline | null) ?? null,
      });
    }
  }

  return {
    id: p.id,
    projectNumber: p.projectNumber,
    name: p.name,
    clientId: p.clientId,
    clientName: p.client.name,
    manager: p.manager.name,
    status: p.status as ProjectStatus,
    priority: p.priority as Priority,
    description: p.description,
    siteAddress: p.siteAddress,
    disciplines: p.disciplines as Discipline[],
    startDate: ymd(p.startDate),
    targetEndDate: ymd(p.targetEndDate),
    completedAt: ymd(p.completedAt),
    progressPct: p.progressPct,
    value: Number(p.contractValue ?? 0),
    currency: p.currency,
    phases,
    team,
    activity: [],
  };
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

/**
 * Server-side alias of the client-safe ProjectWriteInput (defined in
 * ./projects.types). Existing call sites that import `ProjectInput` from
 * `@/lib/data/projects` keep working unchanged.
 */
export type ProjectInput = ProjectWriteInput;

/**
 * Standard 6-phase set seeded on project create so the project is immediately
 * usable. Mirrors the helper in prisma/core-seed-data.ts (ids concept→handover);
 * here the phase id is auto-cuid — only seed.ts uses composite ids. sortOrder is
 * the array index; all phases start NOT_STARTED at 0%.
 */
const STANDARD_PHASES: { name: string }[] = [
  { name: "Concept Design" },
  { name: "Schematic Design" },
  { name: "Detailed Design" },
  { name: "Tender Documentation" },
  { name: "Construction Support" },
  { name: "Handover" },
];

const toDate = (s?: string | null): Date | null => (s ? new Date(s) : null);

/** Resolve a client display name to its id, or throw a clear error. */
async function resolveClientId(name: string): Promise<string> {
  const client = await prisma.client.findFirst({ where: { name } });
  if (!client) throw new Error(`Client not found: "${name}"`);
  return client.id;
}

/**
 * Resolve a manager display name to a User id. Falls back to the most senior
 * user (role ascending → ADMIN/DIRECTOR first) so a write never fails on an
 * unmatched name; throws only if no users exist at all.
 */
async function resolveManagerId(name: string): Promise<string> {
  const companyId = await getCurrentCompanyId();
  const byName = await prisma.user.findFirst({ where: { name, companyId }, select: { id: true } });
  if (byName) return byName.id;
  const fallback = await prisma.user.findFirst({
    where: { companyId },
    orderBy: { role: "asc" },
    select: { id: true },
  });
  if (!fallback) throw new Error("No users exist to assign as the project manager.");
  return fallback.id;
}

/** Next sequential project number, pattern ZA-YYYY-NNN (global max + 1, padded 3). */
async function nextProjectNumber(year = 2026): Promise<string> {
  const rows = await prisma.project.findMany({ select: { projectNumber: true } });
  let max = 0;
  for (const { projectNumber } of rows) {
    const m = /(\d+)$/.exec(projectNumber);
    if (m && Number(m[1]) > max) max = Number(m[1]);
  }
  return `ZA-${year}-${String(max + 1).padStart(3, "0")}`;
}

export async function createProject(input: ProjectInput): Promise<{ id: string; projectNumber: string }> {
  if (!input.name?.trim()) throw new Error("name is required");

  const [clientId, managerId, projectNumber] = await Promise.all([
    resolveClientId(input.clientName),
    resolveManagerId(input.manager),
    nextProjectNumber(),
  ]);

  const p = await prisma.project.create({
    data: {
      projectNumber,
      name: input.name,
      clientId,
      managerId,
      status: input.status ?? "ACTIVE",
      priority: input.priority ?? "MEDIUM",
      description: input.description ?? null,
      siteAddress: input.siteAddress ?? null,
      disciplines: input.disciplines ?? [],
      startDate: toDate(input.startDate),
      targetEndDate: toDate(input.targetEndDate),
      progressPct: 0,
      contractValue: input.value ?? null,
      currency: input.currency ?? getSystemCurrency(),
      phases: {
        create: STANDARD_PHASES.map((ph, i) => ({
          name: ph.name,
          status: "NOT_STARTED" as PhaseStatus,
          progressPct: 0,
          sortOrder: i,
        })),
      },
    },
  });

  return { id: p.id, projectNumber: p.projectNumber };
}

/** Update scalar fields only — phases are not rewritten here. */
export async function updateProject(id: string, input: ProjectInput): Promise<{ id: string }> {
  const [clientId, managerId] = await Promise.all([
    resolveClientId(input.clientName),
    resolveManagerId(input.manager),
  ]);

  const p = await prisma.project.update({
    where: { id },
    data: {
      name: input.name,
      clientId,
      managerId,
      status: input.status ?? "ACTIVE",
      priority: input.priority ?? "MEDIUM",
      description: input.description ?? null,
      siteAddress: input.siteAddress ?? null,
      disciplines: input.disciplines ?? [],
      startDate: toDate(input.startDate),
      targetEndDate: toDate(input.targetEndDate),
      contractValue: input.value ?? null,
      currency: input.currency ?? getSystemCurrency(),
    },
  });

  return { id: p.id };
}

/** projectNumber → { location, client } — used to enrich project-list landings across sections. */
export async function getProjectDirectory(): Promise<Record<string, { location: string; client: string }>> {
  const projects = await prisma.project.findMany({ include: { client: true } });
  return Object.fromEntries(
    projects.map((p) => [p.projectNumber, { location: p.siteAddress ?? "—", client: p.client.name }]),
  );
}
