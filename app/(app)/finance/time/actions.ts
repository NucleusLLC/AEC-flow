"use server";

/**
 * Timesheet server actions.
 *
 * Each one re-parses its payload through the zod gate before the data layer
 * sees it, and returns a discriminated result rather than throwing — the same
 * contract the invoice actions keep, and for the same reason: a thrown action
 * reaches the user as a digest string, and "did that save?" is the worst
 * question a screen about billable time can leave open.
 *
 * The ROLE checks are in the data layer, not here. An action is a public
 * endpoint and so is every other caller, so the gate lives where the write is.
 */

import { revalidatePath } from "next/cache";
import {
  decideTimeEntries,
  deleteTimeEntry,
  logTime,
  reopenTimeEntries,
  setPersonRates,
  submitTimeEntries,
  updateTimeEntry,
  TimeEntryForbiddenError,
  TimeEntryLockedError,
  TimeEntryNotFoundError,
} from "@/lib/data/time-entries";
import { issuesToMessage, parseApprovalDecision, parseTimeEntryInput } from "@/lib/finance/schema";
import type { TimeEntryInput } from "@/lib/finance/types";

export type TimeActionResult = { ok: true; id?: string; count?: number } | { ok: false; error: string };

const TIME = "/finance/time";

function revalidateTime(): void {
  revalidatePath(TIME);
  // The project view and the receivables tiles both read unbilled work.
  revalidatePath("/finance/invoices");
}

function failure(e: unknown, fallback: string): { ok: false; error: string } {
  if (
    e instanceof TimeEntryForbiddenError ||
    e instanceof TimeEntryLockedError ||
    e instanceof TimeEntryNotFoundError
  ) {
    return { ok: false, error: e.message };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

export async function logTimeAction(input: TimeEntryInput): Promise<TimeActionResult> {
  const parsed = parseTimeEntryInput(input);
  if (!parsed.ok) return { ok: false, error: issuesToMessage(parsed.issues) };
  try {
    const entry = await logTime(parsed.value as TimeEntryInput);
    revalidateTime();
    return { ok: true, id: entry.id };
  } catch (e) {
    return failure(e, "Failed to log those hours.");
  }
}

export async function updateTimeEntryAction(
  id: string,
  input: TimeEntryInput,
): Promise<TimeActionResult> {
  const parsed = parseTimeEntryInput(input);
  if (!parsed.ok) return { ok: false, error: issuesToMessage(parsed.issues) };
  try {
    const entry = await updateTimeEntry(id, parsed.value as TimeEntryInput);
    revalidateTime();
    return { ok: true, id: entry.id };
  } catch (e) {
    return failure(e, "Failed to save that entry.");
  }
}

export async function deleteTimeEntryAction(id: string): Promise<TimeActionResult> {
  try {
    await deleteTimeEntry(id);
    revalidateTime();
    return { ok: true, id };
  } catch (e) {
    return failure(e, "Failed to delete that entry.");
  }
}

export async function submitTimeAction(ids: string[]): Promise<TimeActionResult> {
  try {
    const count = await submitTimeEntries(ids);
    revalidateTime();
    return { ok: true, count };
  } catch (e) {
    return failure(e, "Failed to send those hours for approval.");
  }
}

export async function decideTimeAction(
  ids: string[],
  decision: { approve: boolean; reason?: string | null },
): Promise<TimeActionResult> {
  const parsed = parseApprovalDecision(decision);
  if (!parsed.ok) return { ok: false, error: issuesToMessage(parsed.issues) };
  try {
    const count = await decideTimeEntries(ids, parsed.value);
    revalidateTime();
    return { ok: true, count };
  } catch (e) {
    return failure(e, "Failed to record that decision.");
  }
}

export async function reopenTimeAction(ids: string[]): Promise<TimeActionResult> {
  try {
    const count = await reopenTimeEntries(ids);
    revalidateTime();
    return { ok: true, count };
  } catch (e) {
    return failure(e, "Failed to reopen those hours.");
  }
}

/**
 * Set a person's standard hourly rates. Member administrators only — the check
 * is in the data layer, where every caller passes.
 */
export async function setPersonRatesAction(
  userId: string,
  rates: { chargeOutRate: number | null; costRate: number | null },
): Promise<TimeActionResult> {
  try {
    await setPersonRates(userId, rates);
    revalidateTime();
    revalidatePath("/team");
    return { ok: true, id: userId };
  } catch (e) {
    return failure(e, "Failed to save those rates.");
  }
}
