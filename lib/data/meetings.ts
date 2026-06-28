/**
 * Meeting Minutes data-access layer. Prisma-backed getters + mutations.
 *
 * Client-safe types, label maps, and pure helpers live in ./meetings.types so
 * `"use client"` components can import them without dragging the Postgres driver
 * into the browser bundle. They are re-exported below so server-side call sites
 * (`@/lib/data/meetings`) keep working unchanged.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export * from "./meetings.types";
import {
  isOpenAction,
  type MeetingListItem,
  type MeetingRecord,
  type MeetingWriteInput,
  type ActionStatus,
  type UserActionItem,
} from "./meetings.types";

/** Render a DateTime column as a "YYYY-MM-DD" date string; null stays null. */
function ymd(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

type MeetingListPayload = Prisma.MeetingMinuteGetPayload<{
  include: { project: true; author: true; actionItems: true };
}>;

type MeetingRecordPayload = Prisma.MeetingMinuteGetPayload<{
  include: {
    project: true;
    author: true;
    actionItems: { include: { assignee: true } };
  };
}>;

function toListItem(m: MeetingListPayload): MeetingListItem {
  return {
    id: m.id,
    title: m.title,
    projectName: m.project.name,
    projectId: m.projectId,
    author: m.author.name,
    type: m.type,
    meetingDate: ymd(m.meetingDate) as string,
    location: m.location,
    participantCount: m.participants.length,
    actionItemsCount: m.actionItems.length,
    openActionsCount: m.actionItems.filter((a) => isOpenAction(a.status)).length,
    followUpDate: ymd(m.followUpDate),
  };
}

function toRecord(m: MeetingRecordPayload): MeetingRecord {
  return {
    id: m.id,
    title: m.title,
    projectName: m.project.name,
    projectId: m.projectId,
    author: m.author.name,
    type: m.type,
    meetingDate: ymd(m.meetingDate) as string,
    location: m.location,
    participantCount: m.participants.length,
    actionItemsCount: m.actionItems.length,
    openActionsCount: m.actionItems.filter((a) => isOpenAction(a.status)).length,
    followUpDate: ymd(m.followUpDate),
    summary: m.summary,
    discussion: m.discussion,
    decisions: m.decisions,
    participants: m.participants,
    createdAt: ymd(m.createdAt) as string,
    updatedAt: ymd(m.updatedAt) as string,
    actionItems: m.actionItems.map((a) => ({
      id: a.id,
      description: a.description,
      assignee: a.assignee.name,
      dueDate: ymd(a.dueDate),
      status: a.status,
    })),
  };
}

export async function getMeetings(): Promise<MeetingListItem[]> {
  try {
    const rows = await prisma.meetingMinute.findMany({
      include: { project: true, author: true, actionItems: true },
      orderBy: { meetingDate: "desc" },
    });
    return rows.map(toListItem);
  } catch (e) {
    // Degrade gracefully (empty list) instead of 500-ing the page if the DB is
    // unreachable — mirrors the Construction-Admin repos' resilience.
    console.error("[meetings] getMeetings failed; returning empty list:", e);
    return [];
  }
}

/** Meetings logged against one project (newest first) — for the project page. */
export async function getMeetingsForProject(projectId: string): Promise<MeetingListItem[]> {
  const rows = await prisma.meetingMinute.findMany({
    where: { projectId },
    include: { project: true, author: true, actionItems: true },
    orderBy: { meetingDate: "desc" },
  });
  return rows.map(toListItem);
}

/** Open action items assigned to a user, with meeting context — for "my tasks". */
export async function getActionItemsForUser(userId: string): Promise<UserActionItem[]> {
  const rows = await prisma.actionItem.findMany({
    where: { assigneeId: userId, status: { in: ["OPEN", "IN_PROGRESS"] } },
    include: { meeting: { include: { project: true } } },
    orderBy: [{ dueDate: "asc" }],
  });
  return rows.map((a) => ({
    id: a.id,
    description: a.description,
    status: a.status as ActionStatus,
    dueDate: ymd(a.dueDate),
    meetingId: a.meetingId,
    meetingTitle: a.meeting.title,
    projectName: a.meeting.project.name,
  }));
}

export async function getMeeting(id: string): Promise<MeetingRecord | null> {
  const row = await prisma.meetingMinute.findFirst({
    where: { id },
    include: {
      project: true,
      author: true,
      actionItems: { include: { assignee: true } },
    },
  });
  if (!row) return null;
  return toRecord(row);
}

/* ───────────────────────────────────────────────────────────────────────────
 * MUTATIONS — create/update. Called from the server action in
 * app/(app)/meetings/actions.ts. The form submits the author's display name; we
 * resolve it to a userId. Action items are replaced wholesale on update.
 * ────────────────────────────────────────────────────────────────────────── */

async function resolveOwnerId(name: string): Promise<string> {
  const byName = await prisma.user.findFirst({ where: { name }, select: { id: true } });
  if (byName) return byName.id;
  // Fall back to a senior user so a write never fails on an unmatched name.
  const fallback = await prisma.user.findFirst({
    orderBy: { role: "asc" },
    select: { id: true },
  });
  if (!fallback) throw new Error("No users exist to assign as the meeting author.");
  return fallback.id;
}

/** Build action-item create rows, resolving each assignee name → userId. */
async function actionItemCreates(input: MeetingWriteInput) {
  const items = input.actionItems.filter((a) => a.description.trim() !== "");
  const rows = [] as {
    description: string;
    assigneeId: string;
    dueDate: Date | null;
    status: MeetingWriteInput["actionItems"][number]["status"];
  }[];
  for (const a of items) {
    rows.push({
      description: a.description,
      assigneeId: await resolveOwnerId(a.assignee),
      dueDate: a.dueDate ? new Date(a.dueDate) : null,
      status: a.status,
    });
  }
  return rows;
}

function scalarData(input: MeetingWriteInput, authorId: string) {
  return {
    title: input.title,
    projectId: input.projectId,
    authorId,
    type: input.type,
    meetingDate: new Date(input.meetingDate),
    location: input.location || null,
    participants: input.participants.map((p) => p.trim()).filter(Boolean),
    summary: input.summary || null,
    discussion: input.discussion || null,
    decisions: input.decisions || null,
    followUpDate: input.followUpDate ? new Date(input.followUpDate) : null,
  } satisfies Partial<Prisma.MeetingMinuteUncheckedCreateInput>;
}

/** Create a new meeting with its action items. Returns the new meeting id. */
export async function createMeeting(input: MeetingWriteInput): Promise<string> {
  const authorId = await resolveOwnerId(input.author);
  const actions = await actionItemCreates(input);
  const created = await prisma.meetingMinute.create({
    data: {
      ...scalarData(input, authorId),
      actionItems: { create: actions },
    },
    select: { id: true },
  });
  return created.id;
}

/** Update an existing meeting; action items are replaced wholesale. */
export async function updateMeeting(input: MeetingWriteInput): Promise<string> {
  if (!input.id) throw new Error("Meeting id is required to update.");
  const authorId = await resolveOwnerId(input.author);
  const actions = await actionItemCreates(input);
  await prisma.$transaction(async (tx) => {
    const existing = await tx.meetingMinute.findFirst({
      where: { id: input.id },
      select: { id: true },
    });
    if (!existing) throw new Error(`Meeting ${input.id} not found.`);
    await tx.actionItem.deleteMany({ where: { meetingId: existing.id } });
    await tx.meetingMinute.update({
      where: { id: existing.id },
      data: {
        ...scalarData(input, authorId),
        actionItems: { create: actions },
      },
    });
  });
  return input.id;
}
