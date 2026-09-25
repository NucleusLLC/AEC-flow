/**
 * Construction contracts and the templates they are filled from — data access.
 * SERVER-ONLY.
 *
 * Every read and write goes through the Prisma tenant extension (both models
 * are in TENANT_MODELS), and single-row reads use `findFirst` rather than
 * `findUnique` for the reason lib/data/invoices.ts sets out: the extension puts
 * the company into the WHERE of a findFirst, while for findUnique it can only
 * inspect the row that comes back, which a narrow `select` defeats.
 *
 * ─── WHAT IS IMMUTABLE ──────────────────────────────────────────────────────
 * A DRAFT may be edited and deleted. An ISSUED contract may not: it is what the
 * practice put in front of a client to sign. It changes by being signed, by
 * being superseded by a new revision, or by being voided with a reason. That is
 * the same rule the invoice module keeps, for the same reason.
 *
 * ─── THE KEY IS CHOSEN BY THE SERVER ────────────────────────────────────────
 * A template upload gets a key built here (`contracts/templates/<id>/<name>`),
 * never one supplied by the browser. A signed upload URL is a capability to
 * write one object; if the client named it, it could name somebody else's.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { requireActor, type Actor } from "@/lib/server/actor";
import {
  createSignedDownload,
  createSignedUpload,
  downloadObject,
  maxUploadBytes,
  statObject,
  type SignedUpload,
} from "@/lib/server/storage";
import { sanitiseFilename } from "@/lib/drawings/storage-key";
import { buildSchedule, reconcileSchedule } from "@/lib/contracts/schedule";
import { baseNumber, nextRevisionNumber, sortFamily } from "@/lib/contracts/revision";
import {
  EMPTY_BODY,
  type ContractBody,
  type ContractFacts,
  type ContractStatus,
} from "@/lib/contracts/types";

export class ContractNotFoundError extends Error {
  constructor(what = "That contract") {
    super(`${what} could not be found.`);
    this.name = "ContractNotFoundError";
  }
}

export class ContractLockedError extends Error {
  constructor(what: string) {
    super(`This contract has been issued, so it cannot be ${what}.`);
    this.name = "ContractLockedError";
  }
}

export class ContractInvalidError extends Error {
  constructor(why: string) {
    super(why);
    this.name = "ContractInvalidError";
  }
}

/** A contract template is a PDF and nothing else — the model reads the layout. */
const TEMPLATE_MIME = "application/pdf";

/** Beyond this the model cannot read it in one pass anyway. */
export const MAX_TEMPLATE_BYTES = 12 * 1024 * 1024;

type DecimalLike = { toNumber(): number } | number | string | null | undefined;

function num(v: DecimalLike): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  const n = v.toNumber();
  return Number.isFinite(n) ? n : 0;
}

/* ------------------------------------------------------------------ *
 * Templates
 * ------------------------------------------------------------------ */

export type TemplateDTO = {
  id: string;
  name: string;
  description: string | null;
  filename: string;
  sizeBytes: number;
  archived: boolean;
  uploadedByName: string | null;
  createdAt: string;
};

export function templateStorageKey(uploadId: string, filename: string): string {
  return `contracts/templates/${uploadId}/${sanitiseFilename(filename)}`;
}

/** True when `key` is one this module would have issued. */
export function isTemplateKey(key: string): boolean {
  return typeof key === "string" && /^contracts\/templates\/[A-Za-z0-9-]+\/[^/]+$/.test(key);
}

