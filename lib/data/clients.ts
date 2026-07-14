/**
 * Clients data-access layer.
 *
 * IMPORTANT (single-tenant -> SaaS hedge): pages must call functions from this
 * module rather than touching Prisma directly. When the suite becomes
 * multi-tenant, query scoping (orgId) gets added HERE and nowhere else.
 *
 * For now these return representative placeholder data so the UI can be built
 * and reviewed before the database is connected. Swap the bodies for real
 * Prisma queries once the migration runs — the call sites stay unchanged.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type {
  ClientType,
  ClientStatus,
  ProposalStatus,
  ProjectStatus,
  ClientAddress,
  ClientContact,
  ClientProposal,
  ClientProject,
  ClientEstimate,
  ClientRecord,
  ClientListItem,
  ClientWriteInput,
} from "./clients.types";

// Re-export the client-safe declarations so existing server call sites that
// import types/labels/helpers from "@/lib/data/clients" keep working unchanged.
export * from "./clients.types";

const OPEN_PROPOSAL: ProposalStatus[] = ["DRAFT", "SENT", "PENDING", "ON_HOLD"];
const isOpen = (s: ProposalStatus) => OPEN_PROPOSAL.includes(s);

/** Format a Date (or null) as a "YYYY-MM-DD" string. */
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type ClientListRow = Prisma.ClientGetPayload<{
  include: { addresses: true; proposals: true; projects: true };
}>;

function toListItem(c: ClientListRow): ClientListItem {
  const primaryAddr = c.addresses.find((a) => a.isPrimary) ?? c.addresses[0];
  const location = primaryAddr ? [primaryAddr.city, primaryAddr.emirate].filter(Boolean).join(", ") : "—";

  const proposalStatuses = c.proposals.map((p) => p.status as ProposalStatus);
  const lifetimeValue = c.proposals
    .filter((p) => p.status === "APPROVED")
    .reduce((n, p) => n + Number(p.totalFee), 0);
  const pipelineValue = c.proposals
    .filter((p) => isOpen(p.status as ProposalStatus))
    .reduce((n, p) => n + Number(p.totalFee), 0);

  const activityDates = [
    ...c.proposals.map((p) => p.updatedAt),
    ...c.projects.map((p) => p.updatedAt),
    c.updatedAt,
  ];
  const lastActivity = activityDates.length
    ? new Date(Math.max(...activityDates.map((d) => d.getTime())))
    : c.createdAt;

  return {
    id: c.id,
    name: c.name,
    companyName: c.companyName,
    contactPerson: c.contactPerson,
    email: c.email,
    phone: c.phone,
    type: c.type as ClientType,
    status: c.status as ClientStatus,
    location: location || "—",
    tags: c.tags,
    projectsCount: c.projects.length,
    activeProjects: c.projects.filter((p) => p.status === "ACTIVE").length,
    proposalsCount: c.proposals.length,
    openProposals: proposalStatuses.filter((s) => isOpen(s)).length,
    lifetimeValue,
    pipelineValue,
    lastActivityDate: ymd(lastActivity),
    createdAt: ymd(c.createdAt),
  };
}

