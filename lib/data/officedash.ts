/**
 * Office Dash reads. SERVER-ONLY.
 *
 * Every query runs through the tenant extension in lib/db.ts, so the TV shows the
 * signed-in practice's work and nobody else's. The rules live in
 * lib/officedash/board.ts; this file only gathers the records.
 */
import { prisma } from "@/lib/db";
import { listBuildingPermits } from "@/lib/data/building-permits";
import { isClosedStatus } from "@/lib/building-permits/types";
import { daysWithAuthority, permitVersion } from "@/lib/building-permits/register";
import {
  buildBoard,
  PIPELINE_STAGE,
  type Board,
  type BoardPermit,
  type BoardProject,
  type BoardProposal,
  type BoardTask,
} from "@/lib/officedash/board";

const ymd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

/** Today in the office's own time zone — the server runs in UTC. */
export function officeToday(timeZone = process.env.OFFICE_TIME_ZONE || "America/Aruba"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function getOfficeBoard(today = officeToday()): Promise<Board> {
  const [projects, proposals, permits, tasks] = await Promise.all([
    prisma.project.findMany({
      where: { archivedAt: null, status: { in: ["ACTIVE", "ON_HOLD"] } },
      include: {
        client: { select: { name: true } },
        manager: { select: { name: true } },
        phases: { select: { name: true, status: true, sortOrder: true }, orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.serviceProposal.findMany({
      where: { status: { in: Object.keys(PIPELINE_STAGE) as never[] } },
      select: { id: true, number: true, title: true, clientName: true, status: true, issuedAt: true, updatedAt: true },
    }),
    listBuildingPermits(),
    prisma.task.findMany({
      where: { status: { not: "DONE" }, kind: "TASK" },
      select: { id: true, title: true, assignee: true, dueDate: true, projectId: true, priority: true },
    }),
  ]);

  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  const boardProjects: BoardProject[] = projects.map((p) => ({
    id: p.id,
    number: p.projectNumber,
    name: p.name,
    client: p.client.name,
    manager: p.manager.name,
    status: p.status as BoardProject["status"],
    progressPct: p.progressPct,
    phase: p.phases.find((ph) => ph.status === "IN_PROGRESS")?.name ?? null,
    phaseCount: p.phases.length,
    targetEnd: ymd(p.targetEndDate),
  }));

  const boardProposals: BoardProposal[] = proposals.map((s) => ({
    id: s.id,
    number: s.number,
    title: s.title,
    client: s.clientName,
    status: s.status,
    // How long it has waited: from the day it went to the client when it is with them.
    since: ymd(PIPELINE_STAGE[s.status] === "WITH CLIENT" && s.issuedAt ? s.issuedAt : s.updatedAt)!,
  }));

  const boardPermits: BoardPermit[] = permits
    .filter((p) => !isClosedStatus(p.status))
    .map((p) => ({
      id: p.id,
      reference: p.reference,
      title: p.title,
      project: p.projectName,
      status: p.status,
      authority: p.authority,
      version: permitVersion(p)?.version ?? null,
      submittedAt: p.submittedAt,
      daysIn: daysWithAuthority(p, today),
      openResponseDueAt: p.openResponseDueAt,
      revisionDueAt: p.revisionDueAt,
      targetDecisionAt: p.targetDecisionAt,
    }));

  const boardTasks: BoardTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    assignee: t.assignee,
    dueDate: ymd(t.dueDate),
    project: t.projectId ? (projectName.get(t.projectId) ?? null) : null,
    priority: t.priority,
  }));

  return buildBoard({ today, projects: boardProjects, proposals: boardProposals, permits: boardPermits, tasks: boardTasks });
}
