/**
 * Orders data-access layer — CLIENT-SAFE declarations. This sibling module
 * holds the types, label maps, and pure helpers that `"use client"` components
 * import as values, so they never drag the Postgres driver into the browser
 * bundle. NEVER import `@/lib/db` (or anything that does) from here.
 */

export type OrderStatus = "DRAFT" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type OrderListItem = {
  id: string;
  orderNumber: string;
  title: string;
  clientName: string;
  serviceType: string;
  status: OrderStatus;
  fee: number;
  currency: string;
  proposalRef: string | null;
  hasProject: boolean;
  expectedStartDate: string | null;
  expectedEndDate: string | null;
  createdAt: string;
};

export type OrdersSummary = {
  total: number;
  activeCount: number;
  activeValue: number;
  completedCount: number;
  completedValue: number;
  unscheduled: number;
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const ACTIVE: OrderStatus[] = ["CONFIRMED", "IN_PROGRESS"];

export function summarizeOrders(list: OrderListItem[]): OrdersSummary {
  const active = list.filter((o) => ACTIVE.includes(o.status));
  const completed = list.filter((o) => o.status === "COMPLETED");
  return {
    total: list.length,
    activeCount: active.length,
    activeValue: active.reduce((n, o) => n + o.fee, 0),
    completedCount: completed.length,
    completedValue: completed.reduce((n, o) => n + o.fee, 0),
    unscheduled: list.filter((o) => !o.hasProject && o.status !== "CANCELLED").length,
  };
}

/* ───────────────────────────────────────────────────────────────────────────
 * DETAIL LAYER — for the `/orders/[id]` detail page. ADDITIVE ONLY: the list
 * exports above are untouched. Extra fields live in a map keyed by order id and
 * are merged onto the list row by getOrder(). Swap for a Prisma query later.
 * ────────────────────────────────────────────────────────────────────────── */

export type OrderRecord = OrderListItem & {
  scopeSummary: string | null;
  siteAddress: string | null;
  notes: string | null;
  projectId: string | null;
};

/* ───────────────────────────────────────────────────────────────────────────
 * WRITE INPUT — the payload the create/edit form submits. CLIENT-SAFE (no
 * Prisma types) so the `"use client"` order form can import it. The server
 * action (app/(app)/orders/actions.ts) passes it straight to the Prisma-backed
 * createOrder/updateOrder in lib/data/orders.ts, which resolve the names/refs:
 *   - `clientName`  → clientId  (required business relation)
 *   - `proposalRef` → proposalId (optional link, by Proposal.refNumber)
 *   - `orderNumber` is the unique business key; ignored on create (auto-
 *     generated as ORD-YYYY-NNN) and used to locate the row on update.
 * Empty-string dates mean "not set". Mirrors the proposals ProposalWriteInput.
 * ────────────────────────────────────────────────────────────────────────── */
export type OrderWriteInput = {
  /** Set on edit to locate the row by its unique business key; unused on create. */
  orderNumber?: string | null;
  clientName: string;
  title: string;
  serviceType?: string | null;
  fee?: number | string | null;
  status?: OrderStatus;
  currency?: string | null;
  /** Source proposal reference (e.g. "PRO-2026-040"); resolved to proposalId. */
  proposalRef?: string | null;
  scopeSummary?: string | null;
  siteAddress?: string | null;
  /** "" or an ISO date string. */
  expectedStartDate?: string | null;
  expectedEndDate?: string | null;
  notes?: string | null;
};
