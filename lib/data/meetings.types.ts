/**
 * Meeting Minutes — client-safe types, label maps, and PURE helpers.
 *
 * This sibling of lib/data/meetings.ts must NEVER import "@/lib/db" (or any
 * Prisma runtime), so it is safe to import from `"use client"` components.
 * The Prisma-backed query functions live in lib/data/meetings.ts and re-export
 * everything here via `export * from "./meetings.types"`.
 */

export type MeetingType = "CLIENT" | "INTERNAL" | "SITE" | "AUTHORITY" | "VIRTUAL";

export type ActionStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "CANCELLED";

export const MEETING_TYPE_LABEL: Record<MeetingType, string> = {
  CLIENT: "Client",
  INTERNAL: "Internal",
  SITE: "Site",
  AUTHORITY: "Authority",
  VIRTUAL: "Virtual",
};

export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

const OPEN_ACTIONS: ActionStatus[] = ["OPEN", "IN_PROGRESS"];
export const isOpenAction = (s: ActionStatus) => OPEN_ACTIONS.includes(s);

export type MeetingListItem = {
  id: string;
  title: string;
  projectName: string;
  projectId: string;
  author: string;
  type: MeetingType;
  meetingDate: string;
  location: string | null;
  participantCount: number;
  actionItemsCount: number;
  openActionsCount: number;
  followUpDate: string | null;
};

export type MeetingActionItem = {
  id: string;
  description: string;
  assignee: string;
  dueDate: string | null;
  status: ActionStatus;
};

/** An action item with its meeting context — for a person's "my tasks" view. */
export type UserActionItem = {
  id: string;
  description: string;
  status: ActionStatus;
  dueDate: string | null;
  meetingId: string;
  meetingTitle: string;
  projectName: string;
};

/** Detail-only fields merged onto the list row to form the full record. */
type MeetingDetailExtra = {
  summary: string | null;
  discussion: string | null;
  decisions: string | null;
  participants: string[];
  createdAt: string;
  updatedAt: string;
  actionItems: MeetingActionItem[];
};

/** Full record the detail page consumes = list row + detail extras. */
export type MeetingRecord = MeetingListItem & MeetingDetailExtra;

export type MeetingsSummary = {
  total: number;
  thisMonth: number;
  openActions: number;
  upcomingFollowUps: number;
};

export function summarizeMeetings(list: MeetingListItem[]): MeetingsSummary {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const today = now.toISOString().slice(0, 10);
  return {
    total: list.length,
    thisMonth: list.filter((m) => m.meetingDate.startsWith(ym)).length,
    openActions: list.reduce((n, m) => n + m.openActionsCount, 0),
    upcomingFollowUps: list.filter((m) => m.followUpDate && m.followUpDate >= today).length,
  };
}

/**
 * Payload the create/edit form submits. `author` and each action item's
 * `assignee` are display names (resolved to userIds server-side); date fields
 * are "" or an ISO date string. Client-safe (no Prisma types) so the
 * `"use client"` form can import it. `id` is set only when editing.
 */
export type MeetingWriteInput = {
  id?: string;
  title: string;
  projectId: string;
  author: string;
  type: MeetingType;
  meetingDate: string;
  location: string;
  participants: string[];
  summary: string;
  discussion: string;
  decisions: string;
  followUpDate: string;
  actionItems: {
    description: string;
    assignee: string;
    dueDate: string;
    status: ActionStatus;
  }[];
};
