/**
 * The persistence seam for drawing intake — TYPES AND CONTRACT ONLY.
 *
 * Nothing here is implemented, on purpose. This run does not own
 * `prisma/schema.prisma` and must not migrate, so the shape is defined now and
 * satisfied later. The intake component depends on this interface and nothing
 * else, so wiring it up is one class, not a refactor.
 *
 * THE FLOW THIS INTERFACE ASSUMES
 *
 *   1. `createUploadTicket` — the server mints a short-lived signed upload URL
 *      for a Supabase Storage object and returns the key it chose. The browser
 *      PUTs the bytes straight to storage; they never pass through the Next.js
 *      server, which is what keeps a 60 MB drawing off a serverless function's
 *      request body limit.
 *   2. The browser uploads, then calls `registerDrawing` with the storage key
 *      and the metadata THE USER CONFIRMED — not the metadata the extractor
 *      proposed. See §4 of the feasibility doc.
 *   3. `registerDrawing` writes the row, and supersedes the previous revision
 *      of the same sheet if `supersedes` is set.
 *
 * WHY THE AUDIT PAYLOAD EXISTS. `DrawingExtractionAudit` records what was
 * proposed alongside what was saved. That is the only way to measure real
 * accuracy on this firm's real files instead of on a fixture set — the edit
 * rate per field IS the error rate. It costs one JSON column and it is the
 * difference between a guessed number in a document and a measured one.
 */

import type { Discipline, DrawingStatus, FileType } from "@/lib/data/drawings";
import type { DraftFieldKey, DrawingMetadataDraft } from "./types";

/** Metadata as confirmed by a human, ready to store. No confidences: by this
 *  point every value is asserted, not proposed. */
export type ConfirmedDrawingMetadata = {
  /** Required. A drawing with no sheet number does not belong in a register. */
  sheetNumber: string;
  title: string;
  discipline: Discipline;
  revision: string;
  /** ISO `YYYY-MM-DD`. */
  issueDate: string;
  status: DrawingStatus;
};

/** An object that already exists in storage. */
export type StoredFileRef = {
  /** Storage object key, e.g. `projects/<projectId>/drawings/<uuid>.pdf`. */
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  fileType: FileType;
};

export type UploadTicket = {
  /** Signed PUT URL. Short-lived. */
  uploadUrl: string;
  /** Key the caller must pass back to `registerDrawing`. */
  storageKey: string;
  /** ISO timestamp after which `uploadUrl` is dead. */
  expiresAt: string;
  /** Headers the PUT must carry, e.g. `content-type`. */
  headers?: Record<string, string>;
};

/** What the extractor proposed vs. what the user kept. The error signal. */
export type DrawingExtractionAudit = {
  /** Bump when extraction rules change, so historical audits stay comparable. */
  engineVersion: string;
  /** Which inputs were available: was there a text layer, or only a filename? */
  inputs: { filename: true; titleBlockText: boolean };
  proposed: DrawingMetadataDraft;
  /** Fields the user changed before saving. */
  editedFields: DraftFieldKey[];
};

export type RegisterDrawingInput = {
  projectId: string;
  file: StoredFileRef;
  metadata: ConfirmedDrawingMetadata;
  audit: DrawingExtractionAudit;
  /** Id of the drawing this one replaces; it is marked SUPERSEDED. */
  supersedes?: string;
};

export type ExistingSheet = {
  id: string;
  sheetNumber: string;
  revision: string;
  status: DrawingStatus;
};

/**
 * Implement this against Prisma + Supabase Storage once the schema is free.
 * Every method is async and every method may reject; callers must handle it.
 */
export interface DrawingIntakeRepository {
  /** Mint a signed upload URL. Must enforce the size cap server-side too —
   *  a client-side limit is a courtesy, not a control. */
  createUploadTicket(input: {
    projectId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }): Promise<UploadTicket>;

  /** Create the drawing row. Returns the new id. */
  registerDrawing(input: RegisterDrawingInput): Promise<{ id: string }>;

  /** Sheets already registered under this number, newest revision first. Used
   *  to offer "supersede revision B?" instead of creating a silent duplicate. */
  findSheets(projectId: string, sheetNumber: string): Promise<ExistingSheet[]>;
}

/** Version stamped into `DrawingExtractionAudit.engineVersion`. */
export const EXTRACTION_ENGINE_VERSION = "1.0.0";

export class DrawingPersistenceNotConfiguredError extends Error {
  constructor() {
    super(
      "Drawing intake persistence is not implemented yet. The schema work is owned " +
        "elsewhere; implement DrawingIntakeRepository once prisma/schema.prisma is free.",
    );
    this.name = "DrawingPersistenceNotConfiguredError";
  }
}

/**
 * The default the UI holds. Every call rejects with an explicit error, so the
 * component can render a truthful disabled state instead of pretending a save
 * happened.
 */
export const notConfiguredRepository: DrawingIntakeRepository = {
  async createUploadTicket() {
    throw new DrawingPersistenceNotConfiguredError();
  },
  async registerDrawing() {
    throw new DrawingPersistenceNotConfiguredError();
  },
  async findSheets() {
    throw new DrawingPersistenceNotConfiguredError();
  },
};
