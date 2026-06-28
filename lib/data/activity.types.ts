/**
 * Client-safe activity-feed declarations (types + label/icon maps as plain
 * data).
 *
 * This module MUST NOT import "@/lib/db" (or anything that drags the Postgres
 * driver into the browser bundle) so that "use client" components can import
 * activity types/labels without pulling Prisma client-side.
 * See [[aec-prisma-client-boundary]].
 */

/** A single, already-formatted entry rendered by the activity feed. */
export type ActivityEntry = {
  id: string;
  /** Display name of the user who performed the action. */
  actor: string;
  /** Up-to-2-letter avatar initials for the actor. */
  actorInitials?: string;
  /** Verb, e.g. "created" / "updated" / "approved". */
  action: string;
  /** e.g. "proposal" / "client" / "project" / "meeting" / "order". */
  entityType: string;
  /** Human label for the affected entity (title/name, falling back to id). */
  entityLabel: string;
  /** Deep-link to the entity, or null when none applies. */
  href: string | null;
  /** Relative time, e.g. "5 minutes ago". */
  at: string;
  /** ISO timestamp (for grouping / sorting on the client). */
  createdAt: string;
};

/** Lucide icon names per entity type (string keys — no React in this file). */
export const ENTITY_ICON: Record<string, string> = {
  proposal: "FileText",
  client: "Users",
  project: "FolderKanban",
  meeting: "NotebookPen",
  order: "ClipboardList",
};

/** Singular display label per entity type. */
export const ENTITY_LABEL: Record<string, string> = {
  proposal: "proposal",
  client: "client",
  project: "project",
  meeting: "meeting",
  order: "order",
};
