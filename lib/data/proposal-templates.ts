/**
 * Proposal-template data-access layer (Prisma → ProposalTemplate table).
 *
 * SERVER-ONLY: imports `@/lib/db`, so never import from a client component
 * (see [[aec-prisma-client-boundary]]). The client-safe `ProposalTemplate`
 * VIEW type lives in `lib/data/settings.ts`.
 *
 * The schema's ProposalTemplate has { name, discipline?, content Json, isDefault,
 * createdAt }. The settings UI also wants a free-text discipline label and a
 * `sections` count, which we stash in the `content` JSON blob so no migration is
 * needed. `updatedAt` in the view maps to `createdAt`.
 */
import { prisma } from "@/lib/db";
import type { ProposalTemplate } from "./settings";

type TemplateContent = { discipline?: string; sections?: number };

const ymd = (d: Date): string => d.toISOString().slice(0, 10);

function toView(row: {
  id: string;
  name: string;
  content: unknown;
  isDefault: boolean;
  createdAt: Date;
}): ProposalTemplate {
  const content = (row.content ?? {}) as TemplateContent;
  return {
    id: row.id,
    name: row.name,
    discipline: content.discipline?.trim() || "General",
    sections: typeof content.sections === "number" ? content.sections : 1,
    isDefault: row.isDefault,
    updatedAt: ymd(row.createdAt),
  };
}

export async function listTemplates(): Promise<ProposalTemplate[]> {
  const rows = await prisma.proposalTemplate.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true, content: true, isDefault: true, createdAt: true },
  });
  return rows.map(toView);
}

export type TemplateInput = { name: string; discipline: string; sections: number };

function clampSections(n: number): number {
  return Math.max(1, Math.min(40, Math.round(n) || 1));
}

export async function createTemplate(input: TemplateInput): Promise<ProposalTemplate> {
  const row = await prisma.proposalTemplate.create({
    data: {
      name: input.name.trim() || "Untitled template",
      content: { discipline: input.discipline.trim() || "General", sections: clampSections(input.sections) },
    },
    select: { id: true, name: true, content: true, isDefault: true, createdAt: true },
  });
  return toView(row);
}

export async function updateTemplate(id: string, input: TemplateInput): Promise<ProposalTemplate> {
  const row = await prisma.proposalTemplate.update({
    where: { id },
    data: {
      name: input.name.trim() || "Untitled template",
      content: { discipline: input.discipline.trim() || "General", sections: clampSections(input.sections) },
    },
    select: { id: true, name: true, content: true, isDefault: true, createdAt: true },
  });
  return toView(row);
}

export async function duplicateTemplate(id: string): Promise<ProposalTemplate> {
  // findFirst, NOT findUnique. The tenant extension's findUnique guard reads
  // `companyId` off the returned row; this narrow `select` leaves it undefined, so
  // for a signed-in user the guard rejected every row and "Duplicate" always failed
  // with "Template not found." findFirst puts the company scope in the WHERE, and
  // `id` is unique, so it is the same single row.
  const src = await prisma.proposalTemplate.findFirst({
    where: { id },
    select: { name: true, discipline: true, content: true },
  });
  if (!src) throw new Error("Template not found.");
  const row = await prisma.proposalTemplate.create({
    data: {
      name: `${src.name} (copy)`,
      discipline: src.discipline,
      content: (src.content ?? {}) as object,
      isDefault: false,
    },
    select: { id: true, name: true, content: true, isDefault: true, createdAt: true },
  });
  return toView(row);
}

export async function deleteTemplate(id: string): Promise<void> {
  // Templates referenced by proposals can't be hard-deleted (FK); surface a clear error.
  const used = await prisma.proposal.count({ where: { templateId: id } });
  if (used > 0) {
    throw new Error(`Can't delete — ${used} proposal(s) still use this template.`);
  }
  await prisma.proposalTemplate.delete({ where: { id } });
}

/** Make one template the sole default (atomic: clear all, then set one). */
export async function setDefaultTemplate(id: string): Promise<void> {
  await prisma.$transaction([
    prisma.proposalTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
    prisma.proposalTemplate.update({ where: { id }, data: { isDefault: true } }),
  ]);
}
