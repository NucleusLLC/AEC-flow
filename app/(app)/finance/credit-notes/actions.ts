"use server";

/**
 * Credit note server actions.
 *
 * Same shape as the invoice actions: re-parse through the zod gate, return a
 * discriminated result rather than throwing. Every one calls `requireActor()`
 * first, and an action is a public endpoint whatever the screen in front of it
 * shows. Any active member may raise, edit or delete a DRAFT (it moves no
 * money). ISSUING and VOIDING one — money going out, or coming back onto the
 * client's balance — is for an administrator, a director or the founder:
 * `canManagePasswords`, the same set that approves expenses and exports the
 * accounts.
 *
 * The over-credit ceiling is NOT checked here: it is checked by the data layer
 * (lib/data/credit-notes.ts) against the invoice as it is at that moment, on
 * save and again at issue under a row lock. Calling these directly with a
 * bigger figure than the form allows is refused there.
 */

import { revalidatePath } from "next/cache";
import { getServerT } from "@/lib/i18n/server";
import { requireActor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";
import {
  createCreditNote,
  deleteCreditNote,
  issueCreditNote,
  updateCreditNote,
  voidCreditNote,
  CreditNoteError,
} from "@/lib/data/credit-notes";
import { issuesToMessage, parseCreditNoteInput } from "@/lib/finance/schema";
import type { CreditNoteInput } from "@/lib/finance/types";

export type CreditNoteActionResult = { ok: true; id: string } | { ok: false; error: string };

const REGISTER = "/finance/credit-notes";

function revalidateAll(id: string, invoiceId?: string): void {
  revalidatePath(REGISTER);
  revalidatePath(`${REGISTER}/${id}`);
  // The invoice's balance, status and the receivables tiles all move with it.
  revalidatePath("/finance/invoices");
  // ...and so do the receivables and every Statement of Account.
  revalidatePath("/finance/receivables", "layout");
  if (invoiceId) revalidatePath(`/finance/invoices/${invoiceId}`);
}

async function issuesError(issues: { path: string; message: string }[]): Promise<string> {
  const t = await getServerT();
  return issuesToMessage(issues.map((i) => ({ ...i, message: t(i.message) })));
}

function failure(e: unknown, fallback: string): { ok: false; error: string } {
  if (e instanceof CreditNoteError) return { ok: false, error: e.message };
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

/** Sign-in first: a refused actor gets the reason, not a digest. */
async function gate(): Promise<{ ok: false; error: string } | null> {
  try {
    await requireActor();
    return null;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "You must be signed in." };
  }
}

const CREDIT_NOTE_NOT_ALLOWED = "Only an administrator or director can issue or void a credit note.";

/** Issue and void: signed in AND Admin / Director / founder. */
async function managerGate(): Promise<{ ok: false; error: string } | null> {
  try {
    const actor = await requireActor();
    if (!canManagePasswords(actor.role, actor.isFounder)) return { ok: false, error: CREDIT_NOTE_NOT_ALLOWED };
    return null;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "You must be signed in." };
  }
}

export async function createCreditNoteAction(input: CreditNoteInput): Promise<CreditNoteActionResult> {
  const denied = await gate();
  if (denied) return denied;
  const parsed = parseCreditNoteInput(input);
  if (!parsed.ok) return { ok: false, error: await issuesError(parsed.issues) };
  try {
    const note = await createCreditNote(parsed.value as CreditNoteInput);
    revalidateAll(note.id, note.invoiceId);
    return { ok: true, id: note.id };
  } catch (e) {
    return failure(e, "Failed to raise the credit note.");
  }
}

export async function updateCreditNoteAction(
  id: string,
  input: CreditNoteInput,
): Promise<CreditNoteActionResult> {
  const denied = await gate();
  if (denied) return denied;
  const parsed = parseCreditNoteInput(input);
  if (!parsed.ok) return { ok: false, error: await issuesError(parsed.issues) };
  try {
    const note = await updateCreditNote(id, parsed.value as CreditNoteInput);
    revalidateAll(note.id, note.invoiceId);
    return { ok: true, id: note.id };
  } catch (e) {
    return failure(e, "Failed to save the credit note.");
  }
}

export async function issueCreditNoteAction(id: string): Promise<CreditNoteActionResult> {
  const denied = await managerGate();
  if (denied) return denied;
  try {
    const note = await issueCreditNote(id);
    revalidateAll(note.id, note.invoiceId);
    return { ok: true, id: note.id };
  } catch (e) {
    return failure(e, "Failed to issue the credit note.");
  }
}

export async function voidCreditNoteAction(id: string, reason: string): Promise<CreditNoteActionResult> {
  const denied = await managerGate();
  if (denied) return denied;
  try {
    const note = await voidCreditNote(id, String(reason ?? ""));
    revalidateAll(note.id, note.invoiceId);
    return { ok: true, id: note.id };
  } catch (e) {
    return failure(e, "Failed to void the credit note.");
  }
}

export async function deleteCreditNoteAction(id: string): Promise<CreditNoteActionResult> {
  const denied = await gate();
  if (denied) return denied;
  try {
    const { invoiceId } = await deleteCreditNote(id);
    revalidateAll(id, invoiceId);
    return { ok: true, id: invoiceId };
  } catch (e) {
    return failure(e, "Failed to delete the credit note.");
  }
}
