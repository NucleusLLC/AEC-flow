/**
 * Clients — client-safe type declarations, label maps and pure helpers.
 *
 * This module must NEVER import `@/lib/db` (or anything that pulls in the
 * Postgres driver), so that `"use client"` components can import VALUES from
 * here (e.g. CLIENT_TYPE_LABEL) without dragging `pg` into the browser bundle.
 *
 * The data-access layer (`./clients.ts`) re-exports everything here, so server
 * call sites importing from `@/lib/data/clients` keep working unchanged.
 */

export type ClientType =
  | "DEVELOPER"
  | "GOVERNMENT"
  | "HOSPITALITY"
  | "HEALTHCARE"
  | "COMMERCIAL"
  | "RESIDENTIAL"
  | "PRIVATE";

export type ClientStatus = "ACTIVE" | "INACTIVE" | "PROSPECT";

export type ProposalStatus =
  | "DRAFT"
  | "SENT"
  | "PENDING"
  | "APPROVED"
  | "ON_HOLD"
  | "REJECTED"
  | "VOID";

export type ProjectStatus = "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";

export type ClientAddress = {
  label: string;
  line1: string;
  city?: string;
  emirate?: string;
  country: string;
  isPrimary?: boolean;
};

export type ClientContact = {
  name: string;
  role: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
};

export type ClientProposal = {
  id: string;
  ref: string;
  title: string;
  status: ProposalStatus;
  value: number;
  date: string;
};

export type ClientProject = {
  id: string;
  number: string;
  name: string;
  status: ProjectStatus;
  progressPct: number;
  manager: string;
};

export type ClientActivity = {
  id: string;
  action: string;
  target: string;
  at: string;
};

/** Full record — what the detail page consumes. */
export type ClientRecord = {
  id: string;
  name: string;
  companyName: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  taxNumber: string | null;
  type: ClientType;
  status: ClientStatus;
  notes: string | null;
  tags: string[];
  createdAt: string;
  lastActivityDate: string;
  addresses: ClientAddress[];
  contacts: ClientContact[];
  proposals: ClientProposal[];
  projects: ClientProject[];
  activity: ClientActivity[];
};

/** Lean row — what the list page consumes. */
export type ClientListItem = {
  id: string;
  name: string;
  companyName: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  type: ClientType;
  status: ClientStatus;
  location: string;
  tags: string[];
  projectsCount: number;
  activeProjects: number;
  proposalsCount: number;
  openProposals: number;
  lifetimeValue: number;
  pipelineValue: number;
  lastActivityDate: string;
  createdAt: string;
};

export type ClientsSummary = {
  total: number;
  active: number;
  prospects: number;
  pipelineValue: number;
  lifetimeValue: number;
};

export function summarizeClients(list: ClientListItem[]): ClientsSummary {
  return {
    total: list.length,
    active: list.filter((c) => c.status === "ACTIVE").length,
    prospects: list.filter((c) => c.status === "PROSPECT").length,
    pipelineValue: list.reduce((n, c) => n + c.pipelineValue, 0),
    lifetimeValue: list.reduce((n, c) => n + c.lifetimeValue, 0),
  };
}

/**
 * Address payload the create/edit form submits per address row. Client-safe
 * (no Prisma types) so the `"use client"` form can import it.
 */
export type ClientWriteAddress = {
  label: string;
  line1: string;
  line2?: string | null;
  city: string | null;
  emirate: string | null;
  country: string;
  isPrimary?: boolean;
};

/**
 * Payload the create/edit client form submits. `id` is present on edit (used to
 * resolve the row to update); `addresses` are replaced wholesale on update.
 * Client-safe (no Prisma types) so the `"use client"` form can import it.
 */
export type ClientWriteInput = {
  id?: string;
  name: string;
  companyName: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  taxNumber: string | null;
  type: ClientType;
  status: ClientStatus;
  tags: string[];
  notes: string | null;
  addresses: ClientWriteAddress[];
};

export const CLIENT_TYPE_LABEL: Record<ClientType, string> = {
  DEVELOPER: "Developer",
  GOVERNMENT: "Government",
  HOSPITALITY: "Hospitality",
  HEALTHCARE: "Healthcare",
  COMMERCIAL: "Commercial",
  RESIDENTIAL: "Residential",
  PRIVATE: "Private",
};
