/**
 * Building Permit data-access. SERVER-ONLY.
 *
 * Additive and self-contained: it never touches the protected Estimates or
 * Schedule systems (docs/protected-systems.md), and it is not the Land
 * Development module's `PermitTask`.
 *
 * Every model here is in TENANT_MODELS (lib/db.ts), so the Prisma extension
 * scopes every read and stamps every write with the signed-in user's company.
 * The one thing it cannot do is scope a `findUnique` whose `select` omits
 * `companyId` — so every single-row read below uses `findFirst`, deliberately.
 * See lib/tenant-scope-findunique.test.ts.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { nextPermitReference } from "@/lib/building-permits/register";
import {
  buildDocumentKey,
  buildLetterKey,
  isDocumentKeyForPermit,
  isLetterKeyForPermit,
  validateLetterPdf,
  validatePermitFile,
} from "@/lib/building-permits/letter-file";
import {
  createSignedDownload,
  createSignedUpload,
  deleteObject,
  isStorageConfigured,
  statObject,
} from "@/lib/server/storage";
import type {
  BuildingPermitApprovalDTO,
  BuildingPermitApprovalInput,
  BuildingPermitCorrespondenceDTO,
  BuildingPermitCorrespondenceInput,
  BuildingPermitDTO,
  BuildingPermitDocumentDTO,
  BuildingPermitDocumentInput,
  BuildingPermitInput,
  BuildingPermitMeetingDTO,
  BuildingPermitMeetingInput,
  BuildingPermitSubmissionDTO,
  BuildingPermitSubmissionInput,
  BuildingPermitSummaryDTO,
  PermitLetterPdf,
  PermitRegisterFilter,
} from "@/lib/building-permits/types";

/** Thrown when a reference is already in use inside this practice. */
export class PermitReferenceInUseError extends Error {
  constructor(reference: string) {
    super(`Reference "${reference}" is already used by another permit.`);
    this.name = "PermitReferenceInUseError";
  }
}

/** Thrown when a letter's PDF cannot be taken — words written for the user. */
export class PermitLetterFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermitLetterFileError";
  }
}

/** Thrown when the permit does not exist, or belongs to another practice. */
export class PermitNotFoundError extends Error {
  constructor() {
    super("That permit could not be found.");
    this.name = "PermitNotFoundError";
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

/**
 * Run a single-row `update` and turn "no such row" into our own error.
 *
 * `update` — NOT `updateManyAndReturn` — on purpose: the tenant extension in
 * lib/db.ts injects `companyId` into the WHERE of `update`, `delete` and
 * `upsert`, and does not intercept the `*AndReturn` variants at all. Editing a
 * child row by id through one of those would reach across practices.
 */
async function updateOne<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2025") {
      throw new PermitNotFoundError();
    }
    throw e;
  }
}

// ── Conversions ────────────────────────────────────────────────────────────

type DecimalLike = { toNumber(): number } | number | null | undefined;

function num(v: DecimalLike): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = v.toNumber();
  return Number.isFinite(n) ? n : null;
}

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

// ── Row shapes ─────────────────────────────────────────────────────────────

const CHILD_INCLUDE = {
  submissions: { orderBy: [{ submittedAt: "asc" }, { sequence: "asc" }] },
  meetings: { orderBy: { heldAt: "desc" } },
  correspondence: {
    orderBy: [{ letterDate: "desc" }, { createdAt: "desc" }],
    include: {
      documents: {
        where: { NOT: { storageKey: null } },
        select: { id: true, filename: true, sizeBytes: true },
        orderBy: { createdAt: "asc" },
      },
    },
  },
  approvals: { orderBy: [{ decidedAt: "desc" }, { createdAt: "desc" }] },
  documents: { orderBy: [{ documentDate: "desc" }, { createdAt: "desc" }] },
} satisfies Prisma.BuildingPermitInclude;

type PermitRow = Prisma.BuildingPermitGetPayload<{ include: typeof CHILD_INCLUDE }>;
type SubmissionRow = PermitRow["submissions"][number];
type MeetingRow = PermitRow["meetings"][number];
type CorrespondenceRow = PermitRow["correspondence"][number];
type ApprovalRow = PermitRow["approvals"][number];
type DocumentRow = PermitRow["documents"][number];

