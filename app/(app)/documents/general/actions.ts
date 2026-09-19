"use server";

/**
 * General Document server actions.
 *
 * Each one re-parses its payload through the zod gate before the data layer
 * sees it — an action is a public endpoint, and the composer in front of it is a
 * convenience, not a control — and returns a discriminated result rather than
 * throwing, because a thrown server action reaches the user as a digest string
 * with no message in it.
 *
 * ISSUING IS THE GATE, NOT SAVING. A draft may be half-written; a document that
 * goes out may not. `issueDocumentAction` refuses when the catalogue's required
 * fields are empty and names them, so the refusal is something the user can act
 * on rather than a silent failure.
 */

import { revalidatePath } from "next/cache";
import {
  createGeneralDocument,
  deleteGeneralDocument,
  getGeneralDocument,
  issueGeneralDocument,
  markGeneralDocumentSigned,
  supersedeGeneralDocument,
  updateGeneralDocument,
  voidGeneralDocument,
  DocumentLockedError,
  DocumentNotFoundError,
  DocumentNumberInUseError,
} from "@/lib/data/general-documents";
import {
  issueBlockers,
  issuesToMessage,
  parseGeneralDocumentInput,
} from "@/lib/general-documents/schema";
import type { GeneralDocumentInput } from "@/lib/general-documents/types";

export type DocumentActionResult = { ok: true; id: string } | { ok: false; error: string };

const REGISTER = "/documents/general";

function revalidateDocument(id: string): void {
  revalidatePath(REGISTER);
  revalidatePath(`${REGISTER}/${id}`);
}

function failure(e: unknown, fallback: string): { ok: false; error: string } {
  if (
    e instanceof DocumentNumberInUseError ||
    e instanceof DocumentNotFoundError ||
    e instanceof DocumentLockedError
  ) {
    return { ok: false, error: e.message };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

export async function createDocumentAction(
  input: GeneralDocumentInput,
): Promise<DocumentActionResult> {
  const parsed = parseGeneralDocumentInput(input);
  if (!parsed.ok) return { ok: false, error: issuesToMessage(parsed.issues) };
  try {
    const doc = await createGeneralDocument(parsed.value);
    revalidateDocument(doc.id);
    return { ok: true, id: doc.id };
  } catch (e) {
    return failure(e, "Failed to create the document.");
  }
}

export async function updateDocumentAction(
  id: string,
  input: GeneralDocumentInput,
): Promise<DocumentActionResult> {
  const parsed = parseGeneralDocumentInput(input);
  if (!parsed.ok) return { ok: false, error: issuesToMessage(parsed.issues) };
  try {
    const doc = await updateGeneralDocument(id, parsed.value);
    revalidateDocument(doc.id);
    return { ok: true, id: doc.id };
  } catch (e) {
    return failure(e, "Failed to save the document.");
  }
}

export async function issueDocumentAction(
  id: string,
  issueDate?: string | null,
): Promise<DocumentActionResult> {
  try {
    const existing = await getGeneralDocument(id);
    if (!existing) return { ok: false, error: "That document could not be found." };
    const blockers = issueBlockers(existing.docType, existing.values);
    if (blockers.length > 0) {
      return {
        ok: false,
        error: `Fill these in before issuing: ${blockers.join(", ")}.`,
      };
    }
    const doc = await issueGeneralDocument(id, issueDate ?? null);
    revalidateDocument(doc.id);
    return { ok: true, id: doc.id };
  } catch (e) {
    return failure(e, "Failed to issue the document.");
  }
}

export async function markSignedAction(
  id: string,
  signedAt: string,
): Promise<DocumentActionResult> {
  try {
    const doc = await markGeneralDocumentSigned(id, signedAt);
    revalidateDocument(doc.id);
    return { ok: true, id: doc.id };
  } catch (e) {
    return failure(e, "Failed to record the signature.");
  }
}

export async function voidDocumentAction(
  id: string,
  reason: string,
): Promise<DocumentActionResult> {
  try {
    const doc = await voidGeneralDocument(id, reason);
    revalidateDocument(doc.id);
    return { ok: true, id: doc.id };
  } catch (e) {
    return failure(e, "Failed to void the document.");
  }
}

/** The way an issued document is "edited": a new draft, the old one superseded. */
export async function supersedeDocumentAction(id: string): Promise<DocumentActionResult> {
  try {
    const doc = await supersedeGeneralDocument(id);
    revalidateDocument(doc.id);
    revalidateDocument(id);
    return { ok: true, id: doc.id };
  } catch (e) {
    return failure(e, "Failed to supersede the document.");
  }
}

export async function deleteDocumentAction(id: string): Promise<DocumentActionResult> {
  try {
    await deleteGeneralDocument(id);
    revalidateDocument(id);
    return { ok: true, id };
  } catch (e) {
    return failure(e, "Failed to delete the document.");
  }
}
