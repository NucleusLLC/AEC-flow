/**
 * Resolves the project / client identification block that opens a Service Proposal.
 *
 * PURE — no Prisma, no session, no React. The data layer reads the rows and hands them in;
 * this module decides which value wins and which rows are shown at all, so the precedence is
 * unit-testable without a database.
 *
 * SOURCING PRECEDENCE
 *   Project location  ← the linked Project's siteAddress. Nowhere else holds a site address,
 *                       so an unlinked proposal simply has no location row.
 *   Project name      ← the proposal's own projectName (what the author typed / picked at the
 *                       time) before the linked Project's current name, so a renamed project
 *                       never silently rewrites an issued document's wording.
 *   Client name       ← the linked Client's name, then the proposal's denormalised clientName.
 *   Legal entity      ← the linked Client's companyName, shown only when it differs from the
 *                       client name (otherwise it is the same line twice).
 *   Contact person    ← the proposal's contactName (a proposal is addressed to a specific
 *                       person) before the Client's standing contactPerson.
 *   Contact email     ← the proposal's contactEmail before the Client's email.
 *   Contact phone     ← the Client's phone. The proposal carries no phone field.
 *   Client address    ← the Client's primary address, else its first address.
 *
 * OMIT-WHEN-EMPTY: a row is only emitted when it has a non-blank value. There is no "—", no
 * empty labelled row and no placeholder — a proposal with no linked client or project renders
 * nothing at all rather than a grid of dashes.
 *
 * This block describes the CLIENT. It must never be confused with the firm's own identity
 * (lib/server/firm.ts / lib/firm-identity.ts), which is what the letterhead renders.
 */

export interface IdentificationProposal {
  clientName?: string | null;
  projectName?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactTitle?: string | null;
}

export interface IdentificationAddress {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  emirate?: string | null;
  country?: string | null;
  isPrimary?: boolean;
}

export interface IdentificationClient {
  name?: string | null;
  companyName?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  addresses?: IdentificationAddress[];
}

export interface IdentificationProject {
  name?: string | null;
  projectNumber?: string | null;
  siteAddress?: string | null;
}

export interface IdentificationSources {
  proposal: IdentificationProposal;
  client?: IdentificationClient | null;
  project?: IdentificationProject | null;
}

export interface IdentificationRow {
  label: string;
  value: string;
}

export interface ProposalIdentification {
  /** Best available client label, for reuse in meta strips and page headers. */
  clientDisplayName: string | null;
  projectDisplayName: string | null;
  projectLocation: string | null;
  /** Rows for the "Project" column. Only rows with a real value are present. */
  project: IdentificationRow[];
  /** Rows for the "Client" column. Only rows with a real value are present. */
  client: IdentificationRow[];
  /** False when neither column has a single row — callers render nothing. */
  hasAny: boolean;
}

/** First non-blank value, trimmed. Null when every candidate is blank. */
function firstText(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    if (typeof c !== "string") continue;
    const t = c.trim();
    if (t !== "") return t;
  }
  return null;
}

/** Push a row only when the value is real — never a blank labelled row. */
function push(rows: IdentificationRow[], label: string, value: string | null): void {
  if (value !== null) rows.push({ label, value });
}

/**
 * A client address on one line. Blank parts are dropped, so a record holding only a city
 * yields the city rather than ", , City, ,".
 */
export function formatClientAddress(a: IdentificationAddress | null | undefined): string | null {
  if (!a) return null;
  const parts = [a.line1, a.line2, a.city, a.emirate, a.country]
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter((p) => p !== "");
  // Case-insensitive de-duplication: "Oranjestad, Oranjestad" reads as a mistake.
  const seen = new Set<string>();
  const unique = parts.filter((p) => {
    const k = p.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return unique.length > 0 ? unique.join(", ") : null;
}

/** The address to print: the primary one, else the first held. */
export function primaryAddress(
  addresses: IdentificationAddress[] | null | undefined,
): IdentificationAddress | null {
  if (!addresses || addresses.length === 0) return null;
  return addresses.find((a) => a.isPrimary) ?? addresses[0];
}

export function resolveProposalIdentification(sources: IdentificationSources): ProposalIdentification {
  const { proposal, client, project } = sources;

  const projectDisplayName = firstText(proposal.projectName, project?.name);
  const projectNumber = firstText(project?.projectNumber);
  const projectLocation = firstText(project?.siteAddress);

  const clientDisplayName = firstText(client?.name, proposal.clientName);
  const legalEntity = firstText(client?.companyName);
  const contactName = firstText(proposal.contactName, client?.contactPerson);
  const contactTitle = firstText(proposal.contactTitle);
  const contactEmail = firstText(proposal.contactEmail, client?.email);
  const contactPhone = firstText(client?.phone);
  const clientAddress = formatClientAddress(primaryAddress(client?.addresses));

  const projectRows: IdentificationRow[] = [];
  push(projectRows, "Project", projectDisplayName);
  push(projectRows, "Project no.", projectNumber);
  push(projectRows, "Location", projectLocation);

  const clientRows: IdentificationRow[] = [];
  push(clientRows, "Client", clientDisplayName);
  // Only when the registered entity actually says something the client name does not.
  if (legalEntity !== null && legalEntity.toLowerCase() !== (clientDisplayName ?? "").toLowerCase()) {
    push(clientRows, "Legal entity", legalEntity);
  }
  push(
    clientRows,
    "Attention",
    contactName !== null && contactTitle !== null
      ? `${contactName}, ${contactTitle}`
      : contactName,
  );
  push(clientRows, "Email", contactEmail);
  push(clientRows, "Phone", contactPhone);
  push(clientRows, "Address", clientAddress);

  return {
    clientDisplayName,
    projectDisplayName,
    projectLocation,
    project: projectRows,
    client: clientRows,
    hasAny: projectRows.length > 0 || clientRows.length > 0,
  };
}
