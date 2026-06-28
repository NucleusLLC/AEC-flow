/**
 * Projects data-access types & client-safe helpers.
 *
 * This sibling module holds ONLY declarations that are safe to import from
 * `"use client"` components: type definitions, label maps, and pure transforms.
 * It MUST NOT import `@/lib/db` (Prisma), so pulling these into the browser
 * bundle never drags the Postgres driver along with it.
 */

export type ProjectStatus = "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Discipline =
  | "ARCHITECTURE"
  | "STRUCTURAL"
  | "INTERIOR"
  | "MEP"
  | "PROJECT_MANAGEMENT";
export type PhaseStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED";

export type ProjectPhase = {
  id: string;
  name: string;
  discipline: Discipline | null;
  status: PhaseStatus;
  progressPct: number;
  startDate: string | null;
  endDate: string | null;
};

export type ProjectTeamMember = {
  name: string;
  role: string;
  discipline: Discipline | null;
};

export type ProjectActivity = {
  id: string;
  action: string;
  target: string;
  at: string;
};

/** Full record — what the detail page consumes. */
export type ProjectRecord = {
  id: string;
  projectNumber: string;
  name: string;
  clientId: string;
  clientName: string;
  manager: string;
  status: ProjectStatus;
  priority: Priority;
  description: string | null;
  siteAddress: string | null;
  disciplines: Discipline[];
  startDate: string | null;
  targetEndDate: string | null;
  completedAt: string | null;
  progressPct: number;
  value: number;
  currency: string;
  phases: ProjectPhase[];
  team: ProjectTeamMember[];
  activity: ProjectActivity[];
};

/** Lean row — what the list page consumes. */
export type ProjectListItem = {
  id: string;
  projectNumber: string;
  name: string;
  clientName: string;
  manager: string;
  status: ProjectStatus;
  priority: Priority;
  disciplines: Discipline[];
  progressPct: number;
  phasesCount: number;
  openPhases: number;
  startDate: string | null;
  targetEndDate: string | null;
  value: number;
  isOverdue: boolean;
};

export type ProjectsSummary = {
  total: number;
  active: number;
  onHold: number;
  completed: number;
  atRisk: number;
  portfolioValue: number;
  avgProgress: number;
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  ARCHITECTURE: "Architecture",
  STRUCTURAL: "Structural",
  INTERIOR: "Interior",
  MEP: "MEP",
  PROJECT_MANAGEMENT: "Project Mgmt",
};

/**
 * Payload the create/edit form submits. `clientName` and `manager` are display
 * names (resolved to ids server-side); dates are "" / null or ISO date strings.
 * Client-safe (no Prisma types) so the `"use client"` form can import it without
 * dragging the Postgres driver into the browser bundle.
 */
export type ProjectWriteInput = {
  name: string;
  /** Client display name — resolved to clientId via Client.name. */
  clientName: string;
  /** Manager display name — resolved to managerId via User.name. */
  manager: string;
  status?: ProjectStatus;
  priority?: Priority;
  disciplines?: Discipline[];
  description?: string | null;
  siteAddress?: string | null;
  startDate?: string | null;
  targetEndDate?: string | null;
  value?: number | null;
  currency?: string;
};

export function summarizeProjects(list: ProjectListItem[]): ProjectsSummary {
  const active = list.filter((p) => p.status === "ACTIVE");
  const avgProgress =
    active.length > 0 ? Math.round(active.reduce((n, p) => n + p.progressPct, 0) / active.length) : 0;
  return {
    total: list.length,
    active: active.length,
    onHold: list.filter((p) => p.status === "ON_HOLD").length,
    completed: list.filter((p) => p.status === "COMPLETED").length,
    atRisk: list.filter((p) => p.isOverdue || (p.status === "ACTIVE" && p.priority === "CRITICAL")).length,
    portfolioValue: active.reduce((n, p) => n + p.value, 0),
    avgProgress,
  };
}
