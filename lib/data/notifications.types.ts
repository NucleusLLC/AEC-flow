/**
 * Notifications — client-safe types (no Prisma). The topbar menu imports this;
 * the Prisma-backed feed lives in lib/data/notifications.ts.
 */
export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  /** Relative time, e.g. "25 minutes ago". */
  at: string;
  href: string;
  unread: boolean;
};
