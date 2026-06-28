/**
 * Activity-feed data-access layer (Prisma-backed). SERVER-ONLY — imports
 * `@/lib/db`; client components use `./activity.types`. See
 * [[aec-prisma-client-boundary]].
 */
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/data/notifications";
import { initials } from "@/lib/utils";
import type { ActivityEntry } from "./activity.types";

export * from "./activity.types";

// What we fetch from Prisma — user for the actor, client/project for labels.
const ACTIVITY_INCLUDE = {
  user: { select: { name: true } },
  client: { select: { name: true } },
  project: { select: { name: true } },
} as const;

type ActivityRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  meta: unknown;
  createdAt: Date;
  user: { name: string } | null;
  client: { name: string } | null;
  project: { name: string } | null;
};

/** Build the deep-link for an entity, or null when none applies. */
function hrefFor(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case "proposal":
      return `/proposals/${entityId}`;
    case "project":
      return `/projects/${entityId}`;
    case "client":
      return `/clients/${entityId}`;
    case "order":
      return `/orders/${entityId}`;
    case "meeting":
      return `/meetings/${entityId}`;
    default:
      return null;
  }
}

/** Best-effort human label: relation name → meta.label → raw id. */
function labelFor(row: ActivityRow): string {
  if (row.entityType === "project" && row.project?.name) return row.project.name;
  if (row.entityType === "client" && row.client?.name) return row.client.name;
  const meta = row.meta;
  if (meta && typeof meta === "object" && "label" in meta) {
    const label = (meta as { label?: unknown }).label;
    if (typeof label === "string" && label.trim() !== "") return label;
  }
  return row.entityId;
}

function toEntry(row: ActivityRow): ActivityEntry {
  const actor = row.user?.name ?? "Someone";
  return {
    id: row.id,
    actor,
    actorInitials: initials(actor),
    action: row.action,
    entityType: row.entityType,
    entityLabel: labelFor(row),
    href: hrefFor(row.entityType, row.entityId),
    at: formatDistanceToNow(row.createdAt, { addSuffix: true }),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getRecentActivity(limit = 50): Promise<ActivityEntry[]> {
  const rows = await prisma.activityLog.findMany({
    include: ACTIVITY_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toEntry);
}

export async function getActivityForProject(
  projectId: string,
  limit = 50,
): Promise<ActivityEntry[]> {
  const rows = await prisma.activityLog.findMany({
    where: { projectId },
    include: ACTIVITY_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toEntry);
}

export async function getActivityForClient(
  clientId: string,
  limit = 50,
): Promise<ActivityEntry[]> {
  const rows = await prisma.activityLog.findMany({
    where: { clientId },
    include: ACTIVITY_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toEntry);
}

export type LogActivityInput = {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  projectId?: string | null;
  clientId?: string | null;
  meta?: unknown;
};

/**
 * Record an activity event. Best-effort: wraps everything in try/catch and
 * swallows errors so logging NEVER breaks the mutation that triggered it.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        projectId: input.projectId ?? null,
        clientId: input.clientId ?? null,
        // Prisma JSON column: pass the blob through, or omit when absent.
        meta: input.meta == null ? undefined : (input.meta as object),
      },
    });
  } catch {
    // Intentionally swallowed — activity logging is non-critical.
  }
}

/**
 * Resolve the actor id for logging. Reuses the notifications helper which
 * returns the signed-in user or falls back to the director so logged activity
 * always has an owner even with the auth wall off.
 */
export async function getActivityActorId(): Promise<string | null> {
  return getCurrentUserId();
}
