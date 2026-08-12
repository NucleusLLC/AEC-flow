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
  // Tenant-scoped by the Prisma extension: another company's project reads back
  // as null here, so this doubles as the ownership check.
  const project = await prisma.project.findUnique({ where: { id }, select: { id: true } });
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
  const row = await prisma.drawing.findUnique({
    where: { id: String(id ?? "") },
    select: { storageKey: true },
  });
  if (!row?.storageKey) return null;
  return createSignedDownload(row.storageKey);
}
