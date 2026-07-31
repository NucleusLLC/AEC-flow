"use server";

/**
 * Server actions behind the project dashboard's Tasks / Reminders / Agenda
 * widgets. They were localStorage-only, so an action could never reach another
 * member; these persist the item and revalidate the project page.
 *
 * Every action returns a tagged result instead of throwing, because the widgets
 * are small inline forms with nowhere to show an error boundary.
 */
import { revalidatePath } from "next/cache";
import {
  assignAgendaItem,
  createAgendaItem,
  deleteAgendaItem,
  importLocalAgenda,
  listMyAgenda,
  listProjectAgenda,
  setAgendaItemDone,
  type AgendaItem,
  type AgendaKind,
} from "@/lib/data/agenda";

export type AgendaResult = { ok: true; items: AgendaItem[] } | { ok: false; error: string };

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** Re-read a project's agenda. Also the return value of every mutation, so a
 *  widget always renders server truth rather than a locally patched list. */
export async function listProjectAgendaAction(projectId: string): Promise<AgendaResult> {
  try {
    return { ok: true, items: await listProjectAgenda(projectId) };
  } catch (e) {
    return { ok: false, error: message(e, "Could not load the agenda.") };
  }
}

/** Open items assigned to the signed-in user, across projects. */
export async function listMyAgendaAction(): Promise<AgendaResult> {
  try {
    return { ok: true, items: await listMyAgenda() };
  } catch (e) {
    return { ok: false, error: message(e, "Could not load your agenda.") };
  }
}

export async function createAgendaItemAction(input: {
  projectId: string;
  kind: AgendaKind;
  title: string;
  due?: string | null;
  assigneeId?: string | null;
}): Promise<AgendaResult> {
  try {
    await createAgendaItem(input);
    revalidatePath(`/projects/${input.projectId}`);
    return { ok: true, items: await listProjectAgenda(input.projectId) };
  } catch (e) {
    return { ok: false, error: message(e, "Could not save that.") };
  }
}

export async function setAgendaItemDoneAction(
  projectId: string,
  id: string,
  done: boolean,
): Promise<AgendaResult> {
  try {
    await setAgendaItemDone(id, done);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, items: await listProjectAgenda(projectId) };
  } catch (e) {
    return { ok: false, error: message(e, "Could not update that.") };
  }
}

export async function assignAgendaItemAction(
  projectId: string,
  id: string,
  assigneeId: string | null,
): Promise<AgendaResult> {
  try {
    await assignAgendaItem(id, assigneeId);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, items: await listProjectAgenda(projectId) };
  } catch (e) {
    return { ok: false, error: message(e, "Could not reassign that.") };
  }
}

export async function deleteAgendaItemAction(projectId: string, id: string): Promise<AgendaResult> {
  try {
    await deleteAgendaItem(id);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, items: await listProjectAgenda(projectId) };
  } catch (e) {
    return { ok: false, error: message(e, "Could not delete that.") };
  }
}

export type ImportResult =
  | { ok: true; imported: number; skipped: number; items: AgendaItem[] }
  | { ok: false; error: string };

/** Migrate what a tester already typed into the browser-only widgets. */
export async function importLocalAgendaAction(
  projectId: string,
  items: { kind: AgendaKind; title: string; due: string | null; done: boolean }[],
): Promise<ImportResult> {
  try {
    const { imported, skipped } = await importLocalAgenda(projectId, items);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, imported, skipped, items: await listProjectAgenda(projectId) };
  } catch (e) {
    return { ok: false, error: message(e, "Could not import those items.") };
  }
}