export async function getClients(): Promise<ClientListItem[]> {
  const clients = await prisma.client.findMany({
    include: { addresses: true, proposals: true, projects: true },
  });
  return clients.map(toListItem).sort((a, b) => b.lastActivityDate.localeCompare(a.lastActivityDate));
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

/** Scalar fields shared by create and update. */
function clientScalars(input: ClientWriteInput) {
  return {
    name: input.name,
    companyName: input.companyName ?? null,
    contactPerson: input.contactPerson ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    website: input.website ?? null,
    taxNumber: input.taxNumber ?? null,
    type: input.type ?? "PRIVATE",
    status: input.status ?? "ACTIVE",
    tags: input.tags ?? [],
    notes: input.notes ?? null,
  };
}

/** Drop blank address rows and map them to Prisma create rows. */
function addressCreates(input: ClientWriteInput) {
  return input.addresses
    .filter((a) => a.line1 || a.label || a.city)
    .map((a, i) => ({
      label: a.label || "Primary",
      line1: a.line1 || "",
      line2: a.line2 ?? null,
      city: a.city ?? null,
      emirate: a.emirate ?? null,
      country: a.country || "UAE",
      isPrimary: a.isPrimary ?? i === 0,
    }));
}

/** Create a client with its addresses. Returns the new client id. */
export async function createClient(input: ClientWriteInput): Promise<{ id: string }> {
  const addresses = addressCreates(input);
  const c = await prisma.client.create({
    data: {
      ...clientScalars(input),
      addresses: addresses.length ? { create: addresses } : undefined,
    },
  });
  return { id: c.id };
}

/**
 * Update a client. The edit form only manages the PRIMARY address, so we replace
 * just the primary row and leave any secondary addresses intact (replacing all
 * would silently destroy them).
 */
export async function updateClient(input: ClientWriteInput): Promise<{ id: string }> {
  const id = input.id;
  if (!id) throw new Error("updateClient requires an id.");
  await prisma.$transaction(async (tx) => {
    const existing = await tx.client.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new Error(`Client ${id} not found.`);
    await tx.clientAddress.deleteMany({ where: { clientId: id, isPrimary: true } });
    await tx.client.update({
      where: { id },
      data: {
        ...clientScalars(input),
        addresses: { create: addressCreates(input) },
      },
    });
  });
  return { id };
}

export async function getClient(id: string): Promise<ClientRecord | null> {
  const c = await prisma.client.findUnique({
    where: { id },
    include: {
      addresses: true,
      proposals: { orderBy: { createdAt: "desc" } },
      projects: { include: { manager: true } },
      estimates: { orderBy: { updatedAt: "desc" } },
    },
  });
  if (!c) return null;

  const addresses: ClientAddress[] = c.addresses.map((a) => ({
    label: a.label,
    line1: a.line1,
    city: a.city ?? undefined,
    emirate: a.emirate ?? undefined,
    country: a.country,
    isPrimary: a.isPrimary,
  }));

  const contacts: ClientContact[] = c.contactPerson
    ? [
        {
          name: c.contactPerson,
          role: "Primary Contact",
          email: c.email ?? undefined,
          phone: c.phone ?? undefined,
          isPrimary: true,
        },
      ]
    : [];

  const proposals: ClientProposal[] = c.proposals.map((p) => ({
    id: p.id,
    ref: p.refNumber,
    title: p.title,
    status: p.status as ProposalStatus,
    value: Number(p.totalFee),
    date: ymd(p.sentAt ?? p.createdAt),
  }));

  const projects: ClientProject[] = c.projects.map((p) => ({
    id: p.id,
    number: p.projectNumber,
    name: p.name,
    status: p.status as ProjectStatus,
    progressPct: p.progressPct,
    manager: p.manager.name,
  }));

  const estimates: ClientEstimate[] = c.estimates.map((e) => ({
    id: e.id,
    number: e.projectNumber ?? "",
    name: e.projectName,
    status: e.status,
    amount: e.amount,
    currency: e.currency,
    date: ymd(e.date ?? e.updatedAt),
  }));

  const activityDates = [
    ...c.proposals.map((p) => p.updatedAt),
    ...c.projects.map((p) => p.updatedAt),
    ...c.estimates.map((e) => e.updatedAt),
    c.updatedAt,
  ];
  const lastActivity = activityDates.length
    ? new Date(Math.max(...activityDates.map((d) => d.getTime())))
    : c.createdAt;

  return {
    id: c.id,
    name: c.name,
    companyName: c.companyName,
    contactPerson: c.contactPerson,
    email: c.email,
    phone: c.phone,
    website: c.website,
    taxNumber: c.taxNumber,
    type: c.type as ClientType,
    status: c.status as ClientStatus,
    notes: c.notes,
    tags: c.tags,
    createdAt: ymd(c.createdAt),
    lastActivityDate: ymd(lastActivity),
    addresses,
    contacts,
    proposals,
    projects,
    estimates,
    activity: [],
  };
}
