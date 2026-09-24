/**
 * Drawing intake — the server side of the persistence seam declared in
 * `lib/drawings/persistence.ts`. SERVER-ONLY (Prisma + the storage service key).
 *
 * THE FLOW, and where each guard sits:
 *
 *   1. `createUploadTicket` — the browser says "I have this file". The server
 *      re-runs the upload policy (a client-side limit is a courtesy, not a
 *      control), checks the project belongs to the caller's company, CHOOSES
 *      the object key itself, and returns a short-lived signed URL.
 *   2. The browser PUTs the bytes straight to storage. They never pass through
 *      a serverless function, which is what keeps a 50 MB drawing off its
 *      request-body limit.
 *   3. `registerDrawing` — the server confirms the object really landed (and
 *      reads its true size from storage rather than believing the client),
 *      then writes the row.
 *
 * WHY THE KEY IS SERVER-CHOSEN. A signed upload URL is a capability to write
 * one object. If the client named the object, it could name someone else's.
 *
 * TENANCY. `Drawing` is in TENANT_MODELS (lib/db.ts), so reads and writes are
 * company-scoped by the Prisma extension. The project lookup below is the extra
 * check that the *project* is also ours — otherwise a caller could file a sheet
 * under a project id they merely guessed.
 */

import "server-only";
import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateUpload } from "@/lib/drawings/upload-policy";
import { buildStorageKey, isKeyForProject } from "@/lib/drawings/storage-key";
import { extractDrawingMetadata } from "@/lib/drawings";
import type { DrawingMetadataDraft, Field } from "@/lib/drawings/types";
import { detectPaperSize, undersizeWarning, type DetectedPaper } from "@/lib/drawings/paper";
import { classifySheetType, type SheetType } from "@/lib/drawings/sheet-type";
import { classifySheetTypeWithAi, shouldAskModel } from "@/lib/server/sheet-type-ai";
import { PDF_PARSE_MAX_BYTES, readTitleBlock } from "@/lib/server/pdf-title-block";
import type {
  ConfirmedDrawingMetadata,
  DrawingExtractionAudit,
  ExistingSheet,
  UploadTicket,
} from "@/lib/drawings/persistence";
import type { Discipline, DrawingStatus, FileType } from "@/lib/data/drawings.types";
import {
  createSignedDownload,
  createSignedUpload,
  deleteObject,
  downloadObject,
  isStorageConfigured,
  maxUploadBytes,
  statObject,
} from "@/lib/server/storage";
import type { Prisma } from "@prisma/client";

/* ------------------------------------------------------------------ *
 * Errors the UI is expected to show verbatim
 * ------------------------------------------------------------------ */

export class DrawingIntakeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DrawingIntakeError";
  }
}

/* ------------------------------------------------------------------ *
 * Guards
 * ------------------------------------------------------------------ */

async function requireProject(projectId: string): Promise<{ id: string }> {
  const id = String(projectId ?? "").trim();
  if (!id) throw new DrawingIntakeError("Choose a project before uploading.");
  // findFirst, NOT findUnique. The tenant extension injects `companyId` into a
  // findFirst `where`; for findUnique it can only inspect the ROW that comes
  // back, which means a narrow `select` that omits `companyId` makes the guard
  // compare `undefined` to the company id and reject everything. findFirst puts
  // the scope in the query, so the check works whatever is selected.
  const project = await prisma.project.findFirst({ where: { id }, select: { id: true } });
  if (!project) throw new DrawingIntakeError("That project does not exist, or is not yours.");
  return project;
}

function requireStorage(): void {
  if (!isStorageConfigured()) {
    throw new DrawingIntakeError(
      "File storage is not connected on this deployment, so drawings cannot be uploaded yet.",
    );
  }
}

const DISCIPLINES: readonly Discipline[] = [
  "ARCHITECTURE", "STRUCTURAL", "INTERIOR", "MEP", "CIVIL",
  "LANDSCAPE", "PROJECT_MANAGEMENT", "CONSTRUCTION", "GENERAL",
];
const STATUSES: readonly DrawingStatus[] = [
  "DRAFT", "FOR_REVIEW", "APPROVED", "ISSUED", "SUPERSEDED",
];
const FILE_TYPES: readonly FileType[] = ["PDF", "DWG", "RVT"];

