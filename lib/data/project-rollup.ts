/**
 * Cross-module rollup for a single project. SERVER-ONLY.
 *
 * Aggregates the additive Module 1/2 registers (Procurement, Material Selection,
 * Design) for one project so the project overview can surface them. Read-only;
 * every underlying query is tenant-scoped by the Prisma extension.
 */
import "server-only";
import { listPurchaseOrders } from "@/lib/data/procurement";
import { listMaterialSelections } from "@/lib/data/materials";
import { listDeliverables } from "@/lib/data/design";
import { PO_OPEN_STATUSES } from "@/lib/procurement/types";

export interface ProjectModulesRollup {
  purchaseOrders: { total: number; open: number; value: number; currency: string };
  materials: { total: number; approved: number };
  deliverables: { total: number; issued: number };
}

export async function getProjectModulesRollup(projectId: string): Promise<ProjectModulesRollup> {
  const [pos, materials, deliverables] = await Promise.all([
    listPurchaseOrders(),
    listMaterialSelections(projectId),
    listDeliverables({ projectId }),
  ]);
  const projectPos = pos.filter((p) => p.projectId === projectId);
  const openPos = projectPos.filter((p) => PO_OPEN_STATUSES.includes(p.status));

  return {
    purchaseOrders: {
      total: projectPos.length,
      open: openPos.length,
      value: Math.round(projectPos.reduce((s, p) => s + p.total, 0) * 100) / 100,
      currency: projectPos[0]?.currency ?? "USD",
    },
    materials: {
      total: materials.length,
      approved: materials.filter(
        (m) => m.status === "APPROVED" || m.status === "ORDERED" || m.status === "INSTALLED",
      ).length,
    },
    deliverables: {
      total: deliverables.length,
      issued: deliverables.filter((d) => d.status === "ISSUED" || d.status === "APPROVED").length,
    },
  };
}