function submissionDto(r: SubmissionRow): BuildingPermitSubmissionDTO {
  return {
    id: r.id,
    permitId: r.permitId,
    sequence: r.sequence,
    submittedAt: ymd(r.submittedAt)!,
    method: r.method,
    receivedBy: r.receivedBy,
    receiptNumber: r.receiptNumber,
    contents: r.contents,
    notes: r.notes,
    createdByName: r.createdByName,
    createdAt: r.createdAt.toISOString(),
  };
}

function meetingDto(r: MeetingRow): BuildingPermitMeetingDTO {
  return {
    id: r.id,
    permitId: r.permitId,
    heldAt: ymd(r.heldAt)!,
    subject: r.subject,
    location: r.location,
    attendees: r.attendees,
    minutes: r.minutes,
    decisions: r.decisions,
    followUp: r.followUp,
    createdByName: r.createdByName,
    createdAt: r.createdAt.toISOString(),
  };
}

/** The letter's PDF — the first stored file on it — without its storage key. */
function letterPdf(r: Pick<CorrespondenceRow, "documents">): PermitLetterPdf | null {
  const doc = r.documents[0];
  return doc ? { documentId: doc.id, filename: doc.filename, sizeBytes: doc.sizeBytes } : null;
}

function correspondenceDto(r: CorrespondenceRow): BuildingPermitCorrespondenceDTO {
  return {
    id: r.id,
    permitId: r.permitId,
    direction: r.direction,
    letterRef: r.letterRef,
    party: r.party,
    subject: r.subject,
    letterDate: ymd(r.letterDate),
    receivedAt: ymd(r.receivedAt),
    summary: r.summary,
    requiresResponse: r.requiresResponse,
    responseDueAt: ymd(r.responseDueAt),
    respondedAt: ymd(r.respondedAt),
    createdByName: r.createdByName,
    createdAt: r.createdAt.toISOString(),
    pdf: letterPdf(r),
  };
}

function approvalDto(r: ApprovalRow): BuildingPermitApprovalDTO {
  return {
    id: r.id,
    permitId: r.permitId,
    stage: r.stage,
    status: r.status,
    decidedAt: ymd(r.decidedAt),
    refNumber: r.refNumber,
    validUntil: ymd(r.validUntil),
    conditions: r.conditions,
    notes: r.notes,
    createdByName: r.createdByName,
    createdAt: r.createdAt.toISOString(),
  };
}

