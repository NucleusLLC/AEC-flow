/**
 * General Documents data-access. SERVER-ONLY.
 *
 * Every read and write goes through the Prisma tenant extension (GeneralDocument
 * is in TENANT_MODELS), so a document belonging to another practice cannot be
 * read, edited or even found. Single-row reads use `findFirst` rather than
 * `findUnique` deliberately: the extension puts the company in the WHERE of a
 * findFirst, while for findUnique it can only inspect the row that comes back —
 * which a narrow `select` can defeat. See lib/tenant-scope-findunique.test.ts.
 *
 * WHAT IS IMMUTABLE. A DRAFT may be edited or deleted. Anything else may not:
 * an issued power of attorney or a served notice is a record of what the
 * practice put its name to on a date. Those move on through status changes
 * (signed, superseded, void) and by being superseded with a new document, never
 * by being rewritten.
 */
import "server-only";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { catalogueEntry, docTypeLabel } from "@/lib/general-documents/catalogue";
import { nextDocumentNumber } from "@/lib/general-documents/render";
import type {
  DocumentCategory,
  GeneralDocumentDTO,
  GeneralDocumentInput,
  GeneralDocumentStatus,
  GeneralDocumentSummaryDTO,
} from "@/lib/general-documents/types";

/** Thrown when a number is already used inside this practice. */
export class DocumentNumberInUseError extends Error {
  constructor(number: string) {
    super(`Number “${number}” is already used by another document.`);
    this.name = "DocumentNumberInUseError";
  }
}

/** Thrown when the document does not exist, or belongs to another practice. */
export class DocumentNotFoundError extends Error {
  constructor() {
    super("That document could not be found.");
    this.name = "DocumentNotFoundError";
  }
}

/** Thrown when a document that has left DRAFT is edited or deleted. */
export class DocumentLockedError extends Error {
  constructor(what: string) {
    super(`This document has been issued, so it cannot be ${what}. Supersede it instead.`);
    this.name = "DocumentLockedError";
  }
}

