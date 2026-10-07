/**
 * Archive, restore and delete a project. SERVER-ONLY.
 *
 * The rules live in lib/projects/lifecycle.ts; this file only reads and writes.
 * Every query runs through the tenant extension in lib/db.ts, so a project id
 * from another practice simply is not found.
 */
import { prisma } from "@/lib/db";
import { blockingLinks, checkDelete, type DeleteCheck, type ProjectLink, type ProjectLinkKey } from "@/lib/projects/lifecycle";

export class ProjectNotFoundError extends Error {
  constructor() {
    super("Project not found.");
  }
}

async function loadProject(id: string) {
  // findFirst, NOT findUnique: the tenant guard on findUnique reads companyId off
  // the returned row, and this select leaves it out (see updateClient).
  const p = await prisma.project.findFirst({
    where: { id },
    select: { id: true, projectNumber: true, archivedAt: true },
  });
  if (!p) throw new ProjectNotFoundError();
  return p;
}

export async function archiveProject(id: string, actorId: string): Promise<{ archivedAt: string }> {
  const p = await loadProject(id);
  // Archiving twice keeps the first date — that is when it left the list.
  if (p.archivedAt) return { archivedAt: p.archivedAt.toISOString() };
  const now = new Date();
  await prisma.project.update({ where: { id }, data: { archivedAt: now, archivedById: actorId } });
  return { archivedAt: now.toISOString() };
}

export async function restoreProject(id: string): Promise<void> {
  await loadProject(id);
  await prisma.project.update({ where: { id }, data: { archivedAt: null, archivedById: null } });
}

/**
 * Every record outside the project's own phases and activity that points at it.
 * Loose `projectId` strings are matched on the id AND the project number — the
 * schedule, for one, is keyed by the number.
 */
export async function projectLinks(id: string, projectNumber: string): Promise<ProjectLink[]> {
  const ref = { in: [id, projectNumber] };
  const w = { where: { projectId: ref } };
  const counts: Record<ProjectLinkKey, Promise<number>> = {
    meetings: prisma.meetingMinute.count(w),
    attachments: prisma.attachment.count(w),
    drawings: prisma.drawing.count(w),
    estimates: prisma.costEstimate.count(w),
    schedule: prisma.projectSchedule.count(w),
    tasks: prisma.task.count(w),
    purchaseOrders: prisma.purchaseOrder.count(w),
    materials: prisma.materialSelection.count(w),
    deliverables: prisma.designDeliverable.count(w),
    serviceProposals: prisma.serviceProposal.count(w),
    permits: prisma.buildingPermit.count(w),
    generalDocuments: prisma.generalDocument.count(w),
    contracts: prisma.constructionContract.count(w),
    invoices: prisma.invoice.count(w),
    timeEntries: prisma.timeEntry.count(w),
    expenses: prisma.expense.count(w),
    caReports: prisma.caReport.count(w),
    changeOrders: prisma.changeOrder.count(w),
    rfis: prisma.rfiLog.count(w),
    siteInstructions: prisma.siteInstruction.count(w),
    submittals: prisma.submittalLog.count(w),
    delayNotices: prisma.delayNotice.count(w),
    certifications: prisma.progressCertification.count(w),
    punchList: prisma.punchListItem.count(w),
    permitTasks: prisma.permitTask.count(w),
  };
  const keys = Object.keys(counts) as ProjectLinkKey[];
  const values = await Promise.all(keys.map((k) => counts[k]));
  return blockingLinks(Object.fromEntries(keys.map((k, i) => [k, values[i]])));
}

/**
 * Delete an archived project that nothing else refers to, with its phases (and
 * their assignments and dependencies) and its activity log. Re-checks inside the
 * transaction so a record linked between the dialog and the click still blocks.
 */
export async function deleteProject(id: string, typed: string): Promise<DeleteCheck> {
  const p = await loadProject(id);
  const pre = checkDelete({
    archivedAt: p.archivedAt?.toISOString() ?? null,
    projectNumber: p.projectNumber,
    typed,
    links: [],
  });
  if (!pre.ok) return pre;

  const links = await projectLinks(p.id, p.projectNumber);
  if (links.length > 0) return { ok: false, reason: "LINKED", links };

  await prisma.$transaction(async (tx) => {
    const phaseIds = (await tx.projectPhase.findMany({ where: { projectId: p.id }, select: { id: true } })).map((x) => x.id);
    if (phaseIds.length > 0) {
      await tx.phaseDependency.deleteMany({
        where: { OR: [{ dependentId: { in: phaseIds } }, { requiredId: { in: phaseIds } }] },
      });
      await tx.phaseAssignment.deleteMany({ where: { phaseId: { in: phaseIds } } });
      await tx.projectPhase.updateMany({ where: { id: { in: phaseIds } }, data: { parentId: null } });
      await tx.projectPhase.deleteMany({ where: { id: { in: phaseIds } } });
    }
    await tx.activityLog.deleteMany({ where: { projectId: p.id } });
    await tx.project.delete({ where: { id: p.id } });
  });
  return { ok: true };
}
