"use server";

/**
 * Server actions for drawing intake.
 *
 * Each one returns a discriminated result rather than throwing, so the intake
 * component can show the real reason a file was refused ("A-101 revision B is
 * already in this project's register") instead of a generic failure. Anything
 * unexpected still surfaces its message — these are operator-facing errors, and
 * a vague one costs more than it hides.
 */

import { revalidatePath } from "next/cache";
import {
  createUploadTicket,
  findSheets,
  getDrawingFileUrl,
  registerDrawing,
  type RegisterDrawingArgs,
} from "@/lib/data/drawing-intake";
import type { ExistingSheet, UploadTicket } from "@/lib/drawings/persistence";

export type TicketResult = { ok: true; ticket: UploadTicket } | { ok: false; error: string };
export type RegisterResult = { ok: true; id: string } | { ok: false; error: string };
export type SheetsResult = { ok: true; sheets: ExistingSheet[] } | { ok: false; error: string };
export type FileUrlResult = { ok: true; url: string } | { ok: false; error: string };

function message(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export async function createUploadTicketAction(input: {
  projectId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<TicketResult> {
  try {
    return { ok: true, ticket: await createUploadTicket(input) };
  } catch (e) {
    return { ok: false, error: message(e, "Could not start the upload.") };
  }
}

export async function registerDrawingAction(args: RegisterDrawingArgs): Promise<RegisterResult> {
  try {
    const { id } = await registerDrawing(args);
    revalidatePath("/drawings");
    revalidatePath(`/projects/${args.projectId}`);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: message(e, "Could not record the drawing.") };
  }
}

export async function findSheetsAction(
  projectId: string,
  sheetNumber: string,
): Promise<SheetsResult> {
  try {
    return { ok: true, sheets: await findSheets(projectId, sheetNumber) };
  } catch (e) {
    return { ok: false, error: message(e, "Could not check for existing sheets.") };
  }
}

/** Mint a download URL on demand. Short-lived, never stored on the row. */
export async function drawingFileUrlAction(id: string): Promise<FileUrlResult> {
  try {
    const url = await getDrawingFileUrl(id);
    return url ? { ok: true, url } : { ok: false, error: "That file is not available." };
  } catch (e) {
    return { ok: false, error: message(e, "Could not open the file.") };
  }
}
