/**
 * Project agenda — the tasks and dated reminders that show on a project's
 * dashboard, and the one thing the localStorage widgets could never do: be
 * assigned to somebody else.
 *
 * Beta wish (2026-07-16): "I can write an action in the agenda, but i cannot
 * plan it in other members agenda?" Agenda items used to live in the author's
 * browser only, so there was nothing to hand over. They are rows now.
 *
 * Server-only (imports Prisma). Every read/write goes through the tenant-scoped
 * client in lib/db.ts — `Task` is in TENANT_MODELS, so companyId is applied for
 * us and a foreign project's items are simply not found.
 *
 * Tasks and reminders share the `tasks` table, told apart by `kind`, so the
 * Agenda widget reads one ordered list instead of merging two queries.
 * `projectId IS NULL` remains the practice-wide list behind /tasks — nothing
 * here touches those rows.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/data/notifications";
import { getCurrentCompanyId } from "@/lib/server/tenant";

export type AgendaKind = "TASK" | "REMINDER";

export type AgendaItem = {
  id: string;
  kind: AgendaKind;
  title: string;
  /** ISO string. A reminder always has one; a task may not. */
  due: string | null;
  done: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
  createdById: string | null;
  projectId: string | null;
};

export type AgendaAssignee = { id: string; name: string };

type Row = {
  id: string;
  kind: AgendaKind;
  title: string;
  dueDate: Date | null;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  assignee: string | null;
  assigneeId: string | null;
  createdById: string | null;
  projectId: string | null;
};

function toItem(r: Row): AgendaItem {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    due: r.dueDate ? r.dueDate.toISOString() : null,
    done: r.status === "DONE",
    assigneeId: r.assigneeId,
    assigneeName: r.assignee,
    createdById: r.createdById,
    projectId: r.projectId,
  };
}

const SELECT = {
  id: true,
  kind: true,
  title: true,
  dueDate: true,
  status: true,
  assignee: true,
  assigneeId: true,
  createdById: true,
  projectId: true,
} as const;

/** Everything on one project's agenda, soonest first, undated last. */
export async function listProjectAgenda(projectId: string): Promise<AgendaItem[]> {
  const rows = await prisma.task.findMany({
    where: { projectId },
    select: SELECT,
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });
  return (rows as Row[]).map(toItem);
}

/**
 * Open items assigned to the signed-in user across every project — the other
 * half of the wish: what one member plans lands in the assignee's own agenda.
 */
export async function listMyAgenda(): Promise<AgendaItem[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const rows = await prisma.task.findMany({
    where: { assigneeId: userId, status: { not: "DONE" }, projectId: { not: null } },
    select: SELECT,
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });
  return (rows as Row[]).map(toItem);
}

/** Members an item can be handed to — the signed-in user's own company. */
export async function listAgendaAssignees(): Promise<AgendaAssignee[]> {
  // User is excluded from the tenant extension (login resolves by email before
  // a session exists), so this scopes by company BY HAND. See lib/db.ts.
  const companyId = await getCurrentCompanyId();
  const users = await prisma.user.findMany({
    where: { companyId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({ id: u.id, name: u.name }));
}

export type CreateAgendaInput = {
  projectId: string;
  kind: AgendaKind;
  title: string;
  /** ISO date (task) or datetime (reminder); null only for an undated task. */
  due?: string | null;
  assigneeId?: string | null;
};

export async function createAgendaItem(input: CreateAgendaInput): Promise<AgendaItem> {
  const title = input.title.trim();
  if (!title) throw new Error("A title is required.");
  if (input.kind === "REMINDER" && !input.due) throw new Error("A reminder needs a date and time.");

  // Resolve the display name from the id so the list renders without a join,
  // and so an assignee outside the company is rejected rather than stored.
  const assignee = input.assigneeId ? await resolveAssignee(input.assigneeId) : null;
  const createdById = await getCurrentUserId();

  const row = await prisma.task.create({
    data: {
      title,
      kind: input.kind,
      projectId: input.projectId,
      dueDate: input.due ? new Date(input.due) : null,
      assigneeId: assignee?.id ?? null,
      assignee: assignee?.name ?? null,
      createdById,
    },
    select: SELECT,
  });
  return toItem(row as Row);
}

async function resolveAssignee(id: string): Promise<AgendaAssignee | null> {
  const companyId = await getCurrentCompanyId();
  const user = await prisma.user.findFirst({ where: { id, companyId }, select: { id: true, name: true } });
  if (!user) throw new Error("That member is not in your practice.");
  return user;
}

/** Tick / untick. Tenant scoping makes another company's id simply not match. */
export async function setAgendaItemDone(id: string, done: boolean): Promise<void> {
  await prisma.task.update({ where: { id }, data: { status: done ? "DONE" : "TODO" } });
}

/** Hand an existing item to someone else, or take the assignment off. */
export async function assignAgendaItem(id: string, assigneeId: string | null): Promise<void> {
  const assignee = assigneeId ? await resolveAssignee(assigneeId) : null;
  await prisma.task.update({
    where: { id },
    data: { assigneeId: assignee?.id ?? null, assignee: assignee?.name ?? null },
  });
}

export async function deleteAgendaItem(id: string): Promise<void> {
  await prisma.task.delete({ where: { id } });
}

/**
 * One-time import of what a tester already typed into the browser-only widgets.
 * Offered explicitly rather than run silently, so nothing appears server-side
 * without the user asking, and re-running it cannot double up: an item whose
 * kind, title and date already exist on this project is skipped.
 */
export async function importLocalAgenda(
  projectId: string,
  items: { kind: AgendaKind; title: string; due: string | null; done: boolean }[],
): Promise<{ imported: number; skipped: number }> {
  const existing = await prisma.task.findMany({
    where: { projectId },
    select: { kind: true, title: true, dueDate: true },
  });
  const seen = new Set(
    existing.map((e) => `${e.kind}|${e.title.trim().toLowerCase()}|${e.dueDate ? e.dueDate.toISOString() : ""}`),
  );
  const createdById = await getCurrentUserId();

  let imported = 0;
  let skipped = 0;
  for (const raw of items) {
    const title = raw.title.trim();
    if (!title) {
      skipped += 1;
      continue;
    }
    const due = raw.due ? new Date(raw.due) : null;
    const key = `${raw.kind}|${title.toLowerCase()}|${due ? due.toISOString() : ""}`;
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    await prisma.task.create({
      data: {
        title,
        kind: raw.kind,
        projectId,
        dueDate: due,
        status: raw.done ? "DONE" : "TODO",
        createdById,
      },
    });
    imported += 1;
  }
  return { imported, skipped };
}