function documentDto(r: DocumentRow): BuildingPermitDocumentDTO {
  return {
    id: r.id,
    permitId: r.permitId,
    name: r.name,
    category: r.category,
    storageKey: r.storageKey,
    externalUrl: r.externalUrl,
    filename: r.filename,
    mimeType: r.mimeType,
    sizeBytes: r.sizeBytes,
    documentDate: ymd(r.documentDate),
    uploadedByName: r.uploadedByName,
    notes: r.notes,
    // Set when this file IS a letter's PDF. The documents section lists the
    // loose files only; showing every letter attachment there as well would
    // make the correspondence look duplicated.
    correspondenceId: r.correspondenceId,
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * The earliest deadline on an incoming letter that still has no reply. This is
 * the number the register turns red, so it is computed from the letters rather
 * than stored on the permit — a cached flag and an unanswered letter drift
 * apart the first time someone edits the letter and not the permit.
 */
function openResponseDue(rows: CorrespondenceRow[]): string | null {
  let earliest: string | null = null;
  for (const r of rows) {
    if (r.direction !== "INCOMING" || !r.requiresResponse || r.respondedAt || !r.responseDueAt) {
      continue;
    }
    const due = ymd(r.responseDueAt)!;
    if (earliest === null || due < earliest) earliest = due;
  }
  return earliest;
}

function summaryDto(r: PermitRow): BuildingPermitSummaryDTO {
  return {
    id: r.id,
    reference: r.reference,
    permitNumber: r.permitNumber,
    title: r.title,
    permitType: r.permitType,
    status: r.status,
    projectId: r.projectId,
    projectName: r.projectName,
    clientName: r.clientName,
    applicantName: r.applicantName,
    siteAddress: r.siteAddress,
    parcelNumber: r.parcelNumber,
    authority: r.authority,
    submittedAt: ymd(r.submittedAt),
    conceptApprovalAt: ymd(r.conceptApprovalAt),
    decisionAt: ymd(r.decisionAt),
    issuedAt: ymd(r.issuedAt),
    expiresAt: ymd(r.expiresAt),
    targetDecisionAt: ymd(r.targetDecisionAt),
    responsibleName: r.responsibleName,
    submissionCount: r.submissions.length,
    meetingCount: r.meetings.length,
    correspondenceCount: r.correspondence.length,
    documentCount: r.documents.length,
    openResponseDueAt: openResponseDue(r.correspondence),
    // Submissions are included oldest first, so the last one is the current version.
    latestSubmissionAt: ymd(r.submissions.at(-1)?.submittedAt),
    letters: r.correspondence.map((c) => ({
      id: c.id,
      direction: c.direction,
      letterRef: c.letterRef,
      subject: c.subject,
      letterDate: ymd(c.letterDate ?? c.receivedAt),
      pdf: letterPdf(c),
    })),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function permitDto(r: PermitRow): BuildingPermitDTO {
  return {
    ...summaryDto(r),
    description: r.description,
    clientId: r.clientId,
    landRegistry: r.landRegistry,
    authorityContact: r.authorityContact,
    authorityEmail: r.authorityEmail,
    lotAreaM2: num(r.lotAreaM2),
    builtAreaM2: num(r.builtAreaM2),
    estimatedValue: num(r.estimatedValue),
    currency: r.currency,
    acknowledgedAt: ymd(r.acknowledgedAt),
    conceptApprovalRef: r.conceptApprovalRef,
    feeAmount: num(r.feeAmount),
    feePaidAt: ymd(r.feePaidAt),
    responsibleId: r.responsibleId,
    notes: r.notes,
    createdByName: r.createdByName,
    createdAt: r.createdAt.toISOString(),
    submissions: r.submissions.map(submissionDto),
    meetings: r.meetings.map(meetingDto),
    correspondence: r.correspondence.map(correspondenceDto),
    approvals: r.approvals.map(approvalDto),
    documents: r.documents.map(documentDto),
  };
}

// ── Reads ──────────────────────────────────────────────────────────────────

/**
 * The register. Filters that narrow the SQL are applied here; the free-text
 * search and the banding stay in lib/building-permits/register.ts so the screen
 * and the printed sheet cannot disagree about what a filter means.
 */
export async function listBuildingPermits(
  filter: Pick<PermitRegisterFilter, "projectId"> = {},
): Promise<BuildingPermitSummaryDTO[]> {
  const rows = await prisma.buildingPermit.findMany({
    where: {
      deletedAt: null,
      ...(filter.projectId ? { projectId: filter.projectId } : {}),
    },
    include: CHILD_INCLUDE,
    orderBy: [{ createdAt: "desc" }],
  });
  return rows.map(summaryDto);
}

/** One case file, or null when it does not exist or belongs to another practice. */
export async function getBuildingPermit(idOrReference: string): Promise<BuildingPermitDTO | null> {
  const row = await prisma.buildingPermit.findFirst({
    where: { deletedAt: null, OR: [{ id: idOrReference }, { reference: idOrReference }] },
    include: CHILD_INCLUDE,
  });
  return row ? permitDto(row) : null;
}

/** Every authority this practice has ever filed with — the register's filter. */
export async function listPermitAuthorities(): Promise<string[]> {
  const rows = await prisma.buildingPermit.findMany({
    where: { deletedAt: null, NOT: { authority: null } },
    select: { authority: true },
    distinct: ["authority"],
    orderBy: { authority: "asc" },
  });
  return rows.map((r) => r.authority!).filter(Boolean);
}

/**
 * Every reference this practice has ever used, soft-deleted files included, so
 * one is never reused.
 */
async function allReferences(): Promise<string[]> {
  const rows = await prisma.buildingPermit.findMany({ select: { reference: true } });
  return rows.map((r) => r.reference);
}

async function assertReferenceFree(reference: string, exceptId?: string): Promise<void> {
  const clash = await prisma.buildingPermit.findFirst({
    where: { reference, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  if (clash) throw new PermitReferenceInUseError(reference);
}

/** The permit exists and is ours — the guard every child write runs first. */
async function requirePermit(permitId: string): Promise<string> {
  const row = await prisma.buildingPermit.findFirst({
    where: { id: permitId, deletedAt: null },
    select: { id: true },
  });
  if (!row) throw new PermitNotFoundError();
  return row.id;
}

// ── Writes: the case file ──────────────────────────────────────────────────

function writeData(input: BuildingPermitInput) {
  return {
    permitNumber: input.permitNumber ?? null,
    title: input.title.trim(),
    permitType: input.permitType,
    status: input.status,
    description: input.description ?? null,
    projectId: input.projectId ?? null,
    projectName: input.projectName ?? null,
    clientId: input.clientId ?? null,
    clientName: input.clientName ?? null,
    applicantName: input.applicantName ?? null,
    siteAddress: input.siteAddress ?? null,
    parcelNumber: input.parcelNumber ?? null,
    landRegistry: input.landRegistry ?? null,
    authority: input.authority ?? null,
    authorityContact: input.authorityContact ?? null,
    authorityEmail: input.authorityEmail ?? null,
    lotAreaM2: input.lotAreaM2 ?? null,
    builtAreaM2: input.builtAreaM2 ?? null,
    estimatedValue: input.estimatedValue ?? null,
    ...(input.currency ? { currency: input.currency } : {}),
    submittedAt: toDate(input.submittedAt),
    acknowledgedAt: toDate(input.acknowledgedAt),
    conceptApprovalAt: toDate(input.conceptApprovalAt),
    conceptApprovalRef: input.conceptApprovalRef ?? null,
    decisionAt: toDate(input.decisionAt),
    issuedAt: toDate(input.issuedAt),
    expiresAt: toDate(input.expiresAt),
    targetDecisionAt: toDate(input.targetDecisionAt),
    feeAmount: input.feeAmount ?? null,
    feePaidAt: toDate(input.feePaidAt),
    responsibleId: input.responsibleId ?? null,
    responsibleName: input.responsibleName ?? null,
    notes: input.notes ?? null,
  };
}

export async function createBuildingPermit(input: BuildingPermitInput): Promise<BuildingPermitDTO> {
  const who = await actor();
  // A reference the user typed wins; blank falls back to the practice sequence.
  const asked = input.reference?.trim() || undefined;
  const reference = asked ?? nextPermitReference(await allReferences(), new Date().getFullYear());
  if (asked) await assertReferenceFree(asked);

  try {
    const created = await prisma.buildingPermit.create({
      data: {
        ...writeData(input),
        reference,
        createdById: who.id,
        createdByName: who.name,
        updatedById: who.id,
      },
      include: CHILD_INCLUDE,
    });
    return permitDto(created);
  } catch (e) {
    if (isUniqueViolation(e)) throw new PermitReferenceInUseError(reference);
    throw e;
  }
}

export async function updateBuildingPermit(
  id: string,
  input: BuildingPermitInput,
): Promise<BuildingPermitDTO> {
  const who = await actor();
  const current = await prisma.buildingPermit.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, reference: true },
  });
  if (!current) throw new PermitNotFoundError();

  const asked = input.reference?.trim() || undefined;
  if (asked && asked !== current.reference) await assertReferenceFree(asked, id);

  try {
    const updated = await prisma.buildingPermit.update({
      where: { id },
      data: {
        ...writeData(input),
        ...(asked ? { reference: asked } : {}),
        updatedById: who.id,
      },
      include: CHILD_INCLUDE,
    });
    return permitDto(updated);
  } catch (e) {
    if (isUniqueViolation(e)) throw new PermitReferenceInUseError(asked ?? current.reference);
    throw e;
  }
}

/**
 * Soft delete. A permit file is the practice's record of what it told an
 * authority and when; deleting the row would delete that answer, so the row
 * stays and the register stops showing it.
 */
export async function deleteBuildingPermit(id: string): Promise<void> {
  const affected = await prisma.buildingPermit.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (affected.count === 0) throw new PermitNotFoundError();
}

// ── Writes: the children ───────────────────────────────────────────────────
//
// Each child is created top-level (never through a nested `create` on the
// permit), so the tenant extension stamps `companyId` on it. A nested create
// would not be stamped — see the `stampCompany` note in lib/db.ts.

export async function addSubmission(
  permitId: string,
  input: BuildingPermitSubmissionInput,
): Promise<BuildingPermitSubmissionDTO> {
  await requirePermit(permitId);
  const who = await actor();
  const count = await prisma.buildingPermitSubmission.count({ where: { permitId } });
  const row = await prisma.buildingPermitSubmission.create({
    data: {
      permitId,
      sequence: count + 1,
      submittedAt: toDate(input.submittedAt)!,
      method: input.method,
      receivedBy: input.receivedBy ?? null,
      receiptNumber: input.receiptNumber ?? null,
      contents: input.contents ?? null,
      notes: input.notes ?? null,
      createdByName: who.name,
    },
  });
  // The file's submittal date is the FIRST time it went in. Logging that first
  // trip fills it in; a resubmission never moves it, or lapsed time would restart.
  await prisma.buildingPermit.updateMany({
    where: { id: permitId, submittedAt: null },
    data: { submittedAt: row.submittedAt },
  });
  return submissionDto(row as SubmissionRow);
}

export async function deleteSubmission(id: string): Promise<void> {
  const affected = await prisma.buildingPermitSubmission.deleteMany({ where: { id } });
  if (affected.count === 0) throw new PermitNotFoundError();
}

export async function addMeeting(
  permitId: string,
  input: BuildingPermitMeetingInput,
): Promise<BuildingPermitMeetingDTO> {
  await requirePermit(permitId);
  const who = await actor();
  const row = await prisma.buildingPermitMeeting.create({
    data: {
      permitId,
      heldAt: toDate(input.heldAt)!,
      subject: input.subject.trim(),
      location: input.location ?? null,
      attendees: input.attendees ?? null,
      minutes: input.minutes ?? null,
      decisions: input.decisions ?? null,
      followUp: input.followUp ?? null,
      createdByName: who.name,
    },
  });
  return meetingDto(row as MeetingRow);
}

export async function updateMeeting(
  id: string,
  input: BuildingPermitMeetingInput,
): Promise<BuildingPermitMeetingDTO> {
  const row = await updateOne(() =>
    prisma.buildingPermitMeeting.update({
      where: { id },
      data: {
        heldAt: toDate(input.heldAt)!,
        subject: input.subject.trim(),
        location: input.location ?? null,
        attendees: input.attendees ?? null,
        minutes: input.minutes ?? null,
        decisions: input.decisions ?? null,
        followUp: input.followUp ?? null,
      },
    }),
  );
  return meetingDto(row as MeetingRow);
}

export async function deleteMeeting(id: string): Promise<void> {
  const affected = await prisma.buildingPermitMeeting.deleteMany({ where: { id } });
  if (affected.count === 0) throw new PermitNotFoundError();
}

// ── Letter PDFs ────────────────────────────────────────────────────────────
//
// The drawing-intake storage path exactly (lib/server/storage.ts): the server
// names the object and signs an upload URL, the browser PUTs the bytes straight
// to the private bucket, and only then does the server record the row — after
// checking the object really exists under a key it would have issued.

/** An uploaded letter PDF the browser hands back, to be recorded on a letter. */
export type UploadedLetterPdf = { storageKey: string; filename: string };

export type LetterUploadTicket = {
  uploadUrl: string;
  storageKey: string;
  headers: Record<string, string>;
};

function requireStorage(): void {
  if (!isStorageConfigured()) {
    throw new PermitLetterFileError(
      "File storage is not connected on this deployment, so PDFs cannot be attached yet.",
    );
  }
}

export async function createLetterUploadTicket(
  permitId: string,
  file: { filename: string; mimeType: string; sizeBytes: number },
): Promise<LetterUploadTicket> {
  requireStorage();
  const id = await requirePermit(permitId);
  const verdict = validateLetterPdf({ name: file.filename, size: file.sizeBytes, type: file.mimeType });
  if (!verdict.ok) throw new PermitLetterFileError(verdict.message);
  const signed = await createSignedUpload(buildLetterKey(id, file.filename, randomUUID()));
  return {
    uploadUrl: signed.uploadUrl,
    storageKey: signed.storageKey,
    headers: { "content-type": "application/pdf" },
  };
}

/**
 * Check an uploaded PDF before a row points at it: the key is one we issued for
 * THIS permit, the object is really there, and it is still a PDF-sized file.
 */
async function confirmLetterPdf(
  permitId: string,
  pdf: UploadedLetterPdf,
): Promise<{ storageKey: string; filename: string; sizeBytes: number }> {
  requireStorage();
  const storageKey = String(pdf?.storageKey ?? "").trim();
  if (!isLetterKeyForPermit(storageKey, permitId)) {
    throw new PermitLetterFileError("That upload does not belong to this permit.");
  }
  const object = await statObject(storageKey);
  if (!object) throw new PermitLetterFileError("The PDF did not finish uploading. Try again.");
  const filename = String(pdf.filename ?? "").trim().slice(0, 255) || "letter.pdf";
  const verdict = validateLetterPdf({ name: filename, size: object.sizeBytes, type: "" });
  if (!verdict.ok) {
    await deleteObject(storageKey).catch(() => {});
    throw new PermitLetterFileError(verdict.message);
  }
  return { storageKey, filename, sizeBytes: object.sizeBytes };
}

async function recordLetterPdf(
  permitId: string,
  correspondenceId: string,
  subject: string,
  letterDate: Date | null,
  pdf: UploadedLetterPdf,
  uploadedByName: string | null,
): Promise<void> {
  const file = await confirmLetterPdf(permitId, pdf);
  await prisma.buildingPermitDocument.create({
    data: {
      permitId,
      correspondenceId,
      name: subject,
      category: "LETTER",
      storageKey: file.storageKey,
      filename: file.filename,
      mimeType: "application/pdf",
      sizeBytes: file.sizeBytes,
      documentDate: letterDate,
      uploadedByName,
    },
  });
}

/**
 * Remove an upload that never made it onto a row — the browser uploaded, then
 * the letter failed validation. Ignores a key that is not this permit's, and one
 * a document row already records.
 */
export async function discardLetterUpload(permitId: string, storageKey: string): Promise<void> {
  if (!isStorageConfigured()) return;
  const id = await requirePermit(permitId);
  const key = String(storageKey ?? "").trim();
  if (!isLetterKeyForPermit(key, id)) return;
  const recorded = await prisma.buildingPermitDocument.findFirst({
    where: { storageKey: key },
    select: { id: true },
  });
  if (!recorded) await deleteObject(key).catch(() => {});
}

/** Attach a PDF to a letter already on the file. Returns the permit id. */
export async function attachLetterPdf(
  correspondenceId: string,
  pdf: UploadedLetterPdf,
): Promise<string> {
  const letter = await prisma.buildingPermitCorrespondence.findFirst({
    where: { id: correspondenceId },
    select: { id: true, permitId: true, subject: true, letterDate: true },
  });
  if (!letter) throw new PermitNotFoundError();
  await requirePermit(letter.permitId);
  const who = await actor();
  await recordLetterPdf(letter.permitId, letter.id, letter.subject, letter.letterDate, pdf, who.name);
  return letter.permitId;
}

/**
 * A short-lived signed URL for one stored permit document, or null. The row is
 * read with findFirst so the tenant extension scopes it: another practice's
 * document id resolves to nothing.
 */
export async function getPermitDocumentUrl(id: string): Promise<string | null> {
  const row = await prisma.buildingPermitDocument.findFirst({
    where: { id, permit: { deletedAt: null } },
    select: { storageKey: true },
  });
  if (!row?.storageKey || !isStorageConfigured()) return null;
  return createSignedDownload(row.storageKey);
}

/** Delete the stored objects behind document rows, best effort, before the rows go. */
async function deleteStoredObjects(where: Prisma.BuildingPermitDocumentWhereInput): Promise<void> {
  if (!isStorageConfigured()) return;
  const docs = await prisma.buildingPermitDocument.findMany({
    where: { AND: [where, { NOT: { storageKey: null } }] },
    select: { storageKey: true },
  });
  await Promise.all(docs.map((d) => deleteObject(d.storageKey!).catch(() => {})));
}

export async function addCorrespondence(
  permitId: string,
  input: BuildingPermitCorrespondenceInput,
  pdf?: UploadedLetterPdf | null,
): Promise<BuildingPermitCorrespondenceDTO> {
  await requirePermit(permitId);
  const who = await actor();
  // Check the PDF BEFORE the letter is written, so a bad upload never leaves a
  // letter behind that the user believes carries its PDF.
  if (pdf) await confirmLetterPdf(permitId, pdf);
  const row = await prisma.buildingPermitCorrespondence.create({
    data: {
      permitId,
      direction: input.direction,
      letterRef: input.letterRef ?? null,
      party: input.party ?? null,
      subject: input.subject.trim(),
      letterDate: toDate(input.letterDate),
      receivedAt: toDate(input.receivedAt),
      summary: input.summary ?? null,
      requiresResponse: input.requiresResponse,
      responseDueAt: toDate(input.responseDueAt),
      respondedAt: toDate(input.respondedAt),
      createdByName: who.name,
    },
  });
  if (pdf) {
    try {
      await recordLetterPdf(permitId, row.id, row.subject, row.letterDate, pdf, who.name);
    } catch (e) {
      await prisma.buildingPermitCorrespondence.deleteMany({ where: { id: row.id } });
      throw e;
    }
  }
  const saved = await prisma.buildingPermitCorrespondence.findFirst({
    where: { id: row.id },
    include: CHILD_INCLUDE.correspondence.include,
  });
  return correspondenceDto(saved!);
}

export async function updateCorrespondence(
  id: string,
  input: BuildingPermitCorrespondenceInput,
): Promise<BuildingPermitCorrespondenceDTO> {
  const row = await updateOne(() =>
    prisma.buildingPermitCorrespondence.update({
      where: { id },
      data: {
        direction: input.direction,
        letterRef: input.letterRef ?? null,
        party: input.party ?? null,
        subject: input.subject.trim(),
        letterDate: toDate(input.letterDate),
        receivedAt: toDate(input.receivedAt),
        summary: input.summary ?? null,
        requiresResponse: input.requiresResponse,
        responseDueAt: toDate(input.responseDueAt),
        respondedAt: toDate(input.respondedAt),
      },
      include: CHILD_INCLUDE.correspondence.include,
    }),
  );
  return correspondenceDto(row);
}

export async function deleteCorrespondence(id: string): Promise<void> {
  await deleteStoredObjects({ correspondenceId: id });
  const affected = await prisma.buildingPermitCorrespondence.deleteMany({ where: { id } });
  if (affected.count === 0) throw new PermitNotFoundError();
}

export async function addApproval(
  permitId: string,
  input: BuildingPermitApprovalInput,
): Promise<BuildingPermitApprovalDTO> {
  await requirePermit(permitId);
  const who = await actor();
  const row = await prisma.buildingPermitApproval.create({
    data: {
      permitId,
      stage: input.stage,
      status: input.status,
      decidedAt: toDate(input.decidedAt),
      refNumber: input.refNumber ?? null,
      validUntil: toDate(input.validUntil),
      conditions: input.conditions ?? null,
      notes: input.notes ?? null,
      createdByName: who.name,
    },
  });
  // A decided concept approval is also a date on the case file: the office
  // quotes it for months before the permit itself exists. Filled in only while
  // still blank — a date typed on the file wins over a row added later.
  if (
    row.stage === "CONCEPT" &&
    (row.status === "APPROVED" || row.status === "APPROVED_WITH_CONDITIONS") &&
    row.decidedAt
  ) {
    await prisma.buildingPermit.updateMany({
      where: { id: permitId, conceptApprovalAt: null },
      data: {
        conceptApprovalAt: row.decidedAt,
        ...(row.refNumber ? { conceptApprovalRef: row.refNumber } : {}),
      },
    });
  }
  return approvalDto(row as ApprovalRow);
}

export async function updateApproval(
  id: string,
  input: BuildingPermitApprovalInput,
): Promise<BuildingPermitApprovalDTO> {
  const row = await updateOne(() =>
    prisma.buildingPermitApproval.update({
      where: { id },
      data: {
        stage: input.stage,
        status: input.status,
        decidedAt: toDate(input.decidedAt),
        refNumber: input.refNumber ?? null,
        validUntil: toDate(input.validUntil),
        conditions: input.conditions ?? null,
        notes: input.notes ?? null,
      },
    }),
  );
  return approvalDto(row as ApprovalRow);
}

export async function deleteApproval(id: string): Promise<void> {
  const affected = await prisma.buildingPermitApproval.deleteMany({ where: { id } });
  if (affected.count === 0) throw new PermitNotFoundError();
}

/**
 * Sign an upload for a loose file on the case: a stamped application form, a
 * receipt, a photo of the site notice. The same path as a letter PDF, under a
 * different prefix and with a wider set of file types — see
 * lib/building-permits/letter-file.ts.
 */
export async function createDocumentUploadTicket(
  permitId: string,
  file: { filename: string; mimeType: string; sizeBytes: number },
): Promise<LetterUploadTicket> {
  requireStorage();
  const id = await requirePermit(permitId);
  const verdict = validatePermitFile({
    name: file.filename,
    size: file.sizeBytes,
    type: file.mimeType,
  });
  if (!verdict.ok) throw new PermitLetterFileError(verdict.message);
  const signed = await createSignedUpload(buildDocumentKey(id, file.filename, randomUUID()));
  return {
    uploadUrl: signed.uploadUrl,
    storageKey: signed.storageKey,
    headers: { "content-type": file.mimeType || "application/octet-stream" },
  };
}

/** Check an uploaded loose file before a row is allowed to point at it. */
async function confirmDocumentFile(
  permitId: string,
  upload: UploadedLetterPdf,
): Promise<{ storageKey: string; filename: string; sizeBytes: number }> {
  requireStorage();
  const storageKey = String(upload?.storageKey ?? "").trim();
  if (!isDocumentKeyForPermit(storageKey, permitId)) {
    throw new PermitLetterFileError("That upload does not belong to this permit.");
  }
  const object = await statObject(storageKey);
  if (!object) throw new PermitLetterFileError("The file did not finish uploading. Try again.");
  const filename = String(upload.filename ?? "").trim().slice(0, 255) || "file";
  const verdict = validatePermitFile({ name: filename, size: object.sizeBytes, type: "" });
  if (!verdict.ok) {
    await deleteObject(storageKey).catch(() => {});
    throw new PermitLetterFileError(verdict.message);
  }
  return { storageKey, filename, sizeBytes: object.sizeBytes };
}

/** Remove a loose-file upload that never made it onto a row. */
export async function discardDocumentUpload(permitId: string, storageKey: string): Promise<void> {
  if (!isStorageConfigured()) return;
  const id = await requirePermit(permitId);
  const key = String(storageKey ?? "").trim();
  if (!isDocumentKeyForPermit(key, id)) return;
  const recorded = await prisma.buildingPermitDocument.findFirst({
    where: { storageKey: key },
    select: { id: true },
  });
  if (!recorded) await deleteObject(key).catch(() => {});
}

export async function addDocument(
  permitId: string,
  input: BuildingPermitDocumentInput,
  upload?: UploadedLetterPdf | null,
): Promise<BuildingPermitDocumentDTO> {
  await requirePermit(permitId);
  const who = await actor();
  // A storageKey only ever arrives by way of a confirmed upload: the browser
  // cannot name an object, and a row must not point at one that is not there.
  const file = upload ? await confirmDocumentFile(permitId, upload) : null;
  const row = await prisma.buildingPermitDocument.create({
    data: {
      permitId,
      name: input.name.trim(),
      category: input.category,
      storageKey: file?.storageKey ?? null,
      externalUrl: input.externalUrl ?? null,
      filename: file?.filename ?? input.filename ?? null,
      mimeType: input.mimeType ?? null,
      sizeBytes: file?.sizeBytes ?? input.sizeBytes ?? null,
      documentDate: toDate(input.documentDate),
      notes: input.notes ?? null,
      uploadedByName: who.name,
    },
  });
  return documentDto(row as DocumentRow);
}

export async function deleteDocument(id: string): Promise<void> {
  await deleteStoredObjects({ id });
  const affected = await prisma.buildingPermitDocument.deleteMany({ where: { id } });
  if (affected.count === 0) throw new PermitNotFoundError();
}

/** The storage key of one document, or null — the gate the download route uses. */
export async function getDocumentStorageKey(id: string): Promise<string | null> {
  const row = await prisma.buildingPermitDocument.findFirst({
    where: { id },
    select: { storageKey: true },
  });
  return row?.storageKey ?? null;
}
