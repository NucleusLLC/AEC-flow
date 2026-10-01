/**
 * Add ONE task to the firm's Norm Set — the Take-Off "ADD NEW" path.
 *
 * SERVER-ONLY (Prisma). Additive beside `lib/data/norm-set.ts`, whose
 * `saveNormSet` replaces the whole list. That is right for the Norm Set tab,
 * which sends the whole list, and wrong here: the Take-Off sheet holds only what
 * was loaded, so a wholesale save from it would also write any unsaved edits a
 * Norm Set tab had made, or wipe tasks another person added since.
 *
 * NormSetTask is tenant-scoped (lib/db.ts), so the create is stamped with the
 * caller's company and the sortOrder read sees only that company's list.
 */
import { prisma } from "@/lib/db";
import type { NormSetTask } from "@/lib/data/estimate-presets";

export async function addNormSetTask(task: Omit<NormSetTask, "id">): Promise<NormSetTask> {
  const last = await prisma.normSetTask.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const row = await prisma.normSetTask.create({
    data: {
      trade: task.trade,
      task: task.task,
      unit: task.unit,
      laborNorm: task.laborNorm,
      materialUnitCost: task.materialUnitCost ?? null,
      equipmentUnitCost: task.equipmentUnitCost ?? null,
      subcontractUnitCost: task.subcontractUnitCost ?? null,
      code: task.code ?? null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  return {
    id: row.id,
    trade: row.trade,
    task: row.task,
    unit: row.unit,
    laborNorm: row.laborNorm,
    materialUnitCost: row.materialUnitCost ?? undefined,
    equipmentUnitCost: row.equipmentUnitCost ?? undefined,
    subcontractUnitCost: row.subcontractUnitCost ?? undefined,
    code: row.code ?? undefined,
  };
}
