/**
 * Notifications data-access layer (Prisma-backed). SERVER-ONLY — imports
 * `@/lib/db`; client components use `./notifications.types` + the server actions
 * in `app/(app)/notifications/actions.ts`. See [[aec-prisma-client-boundary]].
 */
import { getServerSession } from "next-auth";
import { timeAgo } from "@/lib/i18n/relative-time";
import { getServerLang } from "@/lib/i18n/server";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import type { NotificationItem } from "./notifications.types";

export * from "./notifications.types";

/**
 * The signed-in user's id, or null.
 *
 * It used to fall back to the oldest DIRECTOR in the database — of ANY
 * company — and then to any user at all, so the open demo had an owner. That
 * let a request with no session act as somebody else: mark their
 * notifications read, file a beta report in their name, and be credited in
 * the activity log. Every caller already handles null.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function getNotificationsForCurrentUser(): Promise<NotificationItem[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const lang = await getServerLang();
  return rows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    at: timeAgo(n.createdAt, lang),
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
