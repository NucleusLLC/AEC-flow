/**
 * Data access for the public API (/api/v1). SERVER-ONLY (Prisma).
 *
 * EVERY function here must be called inside `runAsCompany(auth.companyId, …)`
 * after lib/server/api-token.ts has proved the company: the queries carry no
 * companyId of their own and rely on the tenant extension in lib/db.ts to scope
 * them, exactly as for a signed-in member of that practice.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { EstimateImportPlan, ImportProject } from "@/lib/api/v1/estimate-import";

export type ApiProject = { id: string; number: string; name: string; client: string | null };

/** The practice's projects, newest first. Archived projects are left out. */
export async function listApiProjects(): Promise<ApiProject[]> {
  const rows = await prisma.project.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, projectNumber: true, name: true, client: { select: { name: true } } },
  });
  return rows.map((p) => ({ id: p.id, number: p.projectNumber, name: p.name, client: p.client?.name ?? null }));
}

/** One project of this practice, as an import needs it — or null when it is not theirs. */
export async function findImportProject(id: string): Promise<ImportProject | null> {
  // findFirst, not findUnique: the extension puts the company scope in the WHERE.
  const p = await prisma.project.findFirst({
    where: { id },
    select: {
      id: true,
      projectNumber: true,
      name: true,
      siteAddress: true,
      clientId: true,
      client: { select: { name: true } },
    },
  });
  if (!p) return null;
  return {
    id: p.id,
    projectNumber: p.projectNumber,
    name: p.name,
    siteAddress: p.siteAddress ?? null,
    clientId: p.clientId ?? null,
    clientName: p.client?.name ?? null,
  };
}

async function writePlan(plan: EstimateImportPlan, id: string | undefined): Promise<string> {
  return prisma.$transaction(
    async (tx) => {
      const created = await tx.costEstimate.create({
        data: {
          ...(id ? { id } : {}),
          ...plan.estimate,
          budget: plan.estimate.budget as unknown as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
      for (const c of plan.categories) {
        await tx.estimateCategory.create({
          data: {
            estimateId: created.id,
            name: c.name,
            code: null,
            sortOrder: c.sortOrder,
            items: { createMany: { data: c.items } },
          },
        });
      }
      return created.id;
    },
    // A 5 000-line take-off is a few hundred statements; the default 5 s is tight.
    { timeout: 60_000, maxWait: 10_000 },
  );
}

/**
 * Write one imported estimate, header + sections + lines, in ONE transaction.
 *
 * A project's MAIN estimate is keyed by the project's own id (the Estimates
 * workspace and the project's Estimate tab both look it up that way). So an
 * import into a project that has no estimate yet takes that id and becomes the
 * project's estimate; into a project that already has one it is an additional
 * draft with an id of its own, and the existing sheet is never touched.
 */
export async function createImportedEstimate(plan: EstimateImportPlan): Promise<string> {
  const projectId = plan.estimate.projectId;
  let preferred: string | undefined;
  if (projectId) {
    // findFirst so the company scope is in the WHERE (see assertUnlocked in lib/data/estimates.ts).
    const taken = await prisma.costEstimate.findFirst({ where: { id: projectId }, select: { id: true } });
    // A row with that id in ANOTHER practice is invisible here but still holds the
    // primary key; the unique-violation retry below covers it.
    if (!taken) preferred = projectId;
  }
  try {
    return await writePlan(plan, preferred);
  } catch (e) {
    if (preferred && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return writePlan(plan, undefined);
    }
    throw e;
  }
}
