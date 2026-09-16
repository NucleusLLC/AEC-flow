"use server";

/**
 * Building Permit server actions.
 *
 * Every action is a public endpoint — the browser form in front of it is a
 * convenience, not a control — so each one re-parses its payload through the
 * zod gate in lib/building-permits/schema.ts before the data layer sees it, and
 * each one returns a discriminated result instead of throwing. A thrown server
 * action reaches the user as a digest string with no message in it, which is a
 * validation error the user cannot act on.
 */

import { revalidatePath } from "next/cache";
import {
  addApproval,
  addCorrespondence,
  addDocument,
  addMeeting,
  addSubmission,
  attachLetterPdf,
  createBuildingPermit,
  createLetterUploadTicket,
  deleteApproval,
  deleteBuildingPermit,
  deleteCorrespondence,
  deleteDocument,
  deleteMeeting,
  deleteSubmission,
  discardLetterUpload,
  updateApproval,
  updateBuildingPermit,
  updateCorrespondence,
  updateMeeting,
  PermitLetterFileError,
  PermitNotFoundError,
  PermitReferenceInUseError,
  type LetterUploadTicket,
  type UploadedLetterPdf,
} from "@/lib/data/building-permits";
import {
  issuesToMessage,
  parseApprovalInput,
  parseBuildingPermitInput,
  parseCorrespondenceInput,
  parseDocumentInput,
  parseMeetingInput,
  parseSubmissionInput,
} from "@/lib/building-permits/schema";
import type {
  BuildingPermitApprovalInput,
  BuildingPermitCorrespondenceInput,
  BuildingPermitDocumentInput,
  BuildingPermitInput,
  BuildingPermitMeetingInput,
  BuildingPermitSubmissionInput,
} from "@/lib/building-permits/types";

export type PermitActionResult = { ok: true; id: string } | { ok: false; error: string };

const REGISTER = "/design/building-permits";

/** The register and the case file both go stale on every write, without exception. */
function revalidatePermit(id: string): void {
  revalidatePath(REGISTER);
  revalidatePath(`${REGISTER}/${id}`);
}

/**
 * Turn anything the data layer throws into a sentence.
 *
 * The two named errors carry copy written for the user; anything else is a bug,
 * and its message is shown rather than swallowed so a report says something more
 * useful than "it did not save".
 */
