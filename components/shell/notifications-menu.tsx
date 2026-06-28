"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NotificationItem } from "@/lib/data/notifications.types";
import { markAllReadAction } from "@/app/(app)/notifications/actions";

export function NotificationsMenu({ initial }: { initial: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>(initial);
  const [, startTransition] = useTransition();
  const unreadCount = items.filter((n) => n.unread).length;

  const markAllRead = () => {
    setItems((prev) => prev.map((n) => ({ ...n, unread: false }))); // optimistic
    startTransition(() => {
      void markAllReadAction();
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:text-fg"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold text-white ring-2 ring-surface">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold text-fg">Notifications</span>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                >
                  <Check className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              ) : null}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted">You&rsquo;re all caught up.</div>
              ) : null}
              {items.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="flex gap-3 border-b border-border px-4 py-3 transition-colors last:border-0 hover:bg-surface-2"
                >
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      n.unread ? "bg-brand" : "bg-transparent",
                    )}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-fg">{n.title}</div>
                    <div className="text-xs leading-snug text-muted">{n.body}</div>
                    <div className="mt-0.5 text-[11px] text-faint">{n.at}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
