/**
 * Notifications data-access layer (Prisma-backed). SERVER-ONLY — imports
 * `@/lib/db`; client components use `./notifications.types` + the server actions
 * in `app/(app)/notifications/actions.ts`. See [[aec-prisma-client-boundary]].
 */
import { getServerSession } from "next-auth";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import type { NotificationItem } from "./notifications.types";

export * from "./notifications.types";

/**
 * The user whose notifications we show. Uses the signed-in user when present;
 * since the auth wall is opt-in (AUTH_ENFORCE), fall back to the practice
 * director so the feed has an owner in the open demo.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) return session.user.id;
  const director = await prisma.user.findFirst({
    where: { role: "DIRECTOR" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (director) return director.id;
  const anyUser = await prisma.user.findFirst({ select: { id: true } });
  return anyUser?.id ?? null;
}

export async function getNotificationsForCurrentUser(): Promise<NotificationItem[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return rows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    at: formatDistanceToNow(n.createdAt, { addSuffix: true }),
    href: n.link ?? "#",
    unread: !n.isRead,
  }));
}

export async function markAllNotificationsRead(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}
