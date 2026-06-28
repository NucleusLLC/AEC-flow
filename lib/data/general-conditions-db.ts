/**
 * General Conditions (preliminaries) — firm-wide default template, DB-backed.
 *
 * SERVER-ONLY (imports Prisma → pg). The type + static seed + `sumGeneralConditions`
 * helper stay in the client-safe `lib/data/general-conditions.ts` (imported by
 * calc.ts and the views); this module only adds the DB read/write. See
 * [[aec-prisma-client-boundary]].
 */
import { prisma } from "@/lib/db";
import type { GeneralConditionItem } from "@/lib/data/general-conditions";

function toDto(r: {
  id: string;
  name: string;
  unit: string;
  qty: number;
  unitCost: number;
  note: string | null;
  enabled: boolean;
}): GeneralConditionItem {
  return {
    id: r.id,
    name: r.name,
    unit: r.unit,
    qty: r.qty,
    unitCost: r.unitCost,
    note: r.note ?? undefined,
    enabled: r.enabled,
  };
}

export async function getGeneralConditions(): Promise<GeneralConditionItem[]> {
  const rows = await prisma.generalConditionItem.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map(toDto);
}

/** Replace the whole General Conditions template. Temp ids ("gc-new-…") → fresh cuids. */
export async function saveGeneralConditions(items: GeneralConditionItem[]): Promise<void> {
  const data = items.map((g, i) => ({
    ...(g.id && !g.id.startsWith("gc-new-") ? { id: g.id } : {}),
    name: g.name,
    unit: g.unit,
    qty: g.qty,
    unitCost: g.unitCost,
    note: g.note ?? null,
    enabled: g.enabled,
    sortOrder: i,
  }));
  await prisma.$transaction([
    prisma.generalConditionItem.deleteMany({}),
    prisma.generalConditionItem.createMany({ data }),
  ]);
}
