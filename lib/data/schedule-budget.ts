/**
 * Schedule Budget — commitment reads/writes. SERVER-ONLY (imports Prisma).
 *
 * PROTECTED SYSTEM (schedule) — additive layer, approved 2026-08-04.
 *
 * The bridge between procurement and the programme. It reads purchase orders and
 * flattens them into the four numbers `lib/schedule/budget.ts` can defend, then hands
 * them to that pure module — no money is added up in this file, and none is added up in
 * the panel either. One rollup function, called from both sides, is the only way the
 * screen and any future server total can be guaranteed to agree.
 *
 * `PurchaseOrder` is tenant-scoped by the Prisma extension in lib/db.ts, so every read
 * and write here is already confined to the current company. `ScheduleTask` inherits its
 * scoping from `ProjectSchedule` the same way it always has.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { lineAmount, lineReceived } from "@/lib/procurement/calc";
import type { PurchaseOrderLine } from "@/lib/procurement/types";
import type { Commitment, CommitmentStatus } from "@/lib/schedule/budget";

/** Same shape-tolerant parse the procurement layer uses — the column is JSON, so a
 *  hand-edited or half-migrated row must degrade rather than throw. */
function parseLines(raw: unknown): PurchaseOrderLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((l) => {
    const o = (l ?? {}) as Record<string, unknown>;
    return {
      description: typeof o.description === "string" ? o.description : "",
      quantity: Number(o.quantity) || 0,
      unit: typeof o.unit === "string" ? o.unit : "",
      unitPrice: Number(o.unitPrice) || 0,
      receivedQty: Number(o.receivedQty) || 0,
    };
  });
}

/**
 * Every purchase order raised against a project, flattened for the rollup.
 *
 * `linesSubtotal` and `receivedSubtotal` are built from `lineAmount` / `lineReceived`
 * in lib/procurement/calc — the same helpers the PO screen and the receiving workflow
 * use — so a line's value means one thing across the whole application.
 */
export async function getProjectCommitments(projectId: string): Promise<Commitment[]> {
  const rows = await prisma.purchaseOrder.findMany({
    where: { projectId },
    orderBy: { poNumber: "asc" },
  });

  return rows.map((r) => {
    const lines = parseLines(r.lineItems);
    let linesSubtotal = 0;
    let receivedSubtotal = 0;
    for (const l of lines) {
      linesSubtotal += lineAmount(l);
      receivedSubtotal += lineAmount({ quantity: lineReceived(l), unitPrice: l.unitPrice });
    }
    return {
      id: r.id,
      reference: r.poNumber,
      vendorName: r.vendorName,
      status: r.status as CommitmentStatus,
      taskKey: r.scheduleTaskKey,
      currency: r.currency,
      total: Number(r.total),
      linesSubtotal,
      receivedSubtotal,
    };
  });
}

/**
 * Attribute a commitment to a schedule activity (or clear it back to unassigned).
 *
 * The order must already belong to the project whose programme is asking, which is why
 * `projectId` is a parameter rather than trusted from the client: without it, a task key
 * from one project could be stamped onto another project's order. The tenant extension
 * stops cross-company writes; this stops cross-project ones.
 *
 * `updateMany` (not `update`) so a mismatch is a no-op returning 0 rather than a thrown
 * "record not found" the caller would have to translate.
 */
export async function setCommitmentTask(input: {
  purchaseOrderId: string;
  projectId: string;
  taskKey: string | null;
}): Promise<{ updated: number }> {
  const res = await prisma.purchaseOrder.updateMany({
    where: { id: input.purchaseOrderId, projectId: input.projectId },
    data: { scheduleTaskKey: input.taskKey },
  });
  return { updated: res.count };
}