function failure(e: unknown, fallback: string): { ok: false; error: string } {
  if (
    e instanceof PermitReferenceInUseError ||
    e instanceof PermitNotFoundError ||
    e instanceof PermitLetterFileError
  ) {
    return { ok: false, error: e.message };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

// ── The case file ──────────────────────────────────────────────────────────

export async function createPermitAction(input: BuildingPermitInput): Promise<PermitActionResult> {
  const parsed = parseBuildingPermitInput(input);
  if (!parsed.ok) return { ok: false, error: issuesToMessage(parsed.issues) };
  try {
    const permit = await createBuildingPermit(parsed.value);
    revalidatePermit(permit.id);
    return { ok: true, id: permit.id };
  } catch (e) {
    return failure(e, "Failed to create the permit.");
  }
}

export async function updatePermitAction(
  id: string,
  input: BuildingPermitInput,
): Promise<PermitActionResult> {
  const parsed = parseBuildingPermitInput(input);
  if (!parsed.ok) return { ok: false, error: issuesToMessage(parsed.issues) };
  try {
    const permit = await updateBuildingPermit(id, parsed.value);
    revalidatePermit(permit.id);
    return { ok: true, id: permit.id };
  } catch (e) {
    return failure(e, "Failed to save the permit.");
  }
}

export async function deletePermitAction(id: string): Promise<PermitActionResult> {
  try {
    await deleteBuildingPermit(id);
    revalidatePermit(id);
    return { ok: true, id };
  } catch (e) {
    return failure(e, "Failed to delete the permit.");
  }
}

// ── Submissions ────────────────────────────────────────────────────────────

export async function addSubmissionAction(
  permitId: string,
  input: BuildingPermitSubmissionInput,
): Promise<PermitActionResult> {
  const parsed = parseSubmissionInput(input);
  if (!parsed.ok) return { ok: false, error: issuesToMessage(parsed.issues) };
  try {
    const row = await addSubmission(permitId, parsed.value);
    revalidatePermit(permitId);
    return { ok: true, id: row.id };
  } catch (e) {
    return failure(e, "Failed to record the submission.");
  }
}

export async function deleteSubmissionAction(
  permitId: string,
  id: string,
): Promise<PermitActionResult> {
  try {
    await deleteSubmission(id);
    revalidatePermit(permitId);
    return { ok: true, id };
  } catch (e) {
    return failure(e, "Failed to delete the submission.");
  }
}

// ── Meetings ───────────────────────────────────────────────────────────────

export async function addMeetingAction(
  permitId: string,
  input: BuildingPermitMeetingInput,
): Promise<PermitActionResult> {
  const parsed = parseMeetingInput(input);
  if (!parsed.ok) return { ok: false, error: issuesToMessage(parsed.issues) };
  try {
    const row = await addMeeting(permitId, parsed.value);
    revalidatePermit(permitId);
    return { ok: true, id: row.id };
  } catch (e) {
    return failure(e, "Failed to record the meeting.");
  }
}

export async function updateMeetingAction(
  permitId: string,
  id: string,
  input: BuildingPermitMeetingInput,
): Promise<PermitActionResult> {
  const parsed = parseMeetingInput(input);
  if (!parsed.ok) return { ok: false, error: issuesToMessage(parsed.issues) };
  try {
    const row = await updateMeeting(id, parsed.value);
    revalidatePermit(permitId);
    return { ok: true, id: row.id };
  } catch (e) {
    return failure(e, "Failed to save the meeting.");
  }
}

export async function deleteMeetingAction(
  permitId: string,
  id: string,
): Promise<PermitActionResult> {
  try {
    await deleteMeeting(id);
    revalidatePermit(permitId);
    return { ok: true, id };
  } catch (e) {
    return failure(e, "Failed to delete the meeting.");
  }
}

// ── Correspondence ─────────────────────────────────────────────────────────

export type LetterUploadTicketResult =
  | { ok: true; ticket: LetterUploadTicket }
  | { ok: false; error: string };

/** Step one of attaching a letter PDF: a signed URL the browser uploads to. */
export async function createLetterUploadTicketAction(
  permitId: string,
  file: { filename: string; mimeType: string; sizeBytes: number },
): Promise<LetterUploadTicketResult> {
  try {
    return { ok: true, ticket: await createLetterUploadTicket(permitId, file) };
  } catch (e) {
    return failure(e, "Could not prepare the upload.");
  }
}

export async function addCorrespondenceAction(
  permitId: string,
  input: BuildingPermitCorrespondenceInput,
  pdf?: UploadedLetterPdf | null,
): Promise<PermitActionResult> {
  const parsed = parseCorrespondenceInput(input);
  if (!parsed.ok) {
    // The PDF is already in the bucket; a letter that will not save must not
    // leave it there with nothing pointing at it.
    if (pdf?.storageKey) await discardLetterUpload(permitId, pdf.storageKey).catch(() => {});
    return { ok: false, error: issuesToMessage(parsed.issues) };
  }
  try {
    const row = await addCorrespondence(permitId, parsed.value, pdf ?? null);
    revalidatePermit(permitId);
    return { ok: true, id: row.id };
  } catch (e) {
    return failure(e, "Failed to record the letter.");
  }
}

/** Attach a PDF to a letter already on the file. */
export async function attachLetterPdfAction(
  correspondenceId: string,
  pdf: UploadedLetterPdf,
): Promise<PermitActionResult> {
  try {
    const permitId = await attachLetterPdf(correspondenceId, pdf);
    revalidatePermit(permitId);
    return { ok: true, id: correspondenceId };
  } catch (e) {
    return failure(e, "Failed to attach the PDF.");
  }
}

export async function updateCorrespondenceAction(
  permitId: string,
  id: string,
  input: BuildingPermitCorrespondenceInput,
): Promise<PermitActionResult> {
  const parsed = parseCorrespondenceInput(input);
  if (!parsed.ok) return { ok: false, error: issuesToMessage(parsed.issues) };
  try {
    const row = await updateCorrespondence(id, parsed.value);
    revalidatePermit(permitId);
    return { ok: true, id: row.id };
  } catch (e) {
    return failure(e, "Failed to save the letter.");
  }
}

export async function deleteCorrespondenceAction(
  permitId: string,
  id: string,
): Promise<PermitActionResult> {
  try {
    await deleteCorrespondence(id);
    revalidatePermit(permitId);
    return { ok: true, id };
  } catch (e) {
    return failure(e, "Failed to delete the letter.");
  }
}

// ── Approvals ──────────────────────────────────────────────────────────────

export async function addApprovalAction(
  permitId: string,
  input: BuildingPermitApprovalInput,
): Promise<PermitActionResult> {
  const parsed = parseApprovalInput(input);
  if (!parsed.ok) return { ok: false, error: issuesToMessage(parsed.issues) };
  try {
    const row = await addApproval(permitId, parsed.value);
    revalidatePermit(permitId);
    return { ok: true, id: row.id };
  } catch (e) {
    return failure(e, "Failed to record the approval.");
  }
}

export async function updateApprovalAction(
  permitId: string,
  id: string,
  input: BuildingPermitApprovalInput,
): Promise<PermitActionResult> {
  const parsed = parseApprovalInput(input);
  if (!parsed.ok) return { ok: false, error: issuesToMessage(parsed.issues) };
  try {
    const row = await updateApproval(id, parsed.value);
    revalidatePermit(permitId);
    return { ok: true, id: row.id };
  } catch (e) {
    return failure(e, "Failed to save the approval.");
  }
}

export async function deleteApprovalAction(
  permitId: string,
  id: string,
): Promise<PermitActionResult> {
  try {
    await deleteApproval(id);
    revalidatePermit(permitId);
    return { ok: true, id };
  } catch (e) {
    return failure(e, "Failed to delete the approval.");
  }
}

// ── Documents ──────────────────────────────────────────────────────────────
//
// Release A records a link, never a file: `storageKey` is reserved for the
// upload path (lib/server/storage.ts) and stays null here, which is why the
// zod gate's "attach a file or give a link" refusal is what enforces that a
// document row points at something.

export async function addDocumentAction(
  permitId: string,
  input: BuildingPermitDocumentInput,
): Promise<PermitActionResult> {
  const parsed = parseDocumentInput(input);
  if (!parsed.ok) return { ok: false, error: issuesToMessage(parsed.issues) };
  try {
    const row = await addDocument(permitId, parsed.value);
    revalidatePermit(permitId);
    return { ok: true, id: row.id };
  } catch (e) {
    return failure(e, "Failed to record the document.");
  }
}

export async function deleteDocumentAction(
  permitId: string,
  id: string,
): Promise<PermitActionResult> {
  try {
    await deleteDocument(id);
    revalidatePermit(permitId);
    return { ok: true, id };
  } catch (e) {
    return failure(e, "Failed to delete the document.");
  }
}