type CleanMetadata = {
  sheetNumber: string;
  title: string;
  discipline: Discipline;
  status: DrawingStatus;
  revision: string;
  /** ISO `YYYY-MM-DD`, or "" for absent. */
  issueDate: string;
};

function cleanMetadata(metadata: ConfirmedDrawingMetadata): CleanMetadata {
  const sheetNumber = String(metadata?.sheetNumber ?? "").trim();
  if (!sheetNumber) {
    // The register's one hard rule. A blank sheet number gets chased; a wrong
    // one gets built from — see the feasibility doc §7.
    throw new DrawingIntakeError("A sheet number is required.");
  }
  const discipline = DISCIPLINES.includes(metadata?.discipline as Discipline)
    ? (metadata.discipline as Discipline)
    : "ARCHITECTURE";
  const status = STATUSES.includes(metadata?.status as DrawingStatus)
    ? (metadata.status as DrawingStatus)
    : "DRAFT";

  return {
    sheetNumber: sheetNumber.toUpperCase(),
    title: String(metadata?.title ?? "").trim(),
    discipline,
    status,
    revision: String(metadata?.revision ?? "").trim() || "-",
    issueDate: String(metadata?.issueDate ?? "").trim(),
  };
}

function toIssueDate(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/* ------------------------------------------------------------------ *
 * The three operations
 * ------------------------------------------------------------------ */

export async function createUploadTicket(input: {
  projectId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<UploadTicket> {
  requireStorage();
  const project = await requireProject(input.projectId);

  // Re-validate everything the browser checked. Same pure function, so the two
  // answers cannot drift.
  const verdict = validateUpload({
    name: input.filename,
    size: input.sizeBytes,
    type: input.mimeType,
  });
  if (!verdict.ok) throw new DrawingIntakeError(verdict.message);

  const ceiling = maxUploadBytes();
  if (input.sizeBytes > ceiling) {
    throw new DrawingIntakeError(
      `The file is larger than this deployment's ${Math.round(ceiling / (1024 * 1024))} MB upload limit.`,
    );
  }

  const key = buildStorageKey(project.id, input.filename, randomUUID());
  const signed = await createSignedUpload(key);
  return {
    uploadUrl: signed.uploadUrl,
    storageKey: signed.storageKey,
    expiresAt: signed.expiresAt,
    headers: { "content-type": input.mimeType || "application/octet-stream" },
  };
}

/* ------------------------------------------------------------------ *
 * Reading the sheet itself
 * ------------------------------------------------------------------ */

/**
 * What the server made of an object that is already in storage.
 *
 * `draft` is always present — worst case it is the filename-only proposal the
 * browser could have produced by itself, which is exactly the point: a failed
 * read degrades the proposal, it never fails the upload.
 */
export type DrawingAnalysis = {
  draft: DrawingMetadataDraft;
  /** True when title-block text was actually found and fed to the extractor.
   *  This is what `DrawingExtractionAudit.inputs.titleBlockText` records, so it
   *  must mean "text was read", not "we tried". */
  usedTitleBlockText: boolean;
  /** `true`/`false` for a PDF that was opened; `null` when nothing was opened
   *  (a DWG, an unreadable file, a deployment with no reader). */
  hasTextLayer: boolean | null;
  /** The plot sheet, read from the PDF media box. Null for anything that was
   *  not opened as a PDF — a DWG has no page to measure. */
  paper: DetectedPaper | null;
  /** Pages in the PDF. More than one means a bound set, not a sheet. */
  pageCount: number | null;
  /** What kind of drawing this is, and who said so. `manual` never appears
   *  here — it is what the register records once a human has corrected it. */
  sheetType: Field<SheetType> | null;
  sheetTypeSource: "rules" | "ai" | null;
  /** One line for the user, explaining where the values came from. */
  note: string;
};

/**
 * Read an already-uploaded object and re-propose its metadata.
 *
 * WHY THE BYTES ARE READ BACK FROM STORAGE. They are already there — the
 * browser PUT them straight to the bucket with a signed URL. Asking it to send
 * them a second time so a serverless function could parse them would double the
 * transfer and put a 50 MB body through a function that has a 4.5 MB limit.
 *
 * TENANCY. Three checks, in order: the project must be ours (`requireProject`),
 * the key must look like one this server issued for that project
 * (`isKeyForProject`), and only then is the object read. A key is a capability;
 * one that did not come from us is an attempt to read someone else's sheet.
 */
export async function analyseUploadedDrawing(input: {
  projectId: string;
  storageKey: string;
  filename: string;
  fileType: FileType;
}): Promise<DrawingAnalysis> {
  requireStorage();
  const project = await requireProject(input.projectId);

  const storageKey = String(input.storageKey ?? "").trim();
  if (!isKeyForProject(storageKey, project.id)) {
    throw new DrawingIntakeError("That file reference is not valid for this project.");
  }

  const filename = String(input.filename ?? "");

  /** A result built from the filename alone. Every early exit goes through it
   *  so no path forgets to classify what little it has. */
  const fallback = (note: string, hasTextLayer: boolean | null = null): DrawingAnalysis => {
    const draft = extractDrawingMetadata({ filename });
    const sheetType = classifySheetType({
      filename,
      title: draft.title?.value ?? null,
      sheetNumber: draft.sheetNumber?.value ?? null,
    });
    return {
      draft,
      usedTitleBlockText: false,
      hasTextLayer,
      paper: null,
      pageCount: null,
      sheetType,
      sheetTypeSource: sheetType ? "rules" : null,
      note,
    };
  };

  // DWG, DXF and RVT are closed binary formats with no JavaScript parser worth
  // depending on — see the feasibility doc §5. The filename is genuinely all
  // there is, and saying so is better than implying the file was read.
  if (input.fileType !== "PDF") {
    return fallback("Filename only — a CAD file's contents cannot be read here.");
  }

  const bytes = await downloadObject(storageKey, PDF_PARSE_MAX_BYTES);
  if (!bytes) {
    return fallback("The file could not be read back for scanning, so only the filename was used.");
  }

  const read = await readTitleBlock(bytes);
  if (!read.ok) {
    return fallback(`The PDF could not be parsed (${read.reason}) — only the filename was used.`);
  }

  const titleBlockText = read.titleBlockText.trim();
  const draft = extractDrawingMetadata({
    filename,
    titleBlockText: titleBlockText || undefined,
    pdfHadTextLayer: read.hasTextLayer,
  });

  // THE SHEET SIZE DOES NOT NEED A TEXT LAYER. It is the media box, so a scan
  // and an outlined plot both give it up — which is why it is measured here,
  // before the text-layer branches below, and not inside them.
  const paper = detectPaperSize(read.pageWidthPt, read.pageHeightPt);
  const undersize = undersizeWarning(paper);
  if (undersize) draft.warnings.push(undersize);
  if (read.pageCount > 1) {
    draft.warnings.push(
      `This PDF has ${read.pageCount} pages. It was read as one sheet — page 1 — so the rest ` +
        `are stored but not indexed as their own sheets.`,
    );
  }

  /** Rules first, a model only where the rules could not read the wording. */
  const classify = async (): Promise<{ f: Field<SheetType> | null; source: "rules" | "ai" | null }> => {
    const byRules = classifySheetType({
      filename,
      title: draft.title?.value ?? null,
      titleBlockText: titleBlockText || null,
      sheetNumber: draft.sheetNumber?.value ?? null,
    });
    if (
      !shouldAskModel({
        ruleConfidence: byRules?.confidence ?? null,
        hasTextLayer: read.hasTextLayer,
        titleBlockText,
      })
    ) {
      return { f: byRules, source: byRules ? "rules" : null };
    }
    const byAi = await classifySheetTypeWithAi({
      title: draft.title?.value ?? null,
      titleBlockText,
      sheetNumber: draft.sheetNumber?.value ?? null,
    });
    // The model is a tie-break, not an override: if it agrees with the rules,
    // the rules' evidence is the better thing to show, and if it is silent the
    // rules' answer stands.
    if (!byAi) return { f: byRules, source: byRules ? "rules" : null };
    if (byRules && byRules.value === byAi.value) return { f: byRules, source: "rules" };
    return { f: byAi, source: "ai" };
  };

  const { f: sheetType, source: sheetTypeSource } = await classify();

  if (!read.hasTextLayer) {
    // Not an error. `extractDrawingMetadata` has already put the OCR warning at
    // the top of `draft.warnings`; this line is the short version next to the file.
    return {
      draft,
      usedTitleBlockText: false,
      hasTextLayer: false,
      paper,
      pageCount: read.pageCount,
      sheetType,
      sheetTypeSource,
      note: `No text layer — this is a scan. ${paper.note} Everything else came from the filename.`,
    };
  }

  if (!titleBlockText) {
    return {
      draft,
      usedTitleBlockText: false,
      hasTextLayer: true,
      paper,
      pageCount: read.pageCount,
      sheetType,
      sheetTypeSource,
      note: `The PDF has text, but nothing was found in the title-block region. ${paper.note}`,
    };
  }

  return {
    draft,
    usedTitleBlockText: true,
    hasTextLayer: true,
    paper,
    pageCount: read.pageCount,
    sheetType,
    sheetTypeSource,
    note: read.usedWholePage
      ? `Read from the whole page — no title block was found in the usual corners. ${paper.note}`
      : `Read from the title block on page 1. ${paper.note}`,
  };
}

/**
 * Delete an object that was staged for an upload the user then abandoned.
 *
 * Guarded twice: the key must belong to one of the caller's projects, and no
 * drawing row may reference it. The second check is the important one — without
 * it this is an endpoint for deleting any registered sheet's file by its key.
 */
export async function discardUpload(projectId: string, storageKey: string): Promise<void> {
  requireStorage();
  const project = await requireProject(projectId);
  const key = String(storageKey ?? "").trim();
  if (!isKeyForProject(key, project.id)) {
    throw new DrawingIntakeError("That file reference is not valid for this project.");
  }
  const registered = await prisma.drawing.findFirst({ where: { storageKey: key }, select: { id: true } });
  if (registered) {
    throw new DrawingIntakeError("That file is already registered as a drawing and was not deleted.");
  }
  await deleteObject(key);
}

export type RegisterDrawingArgs = {
  projectId: string;
  storageKey: string;
  filename: string;
  mimeType: string;
  fileType: FileType;
  metadata: ConfirmedDrawingMetadata;
  audit: DrawingExtractionAudit;
  /** The finer discipline reading, kept alongside the narrowed one. */
  sheetDiscipline?: string | null;
  /** Id of the drawing this one replaces; it is marked SUPERSEDED. */
  supersedes?: string;
  /**
   * What was read off the sheet, as the user confirmed it: the plot size, the
   * page count and the kind of drawing. Absent means "nothing was read", which
   * is stored as nulls rather than as a guess.
   */
  sheet?: {
    sheetType?: SheetType | null;
    /** `rules`, `ai`, or `manual` when the user changed what was proposed. */
    sheetTypeSource?: "rules" | "ai" | "manual" | null;
    paperSize?: string | null;
    paperSeries?: string | null;
    paperOrientation?: string | null;
    paperWidthMm?: number | null;
    paperHeightMm?: number | null;
    pageCount?: number | null;
  } | null;
};

export async function registerDrawing(args: RegisterDrawingArgs): Promise<{ id: string }> {
  requireStorage();
  const project = await requireProject(args.projectId);
  const metadata = cleanMetadata(args.metadata);

  const storageKey = String(args.storageKey ?? "").trim();
  if (!isKeyForProject(storageKey, project.id)) {
    // The key is server-issued. One that does not look server-issued did not
    // come from us, and the only reason to send one is to reach another
    // project's prefix.
    throw new DrawingIntakeError("That file reference is not valid for this project.");
  }

  // Trust storage, not the caller, for what actually landed. This also catches
  // the ordinary failure where the PUT never completed.
  const object = await statObject(storageKey);
  if (!object) {
    throw new DrawingIntakeError("The file did not finish uploading, so nothing was recorded.");
  }

  const session = await getServerSession(authOptions);
  const fileType = FILE_TYPES.includes(args.fileType) ? args.fileType : "PDF";

  try {
    const created = await prisma.$transaction(async (tx) => {
      const drawing = await tx.drawing.create({
        data: {
          projectId: project.id,
          sheetNumber: metadata.sheetNumber,
          title: metadata.title,
          discipline: metadata.discipline,
          sheetDiscipline: args.sheetDiscipline?.trim() || null,
          revision: metadata.revision,
          status: metadata.status,
          issueDate: toIssueDate(metadata.issueDate),
          storageKey,
          filename: String(args.filename ?? "").slice(0, 255),
          mimeType: object.mimeType || args.mimeType || "application/octet-stream",
          sizeBytes: object.sizeBytes,
          fileType,
          sheetType: args.sheet?.sheetType ?? null,
          sheetTypeSource: args.sheet?.sheetTypeSource ?? null,
          paperSize: args.sheet?.paperSize ?? null,
          paperSeries: args.sheet?.paperSeries ?? null,
          paperOrientation: args.sheet?.paperOrientation ?? null,
          paperWidthMm: args.sheet?.paperWidthMm ?? null,
          paperHeightMm: args.sheet?.paperHeightMm ?? null,
          pageCount: args.sheet?.pageCount ?? null,
          extractionAudit: (args.audit ?? null) as unknown as Prisma.InputJsonValue,
          uploadedById: session?.user?.id ?? null,
          uploadedByName: session?.user?.name ?? session?.user?.email ?? null,
        },
        select: { id: true },
      });

      if (args.supersedes) {
        // updateMany, not update: it is company-scoped by the extension, and a
        // no-op is the right outcome if the id was not ours.
        await tx.drawing.updateMany({
          where: { id: args.supersedes, projectId: project.id },
          data: { status: "SUPERSEDED", supersededById: drawing.id },
        });
      }
      return drawing;
    });
    return created;
  } catch (err) {
    // The row is what makes the object reachable. Without one the bytes are
    // unreferenced, so clean them up rather than leaving paid-for orphans.
    await deleteObject(storageKey).catch(() => {});
    if (isUniqueViolation(err)) {
      throw new DrawingIntakeError(
        `${metadata.sheetNumber} revision ${metadata.revision} is already in this project's register. ` +
          "Use a new revision, or supersede the existing one.",
      );
    }
    throw err;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

/** Sheets already registered under this number, newest revision first. */
export async function findSheets(projectId: string, sheetNumber: string): Promise<ExistingSheet[]> {
  const number = String(sheetNumber ?? "").trim().toUpperCase();
  if (!number) return [];
  const rows = await prisma.drawing.findMany({
    where: { projectId: String(projectId ?? ""), sheetNumber: number },
    select: { id: true, sheetNumber: true, revision: true, status: true },
    orderBy: [{ revision: "desc" }, { uploadedAt: "desc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    sheetNumber: r.sheetNumber,
    revision: r.revision,
    status: r.status as DrawingStatus,
  }));
}

/**
 * A short-lived signed URL for one drawing's file, or null when the drawing is
 * not ours. Minted per request and never stored — see lib/server/storage.ts.
 */
export async function getDrawingFileUrl(id: string): Promise<string | null> {
  if (!isStorageConfigured()) return null;
  // findFirst so the tenant extension can put `companyId` in the WHERE clause —
  // see requireProject above for why findUnique + a narrow select cannot scope.
  // This is the whole ownership check for handing out a capability to read a
  // client-confidential file, so it has to actually run.
  const row = await prisma.drawing.findFirst({
    where: { id: String(id ?? "") },
    select: { storageKey: true },
  });
  if (!row?.storageKey) return null;
  return createSignedDownload(row.storageKey);
}
