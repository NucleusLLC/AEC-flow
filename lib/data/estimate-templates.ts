/**
 * Cost-Estimation — reusable estimate Templates (firm library), DB-backed.
 *
 * SERVER-ONLY (Prisma → pg). The EstimateTemplate/TemplateCategory types + the
 * static seed live in the client-safe `lib/data/estimate-presets.ts`; this module
 * only adds the DB read/write. See [[aec-prisma-client-boundary]].
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { EstimateTemplate, TemplateCategory } from "@/lib/data/estimate-presets";

export async function getTemplates(): Promise<EstimateTemplate[]> {
  const rows = await prisma.estimateTemplate.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    categories: (r.categories as unknown as TemplateCategory[]) ?? [],
  }));
}

/**
 * Upsert each template by its (stable, dotted-handle) id. Additive — the editor's
 * "Save as…" sends the full list including the new one; templates aren't deleted
 * in the UI, so we don't prune.
 */
export async function saveTemplates(templates: EstimateTemplate[]): Promise<void> {
  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    const categories = t.categories as unknown as Prisma.InputJsonValue;
    await prisma.estimateTemplate.upsert({
      where: { id: t.id },
      update: { name: t.name, description: t.description, categories, sortOrder: i },
      create: { id: t.id, name: t.name, description: t.description, categories, sortOrder: i },
    });
  }
}
