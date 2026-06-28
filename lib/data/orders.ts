/**
 * Orders data-access layer (placeholder — see lib/data/clients.ts for the
 * single-tenant -> SaaS hedge rationale). Orders are confirmed engagements
 * derived from approved proposals.
 */

import { prisma } from "@/lib/db";
import { n } from "@/lib/api";
import { getSystemCurrency } from "@/lib/format";
import type { OrderListItem, OrderRecord, OrderStatus, OrderWriteInput } from "./orders.types";

// Re-export the client-safe declarations (types, label map, pure helpers) so
// existing server-side imports of `@/lib/data/orders` keep working unchanged.
export * from "./orders.types";

const ymd = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

export async function getOrders(): Promise<OrderListItem[]> {
  const rows = await prisma.order.findMany({
    include: { client: true, proposal: true, project: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    title: o.title,
    clientName: o.client.name,
    serviceType: o.serviceType,
    status: o.status as OrderStatus,
    fee: Number(o.fee),
    currency: o.currency,
    proposalRef: o.proposal?.refNumber ?? null,
    hasProject: o.project != null,
    expectedStartDate: ymd(o.expectedStartDate),
    expectedEndDate: ymd(o.expectedEndDate),
    createdAt: ymd(o.createdAt) as string,
  }));
}

export async function getOrder(id: string): Promise<OrderRecord | null> {
  const o = await prisma.order.findUnique({
    where: { id },
    include: { client: true, proposal: true, project: true },
  });
  if (!o) return null;
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    title: o.title,
    clientName: o.client.name,
    serviceType: o.serviceType,
    status: o.status as OrderStatus,
    fee: Number(o.fee),
    currency: o.currency,
    proposalRef: o.proposal?.refNumber ?? null,
    hasProject: o.project != null,
    expectedStartDate: ymd(o.expectedStartDate),
    expectedEndDate: ymd(o.expectedEndDate),
    createdAt: ymd(o.createdAt) as string,
    scopeSummary: o.scopeSummary,
    siteAddress: o.siteAddress,
    notes: o.notes,
    projectId: o.project?.projectNumber ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

/**
 * Back-compat alias: the canonical, client-safe write payload now lives in
 * ./orders.types as OrderWriteInput (so the `"use client"` form can import it
 * without the Postgres driver). Existing server-side importers of `OrderInput`
 * (e.g. app/api/orders/route.ts) keep working unchanged.
 */
export type OrderInput = OrderWriteInput;

/** Resolve a client name to its id, throwing if no match exists. */
async function resolveClientId(name: string): Promise<string> {
  const client = await prisma.client.findFirst({ where: { name } });
  if (!client) throw new Error(`Unknown client: ${name}`);
  return client.id;
}

/** Resolve a Proposal.refNumber to its id; returns null when blank/unmatched. */
async function resolveProposalId(ref?: string | null): Promise<string | null> {
  const r = ref?.trim();
  if (!r) return null;
  const proposal = await prisma.proposal.findFirst({
    where: { refNumber: r },
    select: { id: true },
  });
  return proposal?.id ?? null;
}

/**
 * Generate the next `ORD-YYYY-NNN` number server-side (mirrors
 * nextPunchNumber): scan existing orders for the current year's max sequence,
 * increment, and zero-pad to three digits.
 */
function nextOrderNumber(existing: string[], year = 2026): string {
  let max = 0;
  for (const num of existing) {
    const m = new RegExp(`^ORD-${year}-(\\d+)$`).exec(num);
    if (m && Number(m[1]) > max) max = Number(m[1]);
  }
  return `ORD-${year}-${String(max + 1).padStart(3, "0")}`;
}

/** Scalar fields shared by create and update (excludes orderNumber/client/proposal). */
function orderScalars(input: OrderWriteInput) {
  return {
    title: input.title,
    serviceType: input.serviceType ?? "",
    fee: n(input.fee),
    status: input.status ?? "DRAFT",
    currency: input.currency ?? getSystemCurrency(),
    scopeSummary: input.scopeSummary ?? null,
    siteAddress: input.siteAddress ?? null,
    expectedStartDate: input.expectedStartDate ? new Date(input.expectedStartDate) : null,
    expectedEndDate: input.expectedEndDate ? new Date(input.expectedEndDate) : null,
    notes: input.notes ?? null,
  };
}

/** Create a new order; clientName → clientId, proposalRef → proposalId. Returns id + orderNumber. */
export async function createOrder(input: OrderWriteInput): Promise<{ id: string; orderNumber: string }> {
  const clientId = await resolveClientId(input.clientName);
  const proposalId = await resolveProposalId(input.proposalRef);
  const year = new Date().getFullYear();
  const existing = await prisma.order.findMany({ select: { orderNumber: true } });
  const orderNumber = nextOrderNumber(existing.map((o) => o.orderNumber), year);

  const o = await prisma.order.create({
    data: {
      orderNumber,
      clientId,
      proposalId,
      ...orderScalars(input),
    },
  });
  return { id: o.id, orderNumber: o.orderNumber };
}

/**
 * Update an existing order, located by its unique business key (`orderNumber`,
 * or the cuid `id`) carried on the input — mirrors updateProposal keying by
 * `ref`. Orders have no child rows, so this is a plain order.update.
 */
export async function updateOrder(input: OrderWriteInput): Promise<{ id: string; orderNumber: string }> {
  const key = input.orderNumber?.trim() ?? "";
  if (!key) throw new Error("Cannot update an order without an orderNumber.");
  const existing = await prisma.order.findFirst({
    where: { OR: [{ id: key }, { orderNumber: key }] },
    select: { id: true },
  });
  if (!existing) throw new Error(`Order ${key} not found.`);

  const clientId = await resolveClientId(input.clientName);
  const proposalId = await resolveProposalId(input.proposalRef);
  const o = await prisma.order.update({
    where: { id: existing.id },
    data: {
      clientId,
      proposalId,
      ...orderScalars(input),
    },
  });
  return { id: o.id, orderNumber: o.orderNumber };
}
