/**
 * General Documents — client-safe types and label tables.
 *
 * CLIENT-SAFE. No Prisma import, no "server-only": the composer is a client
 * component. The unions mirror the schema's enums and
 * `lib/general-documents/enums.test.ts` fails the build if they drift.
 *
 * WHAT THIS MODULE IS. The letters and instruments a practice writes around a
 * project but outside any one system: a power of attorney to file on a client's
 * behalf, a letter of intent, an NDA, an RFI to an engineer, an RFQ to a
 * supplier, a notice of practical completion. Each one is a catalogue entry
 * (lib/general-documents/catalogue.ts) with its own fields and body; the row
 * stores the field values and the finished text, never a link to a template
 * that might change under an issued document.
 */

export type GeneralDocumentStatus = "DRAFT" | "ISSUED" | "SIGNED" | "SUPERSEDED" | "VOID";

/** In the order a document lives it. */
export const GENERAL_DOCUMENT_STATUSES: GeneralDocumentStatus[] = [
  "DRAFT",
  "ISSUED",
  "SIGNED",
  "SUPERSEDED",
  "VOID",
];

export const GENERAL_DOCUMENT_STATUS_LABEL: Record<GeneralDocumentStatus, string> = {
  DRAFT: "Draft",
  ISSUED: "Issued",
  SIGNED: "Signed",
  SUPERSEDED: "Superseded",
  VOID: "Void",
};

export type BadgeTone = "neutral" | "blue" | "green" | "amber" | "red" | "violet" | "slate";

export const GENERAL_DOCUMENT_STATUS_TONE: Record<GeneralDocumentStatus, BadgeTone> = {
  DRAFT: "slate",
  ISSUED: "blue",
  SIGNED: "green",
  SUPERSEDED: "amber",
  VOID: "slate",
};

/**
 * What kind of document it is. The category drives grouping in the picker and
 * the register, and nothing else — the behaviour lives in the catalogue entry.
 */
export type DocumentCategory =
  | "AUTHORISATION"
  | "AGREEMENT"
  | "REQUEST"
  | "NOTICE"
  | "CORRESPONDENCE";

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  "AUTHORISATION",
  "AGREEMENT",
  "REQUEST",
  "NOTICE",
  "CORRESPONDENCE",
];

export const DOCUMENT_CATEGORY_LABEL: Record<DocumentCategory, string> = {
  AUTHORISATION: "Authorisations",
  AGREEMENT: "Agreements & intent",
  REQUEST: "Requests",
  NOTICE: "Notices & certificates",
  CORRESPONDENCE: "Letters & transmittals",
};

export const DOCUMENT_CATEGORY_BLURB: Record<DocumentCategory, string> = {
  AUTHORISATION: "Acting for someone else, and being seen to be allowed to.",
  AGREEMENT: "What two parties have settled before the contract exists.",
  REQUEST: "Asking for information, a price, a decision or more time.",
  NOTICE: "Putting a fact on the record, with a date.",
  CORRESPONDENCE: "What travels with a drawing, an invoice or a submission.",
};

/** A field the composer asks for. `type` picks the control, nothing more. */
export type FieldType = "text" | "textarea" | "date" | "number" | "money" | "select";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  /** One line under the control — the practice's own note, not UI chrome. */
  help?: string;
  options?: string[];
};

/** A signature block printed at the foot of the sheet. */
export type SignatureBlockDef = {
  role: string;
  /** Whose name goes on it, when the document already knows: our firm, the
   *  client, or the other party. Otherwise the line is left blank to sign. */
  party?: "firm" | "client" | "counterparty";
  /** Witnesses and notaries get a wider block with a seal note. */
  witness?: boolean;
};

export type CatalogueEntry = {
  /** Stable key stored on the row. Never renamed — an issued document points here. */
  key: string;
  label: string;
  /** The short form the profession actually says: POA, NDA, RFI. */
  abbreviation?: string;
  category: DocumentCategory;
  /** One line in the picker: what this document is for. */
  summary: string;
  /** Who it is addressed to, when it is not the client. */
  counterpartyLabel?: string;
  /** Default title, with the same tokens the body uses. */
  titleTemplate: string;
  fields: FieldDef[];
  /** The body, one entry per paragraph, with `{{token}}` placeholders. */
  body: string[];
  signatures: SignatureBlockDef[];
  /** Shown in the composer only — never printed. */
  practiceNote?: string;
};

// ── DTOs ───────────────────────────────────────────────────────────────────

export type GeneralDocumentSummaryDTO = {
  id: string;
  number: string;
  docType: string;
  /** Resolved from the catalogue at read time, for a register that stays
   *  readable even if a key is retired. */
  docTypeLabel: string;
  category: DocumentCategory | null;
  status: GeneralDocumentStatus;
  title: string;
  clientId: string | null;
  clientName: string | null;
  projectId: string | null;
  projectName: string | null;
  counterpartyName: string | null;
  issueDate: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  signedAt: string | null;
  updatedAt: string;
};

export type GeneralDocumentDTO = GeneralDocumentSummaryDTO & {
  reference: string | null;
  counterpartyAddress: string | null;
  contactName: string | null;
  contactEmail: string | null;
  subject: string | null;
  /** The field values the composer collected, keyed by FieldDef.key. */
  values: Record<string, string>;
  /** The finished paragraphs. Stored, not re-rendered: an issued document must
   *  read the same next year, whatever the template says by then. */
  body: string[];
  notes: string | null;
  supersedesId: string | null;
  voidReason: string | null;
  createdByName: string | null;
  issuedByName: string | null;
  createdAt: string;
};

// ── Write inputs ───────────────────────────────────────────────────────────

export type GeneralDocumentInput = {
  /** Blank means "assign the next number in the practice sequence". */
  number?: string | null;
  docType: string;
  title: string;
  clientId?: string | null;
  clientName?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  counterpartyName?: string | null;
  counterpartyAddress?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  subject?: string | null;
  reference?: string | null;
  issueDate?: string | null;
  effectiveDate?: string | null;
  expiryDate?: string | null;
  values?: Record<string, string>;
  /** The composer sends the rendered body; a hand-edited one wins. */
  body: string[];
  notes?: string | null;
};

export type GeneralDocumentFilter = {
  status?: GeneralDocumentStatus | "ALL" | "OPEN";
  category?: DocumentCategory | "ALL";
  docType?: string;
  projectId?: string;
  /** Free text over number, title, client, project, counterparty, reference. */
  q?: string;
};
