/**
 * Team data-access layer (placeholder — see lib/data/clients.ts for the
 * single-tenant -> SaaS hedge rationale).
 */

import { prisma } from "@/lib/db";
import type {
  UserRole,
  Discipline,
  Department,
  UserStatus,
  TeamMember,
  MemberProject,
  TeamMemberRecord,
  TeamMemberWriteInput,
} from "./team.types";

// Re-export client-safe types & constants (label maps, summarizeTeam) so existing
// `@/lib/data/team` server-side imports keep working. Client components should
// import these from `@/lib/data/team.types` to avoid bundling the Prisma driver.
export * from "./team.types";

const ymd = (d: Date | null | undefined): string =>
  d ? d.toISOString().slice(0, 10) : "";

export async function getTeam(): Promise<TeamMember[]> {
  const roleOrder: Record<UserRole, number> = {
    DIRECTOR: 0,
    MANAGER: 1,
    ADMIN: 2,
    STAFF: 3,
    VIEWER: 4,
  };

  const users = await prisma.user.findMany({
    include: {
      managedProjects: true,
      phases: { include: { phase: true } },
    },
  });

  const team: TeamMember[] = users.map((u) => {
    const projectIds = new Set<string>();
    for (const p of u.managedProjects) {
      if (p.status !== "CANCELLED") projectIds.add(p.id);
    }
    for (const a of u.phases) projectIds.add(a.phase.projectId);

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role as UserRole,
      discipline: (u.discipline as Discipline | null) ?? null,
      department: (u.department as Department) ?? "ADMIN",
      status: u.status as UserStatus,
      officeLocation: u.officeLocation,
      capacity: u.capacity,
      utilisation: u.utilisation,
      activeProjects: projectIds.size,
      joiningDate: ymd(u.joiningDate) ?? "",
    };
  });

  return team.sort((a, b) => {
    if (roleOrder[a.role] !== roleOrder[b.role]) return roleOrder[a.role] - roleOrder[b.role];
    return a.name.localeCompare(b.name);
  });
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

export type MemberInput = {
  name: string;
  email: string;
  phone?: string | null;
  role?: UserRole;
  discipline?: Discipline | null;
  department?: Department | null;
  status?: UserStatus;
  capacity?: number;
  utilisation?: number;
  bio?: string | null;
  skills?: string[];
  annualLeaveTotal?: number;
  annualLeaveTaken?: number;
  officeLocation?: string | null;
  joiningDate?: string | null;
};

/** Scalar fields shared by create and update. */
function memberScalars(input: MemberInput) {
  return {
    name: input.name,
    email: input.email,
    phone: input.phone ?? null,
    role: input.role ?? "STAFF",
    discipline: input.discipline ?? null,
    department: input.department ?? null,
    status: input.status ?? "ACTIVE",
    capacity: input.capacity ?? 100,
    utilisation: input.utilisation ?? 0,
    bio: input.bio ?? null,
    skills: input.skills ?? [],
    annualLeaveTotal: input.annualLeaveTotal ?? 22,
    annualLeaveTaken: input.annualLeaveTaken ?? 0,
    officeLocation: input.officeLocation ?? null,
    joiningDate: input.joiningDate ? new Date(input.joiningDate) : null,
  };
}

export async function createMember(input: MemberInput): Promise<{ id: string }> {
  const u = await prisma.user.create({ data: memberScalars(input) });
  return { id: u.id };
}

export async function updateMember(id: string, input: MemberInput): Promise<{ id: string }> {
  const u = await prisma.user.update({ where: { id }, data: memberScalars(input) });
  return { id: u.id };
}

/* ------------------------------------------------------------------ */
/* Form writes (mirror lib/data/proposals.ts createProposal/update)   */
/* ------------------------------------------------------------------ */

/** Scalar columns from the form payload, shared by create and update. */
function writeScalars(input: TeamMemberWriteInput) {
  const skills = Array.isArray(input.skills)
    ? input.skills
    : typeof input.skills === "string"
      ? input.skills.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  return {
    name: input.name,
    email: input.email,
    phone: input.phone ?? null,
    role: input.role ?? "STAFF",
    discipline: input.discipline ?? null,
    department: input.department ?? null,
    status: input.status ?? "ACTIVE",
    capacity: input.capacity ?? 100,
    utilisation: input.utilisation ?? 0,
    bio: input.bio ?? null,
    skills,
    annualLeaveTotal: input.annualLeaveTotal ?? 22,
    annualLeaveTaken: input.annualLeaveTaken ?? 0,
    officeLocation: input.officeLocation ?? null,
    joiningDate: input.joiningDate ? new Date(input.joiningDate) : null,
  };
}

/** Create a user from the member form; lets Prisma generate the cuid id. */
export async function createTeamMember(input: TeamMemberWriteInput): Promise<string> {
  const u = await prisma.user.create({
    data: { ...writeScalars(input), passwordHash: null },
  });
  return u.id;
}

/** Update an existing user from the member form. */
export async function updateTeamMember(input: TeamMemberWriteInput): Promise<string> {
  if (!input.id) throw new Error("A member id is required to update.");
  const u = await prisma.user.update({
    where: { id: input.id },
    data: writeScalars(input),
  });
  return u.id;
}

/** Settings → Members & Roles: change just a member's role. */
export async function setMemberRole(id: string, role: UserRole): Promise<void> {
  await prisma.user.update({ where: { id }, data: { role } });
}

/** Settings → Members & Roles: change just a member's status. */
export async function setMemberStatus(id: string, status: UserStatus): Promise<void> {
  await prisma.user.update({ where: { id }, data: { status } });
}

export async function getTeamMember(id: string): Promise<TeamMemberRecord | null> {
  const u = await prisma.user.findUnique({
    where: { id },
    include: {
      managedProjects: true,
      phases: { include: { phase: { include: { project: true } } } },
    },
  });
  if (!u) return null;

  // activeProjects — distinct non-cancelled managed projects ∪ assigned phases' projects.
  const projectIds = new Set<string>();
  for (const p of u.managedProjects) {
    if (p.status !== "CANCELLED") projectIds.add(p.id);
  }
  for (const a of u.phases) projectIds.add(a.phase.projectId);

  // currentProjects — distinct projects the user manages or is assigned to,
  // deduped by project id (manager role takes precedence over assignment role).
  const projectMap = new Map<string, MemberProject>();
  for (const p of u.managedProjects) {
    projectMap.set(p.id, { id: p.projectNumber, name: p.name, role: "Project Manager" });
  }
  for (const a of u.phases) {
    const proj = a.phase.project;
    if (!projectMap.has(proj.id)) {
      projectMap.set(proj.id, {
        id: proj.projectNumber,
        name: proj.name,
        role: a.roleName ?? "Team Member",
      });
    }
  }

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role as UserRole,
    discipline: (u.discipline as Discipline | null) ?? null,
    department: (u.department as Department) ?? "ADMIN",
    status: u.status as UserStatus,
    officeLocation: u.officeLocation,
    capacity: u.capacity,
    utilisation: u.utilisation,
    activeProjects: projectIds.size,
    joiningDate: ymd(u.joiningDate) ?? "",
    bio: u.bio,
    skills: u.skills,
    annualLeaveTotal: u.annualLeaveTotal,
    annualLeaveTaken: u.annualLeaveTaken,
    currentProjects: Array.from(projectMap.values()),
  };
}
