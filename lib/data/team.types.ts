/**
 * Team types & client-safe constants — split out from team.ts so that
 * `"use client"` components can import VALUES (label maps, pure helpers)
 * without dragging the Prisma/`pg` driver into the browser bundle.
 * This module MUST NOT import `@/lib/db`.
 */

export type UserRole = "ADMIN" | "DIRECTOR" | "MANAGER" | "STAFF" | "VIEWER";
export type Discipline =
  | "ARCHITECTURE"
  | "STRUCTURAL"
  | "INTERIOR"
  | "MEP"
  | "PROJECT_MANAGEMENT"
  | "CONSTRUCTION";
export type Department = "DESIGN" | "ENGINEERING" | "MANAGEMENT" | "ADMIN" | "FINANCE";
export type UserStatus = "ACTIVE" | "INACTIVE" | "ON_LEAVE";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  discipline: Discipline | null;
  department: Department;
  status: UserStatus;
  officeLocation: string | null;
  capacity: number; // % availability target
  utilisation: number; // % currently allocated
  activeProjects: number;
  joiningDate: string;
};

export type TeamSummary = {
  total: number;
  active: number;
  onLeave: number;
  avgUtilisation: number;
  overAllocated: number;
};

export const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "Admin",
  DIRECTOR: "Director",
  MANAGER: "Manager",
  STAFF: "Staff",
  VIEWER: "Viewer",
};

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  ARCHITECTURE: "Architecture",
  STRUCTURAL: "Structural",
  INTERIOR: "Interior",
  MEP: "MEP",
  PROJECT_MANAGEMENT: "Project Mgmt",
  CONSTRUCTION: "Construction",
};

export const DEPARTMENT_LABEL: Record<Department, string> = {
  DESIGN: "Design",
  ENGINEERING: "Engineering",
  MANAGEMENT: "Management",
  ADMIN: "Admin",
  FINANCE: "Finance",
};

export function summarizeTeam(list: TeamMember[]): TeamSummary {
  const active = list.filter((m) => m.status !== "INACTIVE");
  const avgUtil =
    active.length > 0
      ? Math.round(active.reduce((n, m) => n + m.utilisation, 0) / active.length)
      : 0;
  return {
    total: list.length,
    active: list.filter((m) => m.status === "ACTIVE").length,
    onLeave: list.filter((m) => m.status === "ON_LEAVE").length,
    avgUtilisation: avgUtil,
    overAllocated: list.filter((m) => m.utilisation > 100).length,
  };
}

/* ───────────────────────────────────────────────────────────────────────────
 * DETAIL LAYER — for the `/team/[id]` member page. ADDITIVE ONLY: the directory
 * exports above are untouched. Extra fields live in a map keyed by member id and
 * merged onto the directory row by getTeamMember(). Swap for a Prisma query later.
 * ────────────────────────────────────────────────────────────────────────── */

export type MemberProject = {
  id: string;
  name: string;
  role: string;
};

export type TeamMemberRecord = TeamMember & {
  bio: string | null;
  skills: string[];
  annualLeaveTotal: number;
  annualLeaveTaken: number;
  currentProjects: MemberProject[];
};

/**
 * Payload the create/edit member form submits. Client-safe (no Prisma types) so
 * the `"use client"` form can import it. `id` is present only for edit (create
 * lets Prisma generate a cuid). `joiningDate` is "" / null or an ISO date string;
 * `skills` accepts an array or a comma-separated string. The remaining optional
 * fields default server-side when the form omits them.
 */
export type TeamMemberWriteInput = {
  id?: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  discipline: Discipline | null;
  department: Department;
  status: UserStatus;
  officeLocation: string | null;
  capacity: number;
  utilisation?: number;
  bio?: string | null;
  skills?: string[] | string;
  annualLeaveTotal?: number;
  annualLeaveTaken?: number;
  joiningDate?: string | null;
};
