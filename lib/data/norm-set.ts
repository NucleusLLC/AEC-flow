/**
 * Cost-Estimation — firm-wide Norm Set (standard tasks with fixed labor norms).
 *
 * SERVER-ONLY (imports Prisma → pg). The NormSetTask type + static seed/helpers
 * live in the client-safe `lib/data/estimate-presets.ts`; this module only adds
 * the DB read/write, so no client component imports it. See [[aec-prisma-client-boundary]].
 */
import { prisma } from "@/lib/db";
import type { NormSetTask } from "@/lib/data/estimate-presets";

function toDto(r: {
  id: string;
  trade: string;
  task: string;
  unit: string;
  laborNorm: number;
  materialUnitCost: number | null;
  equipmentUnitCost: number | null;
  subcontractUnitCost: number | null;
  code: string | null;
}): NormSetTask {
  return {
    id: r.id,
    trade: r.trade,
    task: r.task,
    unit: r.unit,
    laborNorm: r.laborNorm,
    materialUnitCost: r.materialUnitCost ?? undefined,
    equipmentUnitCost: r.equipmentUnitCost ?? undefined,
    subcontractUnitCost: r.subcontractUnitCost ?? undefined,
    code: r.code ?? undefined,
  };
}

export async function getNormSet(): Promise<NormSetTask[]> {
  const rows = await prisma.normSetTask.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map(toDto);
}

/** Replace the whole Norm Set (single firm-wide library). Temp ids → fresh cuids. */
export async function saveNormSet(tasks: NormSetTask[]): Promise<void> {
  const data = tasks.map((t, i) => ({
    ...(t.id && !t.id.startsWith("ns-new-") ? { id: t.id } : {}),
    trade: t.trade,
    task: t.task,
    unit: t.unit,
    laborNorm: t.laborNorm,
    materialUnitCost: t.materialUnitCost ?? null,
    equipmentUnitCost: t.equipmentUnitCost ?? null,
    subcontractUnitCost: t.subcontractUnitCost ?? null,
    code: t.code ?? null,
    sortOrder: i,
  }));
  await prisma.$transaction([
    prisma.normSetTask.deleteMany({}),
    prisma.normSetTask.createMany({ data }),
  ]);
}