export async function listTemplates(includeArchived = false): Promise<TemplateDTO[]> {
  await requireActor();
  const rows = await prisma.contractTemplate.findMany({
    where: { deletedAt: null, ...(includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    filename: r.filename,
    sizeBytes: r.sizeBytes,
    archived: Boolean(r.archivedAt),
    uploadedByName: r.uploadedByName,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Mint a signed URL the browser PUTs the template straight to. */
export async function createTemplateUpload(input: {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<SignedUpload & { headers: Record<string, string> }> {
  await requireActor();
  if ((input.mimeType || "").toLowerCase() !== TEMPLATE_MIME) {
    throw new ContractInvalidError("A contract template has to be a PDF — the model reads its layout.");
  }
  const ceiling = Math.min(maxUploadBytes(), MAX_TEMPLATE_BYTES);
  if (input.sizeBytes > ceiling) {
    throw new ContractInvalidError(
      `That PDF is larger than the ${Math.round(ceiling / (1024 * 1024))} MB limit for a template.`,
    );
  }
  const key = templateStorageKey(randomUUID(), input.filename);
  const signed = await createSignedUpload(key);
  return { ...signed, headers: { "content-type": TEMPLATE_MIME } };
}

export async function registerTemplate(input: {
  name: string;
  description?: string | null;
  storageKey: string;
  filename: string;
}): Promise<TemplateDTO> {
  const actor = await requireActor();
  if (!isTemplateKey(input.storageKey)) {
    throw new ContractInvalidError("That file reference is not one this app issued.");
  }
  // Trust storage, not the caller, for what actually landed — and catch the
  // ordinary failure where the PUT never completed.
  const object = await statObject(input.storageKey);
  if (!object) {
    throw new ContractInvalidError("The template did not finish uploading, so nothing was saved.");
  }

  const row = await prisma.contractTemplate.create({
    data: {
      name: String(input.name ?? "").trim() || input.filename,
      description: input.description?.trim() || null,
      storageKey: input.storageKey,
      filename: String(input.filename ?? "").slice(0, 255),
      mimeType: object.mimeType || TEMPLATE_MIME,
      sizeBytes: object.sizeBytes,
      uploadedById: actor.id,
      uploadedByName: actor.name,
    },
  });

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    filename: row.filename,
    sizeBytes: row.sizeBytes,
    archived: false,
    uploadedByName: row.uploadedByName,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function archiveTemplate(id: string, archived: boolean): Promise<void> {
  await requireActor();
  const row = await prisma.contractTemplate.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!row) throw new ContractNotFoundError("That template");
  await prisma.contractTemplate.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
  });
}

/** The template's bytes, for the model. Never exposed to the browser. */
export async function readTemplateBytes(id: string): Promise<{ bytes: Uint8Array; name: string }> {
  await requireActor();
  const row = await prisma.contractTemplate.findFirst({
    where: { id, deletedAt: null },
    select: { storageKey: true, name: true, filename: true },
  });
  if (!row) throw new ContractNotFoundError("That template");
  const bytes = await downloadObject(row.storageKey, MAX_TEMPLATE_BYTES);
  if (!bytes) throw new ContractInvalidError("The template could not be read back from storage.");
  return { bytes, name: row.name || row.filename };
}

/** A signed URL so a user can open the template they uploaded. */
export async function templateFileUrl(id: string): Promise<string> {
  await requireActor();
  const row = await prisma.contractTemplate.findFirst({
    where: { id, deletedAt: null },
    select: { storageKey: true },
  });
  if (!row) throw new ContractNotFoundError("That template");
  return createSignedDownload(row.storageKey);
}

/* ------------------------------------------------------------------ *
 * Contracts
 * ------------------------------------------------------------------ */

export type ContractSummaryDTO = {
  id: string;
  number: string;
  status: ContractStatus;
  projectId: string | null;
  projectName: string;
  projectNumber: string | null;
  employerName: string;
  contractorName: string;
  currency: string;
  contractSum: number;
  templateName: string | null;
  issuedAt: string | null;
  signedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
};

export type ContractDTO = ContractSummaryDTO & {
  exchangeRate: number;
  /** Which template it was written from, so a revision starts from the same one. */
  templateId: string | null;
  facts: ContractFacts;
  body: ContractBody;
  modelId: string | null;
  generatedAt: string | null;
  supersedesId: string | null;
  voidReason: string | null;
};

const SUMMARY_SELECT = {
  id: true,
  number: true,
  status: true,
  projectId: true,
  projectName: true,
  projectNumber: true,
  employerName: true,
  contractorName: true,
  currency: true,
  contractSum: true,
  templateName: true,
  issuedAt: true,
  signedAt: true,
  createdAt: true,
  updatedAt: true,
  createdByName: true,
} as const;

type SummaryRow = {
  id: string;
  number: string;
  status: string;
  projectId: string | null;
  projectName: string;
  projectNumber: string | null;
  employerName: string;
  contractorName: string;
  currency: string;
  contractSum: DecimalLike;
  templateName: string | null;
  issuedAt: Date | null;
  signedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdByName: string | null;
};

function toSummary(r: SummaryRow): ContractSummaryDTO {
  return {
    id: r.id,
    number: r.number,
    status: r.status as ContractStatus,
    projectId: r.projectId,
    projectName: r.projectName,
    projectNumber: r.projectNumber,
    employerName: r.employerName,
    contractorName: r.contractorName,
    currency: r.currency,
    contractSum: num(r.contractSum),
    templateName: r.templateName,
    issuedAt: r.issuedAt?.toISOString() ?? null,
    signedAt: r.signedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    createdByName: r.createdByName,
  };
}

export async function listContracts(projectId?: string): Promise<ContractSummaryDTO[]> {
  await requireActor();
  const rows = await prisma.constructionContract.findMany({
    where: { deletedAt: null, ...(projectId ? { projectId } : {}) },
    orderBy: [{ createdAt: "desc" }],
    select: SUMMARY_SELECT,
    take: 500,
  });
  return rows.map((r) => toSummary(r as SummaryRow));
}

export async function getContract(id: string): Promise<ContractDTO | null> {
  await requireActor();
  const row = await prisma.constructionContract.findFirst({ where: { id, deletedAt: null } });
  if (!row) return null;
  return {
    ...toSummary(row as unknown as SummaryRow),
    exchangeRate: num(row.exchangeRate),
    templateId: row.templateId,
    facts: row.facts as unknown as ContractFacts,
    body: (row.body as unknown as ContractBody) ?? EMPTY_BODY,
    modelId: row.modelId,
    generatedAt: row.generatedAt?.toISOString() ?? null,
    supersedesId: row.supersedesId,
    voidReason: row.voidReason,
  };
}

/** `CC-{year}-{NNN}`, one past the highest number the practice has ever used. */
export async function nextContractNumber(year = new Date().getFullYear()): Promise<string> {
  const rows = await prisma.constructionContract.findMany({ select: { number: true }, take: 2000 });
  let max = 0;
  for (const r of rows) {
    const m = /(\d+)\s*$/.exec(r.number);
    if (m && Number(m[1]) > max) max = Number(m[1]);
  }
  return `CC-${year}-${String(max + 1).padStart(3, "0")}`;
}

/**
 * The number the next revision of `id` should carry.
 *
 * The whole family is read, not just the one being revised: two people revising
 * at once, or someone revising a superseded version, must not both land on the
 * same letter. Falls back to a plain new number if the predecessor has gone.
 */
async function nextRevisionNumberFor(id: string): Promise<string> {
  const previous = await prisma.constructionContract.findFirst({
    where: { id, deletedAt: null },
    select: { number: true },
  });
  if (!previous) return nextContractNumber();
  const held = await prisma.constructionContract.findMany({ select: { number: true }, take: 2000 });
  return nextRevisionNumber(previous.number, held.map((r) => r.number));
}

/** What the next revision of `id` will be numbered — for the screen that offers it. */
export async function nextRevisionNumberPreview(id: string): Promise<string> {
  await requireActor();
  return nextRevisionNumberFor(id);
}

/** Every version of one contract, oldest first, whichever one you start from. */
export async function contractFamily(id: string): Promise<ContractSummaryDTO[]> {
  await requireActor();
  const start = await prisma.constructionContract.findFirst({
    where: { id, deletedAt: null },
    select: { number: true },
  });
  if (!start) return [];
  const base = baseNumber(start.number);

  // Matched on the NUMBER, not by walking `supersedesId`. The chain is only as
  // good as its weakest link — one revision saved without a predecessor and the
  // history silently splits in two — whereas every version of a contract
  // carries the base number by construction.
  const rows = await prisma.constructionContract.findMany({
    where: { deletedAt: null, OR: [{ number: base }, { number: { startsWith: `${base} Rev ` } }] },
    select: SUMMARY_SELECT,
    take: 100,
  });
  return sortFamily(rows.map(toSummary));
}

/**
 * Store a freshly generated contract.
 *
 * THE SCHEDULE IS RECOMPUTED HERE, not taken from the model: `buildSchedule`
 * divides the contract sum in integer cents and `reconcileSchedule` keeps only
 * the model's words. Whatever arrived in `body.schedule` is overwritten.
 */
export async function saveGenerated(input: {
  facts: ContractFacts;
  body: ContractBody;
  templateId: string | null;
  templateName: string | null;
  modelId: string;
  supersedesId?: string | null;
}): Promise<ContractDTO> {
  const actor = await requireActor();
  const facts = input.facts;

  const built = buildSchedule({
    contractSum: facts.contractSum,
    currency: facts.currency,
    exchangeRate: facts.exchangeRate,
    phases: facts.phases,
  });

  const body: ContractBody = {
    ...input.body,
    schedule: reconcileSchedule(built.rows, input.body.schedule),
  };

  const project = facts.projectId
    ? await prisma.project.findFirst({
        where: { id: facts.projectId },
        select: { id: true, name: true, projectNumber: true },
      })
    : null;

  // A revision keeps the contract's number and takes the next letter; a new
  // contract takes the next number. See lib/contracts/revision.ts for why the
  // agreement's number must not change when a version of it does.
  const number = input.supersedesId
    ? await nextRevisionNumberFor(input.supersedesId)
    : await nextContractNumber();

  const row = await prisma.constructionContract.create({
    data: {
      number,
      status: "DRAFT",
      projectId: project?.id ?? null,
      projectName: project?.name ?? facts.projectName,
      projectNumber: project?.projectNumber ?? facts.projectNumber ?? null,
      templateId: input.templateId,
      templateName: input.templateName,
      employerName: facts.employerName,
      contractorName: facts.contractorName,
      currency: facts.currency || "AWG",
      contractSum: facts.contractSum,
      exchangeRate: facts.exchangeRate,
      facts: facts as unknown as object,
      body: body as unknown as object,
      modelNotes: { changes: body.changes, check: body.check, warnings: built.warnings } as object,
      modelId: input.modelId,
      generatedAt: new Date(),
      supersedesId: input.supersedesId ?? null,
      createdById: actor.id,
      createdByName: actor.name,
    },
  });

  if (input.supersedesId) {
    await prisma.constructionContract.updateMany({
      where: { id: input.supersedesId, deletedAt: null },
      data: { status: "SUPERSEDED" },
    });
  }

  const saved = await getContract(row.id);
  if (!saved) throw new ContractNotFoundError();
  return saved;
}

/** Edit the document. DRAFTS ONLY — an issued contract is superseded instead. */
export async function updateBody(id: string, body: ContractBody): Promise<void> {
  const actor = await requireActor();
  const row = await prisma.constructionContract.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true, facts: true },
  });
  if (!row) throw new ContractNotFoundError();
  if (row.status !== "DRAFT") throw new ContractLockedError("edited");

  const facts = row.facts as unknown as ContractFacts;
  const built = buildSchedule({
    contractSum: facts.contractSum,
    currency: facts.currency,
    exchangeRate: facts.exchangeRate,
    phases: facts.phases,
  });

  await prisma.constructionContract.update({
    where: { id },
    data: {
      // The figures are never editable prose: a user may rewrite an instalment's
      // NAME, and the amounts are recomputed from the contract sum regardless.
      body: { ...body, schedule: reconcileSchedule(built.rows, body.schedule) } as unknown as object,
      updatedById: actor.id,
    },
  });
}

export async function issueContract(id: string): Promise<void> {
  await requireActor();
  const row = await prisma.constructionContract.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!row) throw new ContractNotFoundError();
  if (row.status !== "DRAFT") throw new ContractLockedError("issued again");
  await prisma.constructionContract.update({
    where: { id },
    data: { status: "ISSUED", issuedAt: new Date() },
  });
}

export async function markSigned(id: string, signedOn: string | null): Promise<void> {
  await requireActor();
  const row = await prisma.constructionContract.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!row) throw new ContractNotFoundError();
  if (row.status !== "ISSUED") {
    throw new ContractInvalidError("Only an issued contract can be marked as signed.");
  }
  const when = signedOn ? new Date(`${signedOn.slice(0, 10)}T00:00:00.000Z`) : new Date();
  await prisma.constructionContract.update({
    where: { id },
    data: { status: "SIGNED", signedAt: Number.isNaN(when.getTime()) ? new Date() : when },
  });
}

export async function voidContract(id: string, reason: string): Promise<void> {
  await requireActor();
  const why = String(reason ?? "").trim();
  if (!why) throw new ContractInvalidError("Say why the contract is being voided.");
  const row = await prisma.constructionContract.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!row) throw new ContractNotFoundError();
  await prisma.constructionContract.update({
    where: { id },
    data: { status: "VOID", voidReason: why.slice(0, 500) },
  });
}

/** Soft delete, and only ever for a DRAFT. */
export async function deleteContract(id: string): Promise<void> {
  await requireActor();
  const row = await prisma.constructionContract.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!row) throw new ContractNotFoundError();
  if (row.status !== "DRAFT") throw new ContractLockedError("deleted");
  await prisma.constructionContract.update({ where: { id }, data: { deletedAt: new Date() } });
}

/** Everyone who could be named as the contract administrator. */
export async function practicePeople(): Promise<{ id: string; name: string }[]> {
  const actor: Actor = await requireActor();
  const rows = await prisma.user.findMany({
    // User is NOT tenant-scoped by the extension — the company filter is ours
    // to carry (see lib/server/actor.ts).
    where: { companyId: actor.companyId, status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return rows;
}
