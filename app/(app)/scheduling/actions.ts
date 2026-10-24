"use server";

/**
 * Scheduling server actions.
 *
 * Every one checks who is acting (`requireActor`), re-parses its payload through
 * the zod gate before the data layer sees it — an action is a public endpoint,
 * and the form in front of it is a convenience, not a control — and returns a
 * discriminated result rather than throwing, because a thrown server action
 * reaches the user as a digest string with no message in it.
 *
 * Only async functions are exported from this file ("use server").
 */

import { revalidatePath } from "next/cache";
import {
  cancelAppointment,
  completeAppointment,
  createAppointment,
  deleteAppointment,
  getAppointment,
  logAppointmentTime,
  postponeAppointment,
  SCHEDULING_ERRORS,
  updateAppointment,
} from "@/lib/data/appointments";
import {
  firstIssue,
  parseAppointmentInput,
  parseCancelInput,
  parseCompleteInput,
  parsePostponeInput,
} from "@/lib/scheduling/schema";
import type { AppointmentDTO, TimesheetOutcome } from "@/lib/scheduling/types";
import { ActorError, requireActor } from "@/lib/server/actor";
import { TimeEntryForbiddenError, TimeEntryLockedError, TimeEntryNotFoundError } from "@/lib/data/time-entries";

export type SchedulingActionResult = { ok: true; id: string } | { ok: false; error: string };

export type CompleteActionResult =
  | { ok: true; id: string; timesheet: TimesheetOutcome | null; note: string | null }
  | { ok: false; error: string };

const REGISTER = "/scheduling";

/** Every page that shows this appointment, before and after the change. */
function revalidateAppointment(a: Pick<AppointmentDTO, "id" | "projectId" | "serviceProposalId">, before?: AppointmentDTO | null) {
  revalidatePath(REGISTER);
  revalidatePath(`${REGISTER}/${a.id}`);
  const projects = new Set([a.projectId, before?.projectId].filter(Boolean) as string[]);
  const proposals = new Set([a.serviceProposalId, before?.serviceProposalId].filter(Boolean) as string[]);
  for (const p of projects) revalidatePath(`/projects/${p}/scheduling`);
  for (const p of proposals) revalidatePath(`/design/service-proposals/${p}`);
  // A visit on a converted proposal shows on that project's tab, whose id the
  // appointment row does not carry: refresh every project tab.
  if (proposals.size > 0) revalidatePath("/projects/[id]/scheduling", "page");
}

function failure(e: unknown, fallback: string): { ok: false; error: string } {
  if (
    e instanceof ActorError ||
    e instanceof TimeEntryForbiddenError ||
    e instanceof TimeEntryLockedError ||
    e instanceof TimeEntryNotFoundError ||
    SCHEDULING_ERRORS.some((E) => e instanceof E)
  ) {
    return { ok: false, error: (e as Error).message };
  }
  console.error("[scheduling]", e);
  return { ok: false, error: fallback };
}

async function signedIn(): Promise<{ ok: false; error: string } | null> {
  try {
    await requireActor();
    return null;
  } catch (e) {
    return { ok: false, error: e instanceof ActorError ? e.message : "You must be signed in." };
  }
}

function validId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && id.length <= 120;
}

export async function createAppointmentAction(input: unknown): Promise<SchedulingActionResult> {
  const denied = await signedIn();
  if (denied) return denied;
  const parsed = parseAppointmentInput(input);
  if (!parsed.ok) return { ok: false, error: firstIssue(parsed.issues) };
  try {
    const a = await createAppointment(parsed.value);
    revalidateAppointment(a);
    return { ok: true, id: a.id };
  } catch (e) {
    return failure(e, "The appointment could not be booked.");
  }
}

export async function updateAppointmentAction(id: string, input: unknown): Promise<SchedulingActionResult> {
  const denied = await signedIn();
  if (denied) return denied;
  if (!validId(id)) return { ok: false, error: "That appointment could not be found." };
  const parsed = parseAppointmentInput(input);
  if (!parsed.ok) return { ok: false, error: firstIssue(parsed.issues) };
  try {
    const before = await getAppointment(id);
    const a = await updateAppointment(id, parsed.value);
    revalidateAppointment(a, before);
    return { ok: true, id: a.id };
  } catch (e) {
    return failure(e, "The appointment could not be saved.");
  }
}

export async function completeAppointmentAction(id: string, input: unknown): Promise<CompleteActionResult> {
  const denied = await signedIn();
  if (denied) return denied;
  if (!validId(id)) return { ok: false, error: "That appointment could not be found." };
  const parsed = parseCompleteInput(input);
  if (!parsed.ok) return { ok: false, error: firstIssue(parsed.issues) };
  try {
    const r = await completeAppointment(id, parsed.value);
    revalidateAppointment(r.appointment);
    revalidatePath("/finance/time");
    return { ok: true, id: r.appointment.id, timesheet: r.timesheet, note: r.timesheetNote };
  } catch (e) {
    return failure(e, "The appointment could not be completed.");
  }
}

export async function logAppointmentTimeAction(id: string): Promise<CompleteActionResult> {
  const denied = await signedIn();
  if (denied) return denied;
  if (!validId(id)) return { ok: false, error: "That appointment could not be found." };
  try {
    const r = await logAppointmentTime(id);
    revalidateAppointment(r.appointment);
    revalidatePath("/finance/time");
    return { ok: true, id: r.appointment.id, timesheet: r.timesheet, note: r.note };
  } catch (e) {
    return failure(e, "The hours could not be put on the timesheets.");
  }
}

export async function cancelAppointmentAction(id: string, input: unknown): Promise<SchedulingActionResult> {
  const denied = await signedIn();
  if (denied) return denied;
  if (!validId(id)) return { ok: false, error: "That appointment could not be found." };
  const parsed = parseCancelInput(input);
  if (!parsed.ok) return { ok: false, error: firstIssue(parsed.issues) };
  try {
    const a = await cancelAppointment(id, parsed.value.reason);
    revalidateAppointment(a);
    return { ok: true, id: a.id };
  } catch (e) {
    return failure(e, "The appointment could not be cancelled.");
  }
}

export async function postponeAppointmentAction(id: string, input: unknown): Promise<SchedulingActionResult> {
  const denied = await signedIn();
  if (denied) return denied;
  if (!validId(id)) return { ok: false, error: "That appointment could not be found." };
  const parsed = parsePostponeInput(input);
  if (!parsed.ok) return { ok: false, error: firstIssue(parsed.issues) };
  try {
    const a = await postponeAppointment(id, parsed.value);
    revalidateAppointment(a);
    return { ok: true, id: a.id };
  } catch (e) {
    return failure(e, "The appointment could not be postponed.");
  }
}

export async function deleteAppointmentAction(id: string): Promise<SchedulingActionResult> {
  const denied = await signedIn();
  if (denied) return denied;
  if (!validId(id)) return { ok: false, error: "That appointment could not be found." };
  try {
    const a = await deleteAppointment(id);
    revalidateAppointment(a);
    return { ok: true, id: a.id };
  } catch (e) {
    return failure(e, "The appointment could not be deleted.");
  }
}
