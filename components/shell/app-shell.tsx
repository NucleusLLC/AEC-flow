"use client";

import { Suspense, useEffect, useState } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import type { NotificationItem } from "@/lib/data/notifications.types";

/**
 * App chrome shell — owns the desktop "full screen" collapse state shared by the
 * Sidebar and Topbar. When collapsed, the sidebar slides closed (width → 0), the
 * stage expands over it, and a burger + brand appear in the topbar to reopen it.
 * "Full screen" also enters the browser's native fullscreen (hides tabs/address
 * bar) for maximum real estate. State lives here (in the persistent (app) layout),
 * so it survives client navigation between pages.
 */
export function AppShell({
  notifications,
  version,
  children,
}: {
  notifications: NotificationItem[];
  version?: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      if (next && !document.fullscreenElement) {
        void document.documentElement.requestFullscreen?.();
      } else if (!next && document.fullscreenElement) {
        void document.exitFullscreen?.();
      }
    } catch {
      /* fullscreen may be blocked; the sidebar collapse still applies */
    }
  };

  // If the user leaves browser fullscreen (Esc / F11), reopen the sidebar so the
  // two stay in sync.
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setCollapsed(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  return (
    <div className="flex h-full">
      <Sidebar version={version} collapsed={collapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<div className="h-16 shrink-0 border-b border-border bg-surface" />}>
          <Topbar notifications={notifications} collapsed={collapsed} onToggleSidebar={toggle} />
        </Suspense>
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
