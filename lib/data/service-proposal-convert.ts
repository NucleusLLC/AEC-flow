/**
 * Convert an accepted Service Proposal into a project (Release D).
 *
 * One transaction: create the project (client, manager, phases, disciplines,
 * value, currency), link the proposal to it, move the proposal to CONVERTED and
 * write the status-history row — so a failure anywhere leaves no orphan project
 * and no proposal that claims a project it does not have. The rules for what
 * carries across live in lib/proposals/convert.ts.
 *
 * A proposal that already points at a project is NOT given a second one: it is
 * only marked CONVERTED, and its project is left exactly as it is.
 */
import "server-only";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { getCurrentCompanyId } from "@/lib/server/tenant";
import { cleanProjectNumber, nextProjectNumber } from "@/lib/data/projects";
import { assertTransition } from "@/lib/proposals/engine/status";
import {
  CONVERT_BLOCKER_MESSAGE,
  convertBlocker,
  projectContractValue,
  projectDisciplines,
  projectPhaseNames,
} from "@/lib/proposals/convert";

export type ConvertResult = { projectId: string; projectNumber: string; created: boolean };

/** Prisma's unique violation (a project number already taken). */
const isUniqueViolation = (e: unknown) =>
  !!e && typeof e === "object" && (e as { code?: string }).code === "P2002";

export async function convertServiceProposalToProject(
  id: string,
  opts: { projectNumber?: string | null } = {},
): Promise<ConvertResult> {
  const session = await getServerSession(authOptions);
  const who = { id: session?.user?.id ?? null, name: session?.user?.name ?? null };
  const companyId = await getCurrentCompanyId();

  const p = await prisma.serviceProposal.findFirstOrThrow({
    where: { id, deletedAt: null },
    include: { phases: true, disciplines: true },
  });
  assertTransition(p.status, "CONVERTED");

  const blocker = convertBlocker(p);
  if (blocker === "status" || blocker === "client") throw new Error(CONVERT_BLOCKER_MESSAGE[blocker]);

  const history = (projectId: string) => ({
    serviceProposalId: id,
    fromStatus: p.status,
    toStatus: "CONVERTED" as const,
    reason: `Converted to project ${projectId}`,
    byId: who.id,
    byName: who.name,
  });

  // Already linked: mark converted, touch nothing on the project.
  if (blocker === "alreadyLinked" && p.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: p.projectId },
      select: { id: true, projectNumber: true },
    });
    if (!project) throw new Error("The project this proposal is linked to no longer exists.");
    await prisma.$transaction([
      prisma.serviceProposal.update({
        where: { id },
        data: { status: "CONVERTED", lockedAt: p.lockedAt ?? new Date() },
      }),
      prisma.serviceProposalStatusHistory.create({ data: history(project.projectNumber) }),
    ]);
    return { projectId: project.id, projectNumber: project.projectNumber, created: false };
  }

  // The manager is whoever converts it — they are taking the work on. Users are
  // not tenant-scoped by the extension, so the company is checked by hand.
  const manager = who.id
    ? await prisma.user.findFirst({ where: { id: who.id, companyId }, select: { id: true } })
    : null;
  if (!manager) throw new Error("Sign in again to create the project.");

  const manual = cleanProjectNumber(opts.projectNumber);
  const phaseNames = projectPhaseNames(p.phases);

  // An automatic number can lose a race with another new project; try again
  // with a fresh one. A typed number is the person's choice, so it is not retried.
  for (let attempt = 1; ; attempt++) {
    const projectNumber = manual ?? (await nextProjectNumber(new Date().getFullYear()));
    try {
      const project = await prisma.$transaction(async (tx) => {
        const created = await tx.project.create({
          data: {
            projectNumber,
            name: p.title.slice(0, 200),
            clientId: p.clientId as string,
            managerId: manager.id,
            status: "ACTIVE",
            description: p.scopeSummary ?? null,
            disciplines: projectDisciplines(p.disciplines),
            contractValue: projectContractValue({
              currency: p.currency,
              grandTotal: p.grandTotal.toString(),
              taxTotal: p.taxTotal.toString(),
            }),
            currency: p.currency,
            notes: `Created from Service Proposal ${p.number}.`,
            phases: {
              create: phaseNames.map((name, i) => ({
                name,
                status: "NOT_STARTED" as const,
                progressPct: 0,
                sortOrder: i,
              })),
            },
          },
          select: { id: true, projectNumber: true, name: true },
        });
        await tx.serviceProposal.update({
          where: { id },
          data: {
            status: "CONVERTED",
            lockedAt: p.lockedAt ?? new Date(),
            projectId: created.id,
            projectName: created.name,
          },
        });
        await tx.serviceProposalStatusHistory.create({ data: history(created.projectNumber) });
        return created;
      });
      return { projectId: project.id, projectNumber: project.projectNumber, created: true };
    } catch (e) {
      if (isUniqueViolation(e)) {
        if (manual) throw new Error(`Project number ${manual} is already in use. Choose another.`);
        if (attempt < 3) continue;
      }
      throw e;
    }
  }
}