async function actor(): Promise<{ id: string | null; name: string | null }> {
  const session = await getServerSession(authOptions);
  return { id: session?.user?.id ?? null, name: session?.user?.name ?? null };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

// ── Conversions ────────────────────────────────────────────────────────────

/** A stored timestamp as the calendar date it stands for. */
function ymd(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** A `YYYY-MM-DD` field from a form, as the UTC midnight it means. */
function toDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(`${s.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The composer's values, as the plain string map the renderer expects. */
function toValues(json: unknown): Record<string, string> {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(json as Record<string, unknown>)) {
    if (value === null || value === undefined) continue;
    out[key] = String(value);
  }
  return out;
}

type Row = {
  id: string;
  number: string;
  docType: string;
  status: GeneralDocumentStatus;
  title: string;
  reference: string | null;
  subject: string | null;
  clientId: string | null;
  clientName: string | null;
  projectId: string | null;
  projectName: string | null;
  counterpartyName: string | null;
  counterpartyAddress: string | null;
  contactName: string | null;
  contactEmail: string | null;
  issueDate: Date | null;
  effectiveDate: Date | null;
  expiryDate: Date | null;
  signedAt: Date | null;
  values: unknown;
  body: string[];
  notes: string | null;
  supersedesId: string | null;
  voidReason: string | null;
  createdByName: string | null;
  issuedByName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function summaryDto(r: Row): GeneralDocumentSummaryDTO {
  const entry = catalogueEntry(r.docType);
  return {
    id: r.id,
    number: r.number,
    docType: r.docType,
    // Resolved here so a register stays readable if a catalogue entry is ever
    // retired: the label falls back to the stored key rather than to nothing.
    docTypeLabel: docTypeLabel(r.docType),
    category: (entry?.category as DocumentCategory | undefined) ?? null,
    status: r.status,
    title: r.title,
    clientId: r.clientId,
    clientName: r.clientName,
    projectId: r.projectId,
    projectName: r.projectName,
    counterpartyName: r.counterpartyName,
    issueDate: ymd(r.issueDate),
    effectiveDate: ymd(r.effectiveDate),
    expiryDate: ymd(r.expiryDate),
    signedAt: ymd(r.signedAt),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function documentDto(r: Row): GeneralDocumentDTO {
  return {
    ...summaryDto(r),
    reference: r.reference,
    counterpartyAddress: r.counterpartyAddress,
    contactName: r.contactName,
    contactEmail: r.contactEmail,
    subject: r.subject,
    values: toValues(r.values),
    body: r.body,
    notes: r.notes,
    supersedesId: r.supersedesId,
    voidReason: r.voidReason,
    createdByName: r.createdByName,
    issuedByName: r.issuedByName,
    createdAt: r.createdAt.toISOString(),
  };
}

// ── Reads ──────────────────────────────────────────────────────────────────

export async function listGeneralDocuments(
  filter: { projectId?: string; docType?: string } = {},
): Promise<GeneralDocumentSummaryDTO[]> {
  const rows = await prisma.generalDocument.findMany({
    where: {
      deletedAt: null,
      ...(filter.projectId ? { projectId: filter.projectId } : {}),
      ...(filter.docType ? { docType: filter.docType } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
  });
  return (rows as Row[]).map(summaryDto);
}

/** One document, by id or by number. Null when it is not this practice's. */
export async function getGeneralDocument(idOrNumber: string): Promise<GeneralDocumentDTO | null> {
  const row = await prisma.generalDocument.findFirst({
    where: { deletedAt: null, OR: [{ id: idOrNumber }, { number: idOrNumber }] },
  });
  return row ? documentDto(row as Row) : null;
}

/** Every number ever used, soft-deleted included, so one is never reused. */
async function allNumbers(): Promise<string[]> {
  const rows = await prisma.generalDocument.findMany({ select: { number: true } });
  return rows.map((r) => r.number);
}

async function assertNumberFree(number: string, exceptId?: string): Promise<void> {
  const clash = await prisma.generalDocument.findFirst({
    where: { number, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new DocumentNumberInUseError(number);
}

/** The document, or an error — and its status, for the immutability rule. */
async function requireDocument(id: string): Promise<{ id: string; status: GeneralDocumentStatus; docType: string }> {
  const row = await prisma.generalDocument.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, docType: true },
  });
  if (!row) throw new DocumentNotFoundError();
  return row as { id: string; status: GeneralDocumentStatus; docType: string };
}

// ── Writes ─────────────────────────────────────────────────────────────────

function writeData(input: GeneralDocumentInput) {
  return {
    docType: input.docType,
    title: input.title.trim(),
    clientId: input.clientId ?? null,
    clientName: input.clientName ?? null,
    projectId: input.projectId ?? null,
    projectName: input.projectName ?? null,
    counterpartyName: input.counterpartyName ?? null,
    counterpartyAddress: input.counterpartyAddress ?? null,
    contactName: input.contactName ?? null,
    contactEmail: input.contactEmail ?? null,
    subject: input.subject ?? null,
    reference: input.reference ?? null,
    issueDate: toDate(input.issueDate),
    effectiveDate: toDate(input.effectiveDate),
    expiryDate: toDate(input.expiryDate),
    values: input.values ?? {},
    body: input.body,
    notes: input.notes ?? null,
  };
}

export async function createGeneralDocument(
  input: GeneralDocumentInput,
): Promise<GeneralDocumentDTO> {
  const who = await actor();
  const asked = input.number?.trim() || undefined;
  const number = asked ?? nextDocumentNumber(await allNumbers(), new Date().getFullYear());
  if (asked) await assertNumberFree(asked);

  try {
    const created = await prisma.generalDocument.create({
      data: {
        ...writeData(input),
        number,
        createdById: who.id,
        createdByName: who.name,
      },
    });
    return documentDto(created as Row);
  } catch (e) {
    if (isUniqueViolation(e)) throw new DocumentNumberInUseError(number);
    throw e;
  }
}

export async function updateGeneralDocument(
  id: string,
  input: GeneralDocumentInput,
): Promise<GeneralDocumentDTO> {
  const current = await requireDocument(id);
  if (current.status !== "DRAFT") throw new DocumentLockedError("edited");

  const asked = input.number?.trim() || undefined;
  if (asked) await assertNumberFree(asked, id);

  try {
    const updated = await prisma.generalDocument.update({
      where: { id },
      data: { ...writeData(input), ...(asked ? { number: asked } : {}) },
    });
    return documentDto(updated as Row);
  } catch (e) {
    if (isUniqueViolation(e)) throw new DocumentNumberInUseError(asked ?? "that number");
    throw e;
  }
}

/**
 * Issue it: the document stops being editable and gets a date if it has none.
 *
 * The required-field check happens in the action, through the catalogue — this
 * layer will not silently issue an incomplete instrument, but it also does not
 * own the wording of the refusal.
 */
export async function issueGeneralDocument(
  id: string,
  issueDate?: string | null,
): Promise<GeneralDocumentDTO> {
  const current = await requireDocument(id);
  if (current.status !== "DRAFT") throw new DocumentLockedError("issued again");
  const who = await actor();
  const updated = await prisma.generalDocument.update({
    where: { id },
    data: {
      status: "ISSUED",
      issuedByName: who.name,
      issueDate: toDate(issueDate) ?? new Date(),
    },
  });
  return documentDto(updated as Row);
}

/** Record that it came back signed. */
export async function markGeneralDocumentSigned(
  id: string,
  signedAt: string,
): Promise<GeneralDocumentDTO> {
  const current = await requireDocument(id);
  if (current.status === "DRAFT") {
    throw new DocumentLockedError("marked as signed before it is issued");
  }
  const updated = await prisma.generalDocument.update({
    where: { id },
    data: { status: "SIGNED", signedAt: toDate(signedAt) ?? new Date() },
  });
  return documentDto(updated as Row);
}

/** Withdraw it, with a reason. The text stays readable. */
export async function voidGeneralDocument(
  id: string,
  reason: string,
): Promise<GeneralDocumentDTO> {
  await requireDocument(id);
  const updated = await prisma.generalDocument.update({
    where: { id },
    data: { status: "VOID", voidReason: reason.trim() || "No reason given" },
  });
  return documentDto(updated as Row);
}

/**
 * Supersede it: a new DRAFT carrying the same content, and the old one marked
 * SUPERSEDED. This is how an issued document is "edited" — the record of what
 * went out on the day it went out is never altered.
 */
export async function supersedeGeneralDocument(id: string): Promise<GeneralDocumentDTO> {
  const existing = await getGeneralDocument(id);
  if (!existing) throw new DocumentNotFoundError();
  const who = await actor();
  const number = nextDocumentNumber(await allNumbers(), new Date().getFullYear());

  const [, created] = await prisma.$transaction([
    prisma.generalDocument.update({ where: { id }, data: { status: "SUPERSEDED" } }),
    prisma.generalDocument.create({
      data: {
        number,
        docType: existing.docType,
        title: existing.title,
        reference: existing.reference,
        subject: existing.subject,
        clientId: existing.clientId,
        clientName: existing.clientName,
        projectId: existing.projectId,
        projectName: existing.projectName,
        counterpartyName: existing.counterpartyName,
        counterpartyAddress: existing.counterpartyAddress,
        contactName: existing.contactName,
        contactEmail: existing.contactEmail,
        effectiveDate: toDate(existing.effectiveDate),
        expiryDate: toDate(existing.expiryDate),
        values: existing.values,
        body: existing.body,
        notes: existing.notes,
        supersedesId: existing.id,
        createdById: who.id,
        createdByName: who.name,
      },
    }),
  ]);
  return documentDto(created as Row);
}

/** Soft delete, drafts only. Anything issued is a record and stays. */
export async function deleteGeneralDocument(id: string): Promise<void> {
  const current = await requireDocument(id);
  if (current.status !== "DRAFT") throw new DocumentLockedError("deleted");
  const affected = await prisma.generalDocument.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (affected.count === 0) throw new DocumentNotFoundError();
}
