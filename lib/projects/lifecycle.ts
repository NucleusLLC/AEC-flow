/**
 * Archive and delete a project — the rules, kept free of Prisma so they test.
 *
 * ─── THE TWO STEPS ────────────────────────────────────────────────────────────
 * ARCHIVE hides a project from the Projects list and touches nothing else:
 * invoices, time, drawings and every other record that points at it stay where
 * they are, and RESTORE puts it back. DELETE is only offered on a project that is
 * already archived, so nothing is ever deleted in one click from a live project.
 *
 * ─── WHY DELETE CAN BE REFUSED ────────────────────────────────────────────────
 * About forty tables carry a `projectId`, most as loose strings with no foreign
 * key, so the database would not stop a delete — it would leave invoices, time
 * entries and permits pointing at nothing. A project is therefore deleted only
 * when nothing but its own phases and activity log refers to it. Anything else
 * is listed back to the user, and the project stays archived.
 */

/** One kind of record that still points at the project, and how many. */
export type ProjectLink = { key: ProjectLinkKey; count: number };

/** What `projectLinks` counts — label is what the user reads. */
export const PROJECT_LINK_LABEL = {
  meetings: "Meeting minutes",
  attachments: "Attachments",
  drawings: "Drawings",
  estimates: "Cost estimates",
  schedule: "Schedule",
  tasks: "Tasks",
  purchaseOrders: "Purchase orders",
  materials: "Material selections",
  deliverables: "Design deliverables",
  serviceProposals: "Service proposals",
  permits: "Building permits",
  generalDocuments: "General documents",
  contracts: "Construction contracts",
  invoices: "Invoices",
  timeEntries: "Time entries",
  expenses: "Expenses",
  caReports: "Site reports",
  changeOrders: "Change orders",
  rfis: "RFIs",
  siteInstructions: "Site instructions",
  submittals: "Submittals",
  delayNotices: "Delay notices",
  certifications: "Progress certifications",
  punchList: "Punch list items",
  permitTasks: "Permit tasks",
} as const;

export type ProjectLinkKey = keyof typeof PROJECT_LINK_LABEL;

/** Only kinds with at least one record, biggest first, for the warning list. */
export function blockingLinks(counts: Partial<Record<ProjectLinkKey, number>>): ProjectLink[] {
  return (Object.keys(PROJECT_LINK_LABEL) as ProjectLinkKey[])
    .map((key) => ({ key, count: counts[key] ?? 0 }))
    .filter((l) => l.count > 0)
    .sort((a, b) => b.count - a.count);
}

export type DeleteCheck =
  | { ok: true }
  | { ok: false; reason: "NOT_ARCHIVED" | "WRONG_CONFIRMATION" | "LINKED"; links?: ProjectLink[] };

/**
 * May this project be deleted now? The order matters: an unarchived project is
 * refused before anything is counted, and a mistyped confirmation before the
 * linked records, so the message names the first thing the user must fix.
 */
export function checkDelete(input: {
  archivedAt: string | null;
  projectNumber: string;
  typed: string;
  links: ProjectLink[];
}): DeleteCheck {
  if (!input.archivedAt) return { ok: false, reason: "NOT_ARCHIVED" };
  if (!confirmationMatches(input.typed, input.projectNumber)) return { ok: false, reason: "WRONG_CONFIRMATION" };
  if (input.links.length > 0) return { ok: false, reason: "LINKED", links: input.links };
  return { ok: true };
}

/** The user types the project number to confirm. Case and outer spaces are forgiven, nothing else. */
export function confirmationMatches(typed: string, projectNumber: string): boolean {
  const want = projectNumber.trim().toUpperCase();
  return want.length > 0 && typed.trim().toUpperCase() === want;
}
