/** Site Instructions repository (Prisma-first, seed fallback). */
import { prisma } from "@/lib/db";
import { caRead, ymd, ymdReq } from "@/lib/data/ca/repo";
import { SEED_SITE_INSTRUCTIONS } from "@/lib/ca/seed-data";
import type { SiteInstruction, CaDiscipline, ImpactLevel, SiteInstructionStatus } from "@/lib/ca/types";

export type SiteInstructionInput = {
  projectId: string;
  projectName?: string | null;
  title: string;
  description?: string | null;
  issuedBy?: string | null;
  issuedTo?: string | null;
  discipline?: CaDiscipline;
  costImpact?: ImpactLevel;
  scheduleImpact?: ImpactLevel;
  linkedChangeOrderId?: string | null;
  status?: SiteInstructionStatus;
};

type Row = Awaited<ReturnType<typeof prisma.siteInstruction.findFirstOrThrow>>;

function toDto(r: Row): SiteInstruction {
  return {
    id: r.id,
    projectId: r.projectId,
    projectName: r.projectName ?? r.projectId,
    instructionNumber: r.instructionNumber,
    title: r.title,
    description: r.description,
    issuedBy: r.issuedBy,
    issuedTo: r.issuedTo,
    discipline: r.discipline,
    costImpact: r.costImpact,
    scheduleImpact: r.scheduleImpact,
    linkedChangeOrderId: r.linkedChangeOrderId,
    status: r.status,
    dateIssued: ymd(r.dateIssued),
    createdAt: ymdReq(r.createdAt),
    updatedAt: ymdReq(r.updatedAt),
  };
}

export async function listSiteInstructions(projectId?: string): Promise<SiteInstruction[]> {
  return caRead(
    async () => {
      const rows = await prisma.siteInstruction.findMany({
        where: projectId ? { projectId } : undefined,
        orderBy: { createdAt: "desc" },
      });
      return rows.map(toDto);
    },
    () =>
      SEED_SITE_INSTRUCTIONS.filter((s) => !projectId || s.projectId === projectId).sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
  );
}

export async function getSiteInstruction(id: string): Promise<SiteInstruction | null> {
  return caRead(
    async () => {
      const row = await prisma.siteInstruction.findFirst({ where: { OR: [{ id }, { instructionNumber: id }] } });
      return row ? toDto(row) : null;
    },
    () => SEED_SITE_INSTRUCTIONS.find((s) => s.id === id || s.instructionNumber === id) ?? null,
  );
}

export async function createSiteInstruction(input: SiteInstructionInput): Promise<SiteInstruction> {
  const existing = await listSiteInstructions(input.projectId);
  const status = input.status ?? "DRAFT";
  const row = await prisma.siteInstruction.create({
    data: {
      projectId: input.projectId,
      projectName: input.projectName ?? null,
      instructionNumber: nextSiteInstructionNumber(input.projectId, existing.map((s) => s.instructionNumber)),
      title: input.title,
      description: input.description ?? null,
      issuedBy: input.issuedBy ?? null,
      issuedTo: input.issuedTo ?? null,
      discipline: input.discipline ?? "OTHER",
      costImpact: input.costImpact ?? "NONE",
      scheduleImpact: input.scheduleImpact ?? "NONE",
      linkedChangeOrderId: input.linkedChangeOrderId ?? null,
      status,
      dateIssued: status === "DRAFT" ? null : new Date(),
    },
  });
  return toDto(row);
}

export async function updateSiteInstruction(id: string, input: Partial<SiteInstructionInput>): Promise<SiteInstruction> {
  const current = await prisma.siteInstruction.findUniqueOrThrow({ where: { id } });
  // Stamp the issue date the first time it leaves DRAFT.
  const issuing = input.status && input.status !== "DRAFT" && current.status === "DRAFT" && !current.dateIssued;
  const row = await prisma.siteInstruction.update({
    where: { id },
    data: {
      title: input.title ?? current.title,
      description: input.description ?? current.description,
      issuedBy: input.issuedBy ?? current.issuedBy,
      issuedTo: input.issuedTo ?? current.issuedTo,
      discipline: input.discipline ?? current.discipline,
      costImpact: input.costImpact ?? current.costImpact,
      scheduleImpact: input.scheduleImpact ?? current.scheduleImpact,
      linkedChangeOrderId: input.linkedChangeOrderId ?? current.linkedChangeOrderId,
      status: input.status ?? current.status,
      dateIssued: issuing ? new Date() : current.dateIssued,
    },
  });
  return toDto(row);
}

export function nextSiteInstructionNumber(projectId: string, existing: string[], year = 2026): string {
  const suffix = projectId.replace(/[^0-9]/g, "").slice(-3).padStart(3, "0");
  let max = 0;
  for (const n of existing) {
    const m = /(\d+)$/.exec(n);
    if (m && Number(m[1]) > max) max = Number(m[1]);
  }
  return `SI-${year}-${suffix}-${String(max + 1).padStart(3, "0")}`;
}
