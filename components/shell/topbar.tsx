"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { navSections } from "@/lib/nav";
import { MobileNav } from "@/components/shell/mobile-nav";
import { NotificationsMenu } from "@/components/shell/notifications-menu";
import { NewMenu } from "@/components/shell/new-menu";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { UserMenu } from "@/components/shell/user-menu";
import type { NotificationItem } from "@/lib/data/notifications.types";

function usePageTitle(): string {
  const pathname = usePathname();
  const items = navSections.flatMap((s) => s.items);
  const match = items
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? "AEC-flow";
}

export function Topbar({ notifications }: { notifications: NotificationItem[] }) {
  const title = usePageTitle();
  const currentQ = useSearchParams().get("q") ?? "";

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur sm:px-6 print:hidden">
      <MobileNav />
      <h1 className="text-base font-semibold text-fg">{title}</h1>

      <div className="ml-auto flex items-center gap-2">
        <form action="/search" className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            key={currentQ}
            type="search"
            name="q"
            defaultValue={currentQ}
            placeholder="Search…"
            className="h-9 w-56 rounded-lg border border-border bg-surface-2 pl-8 pr-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          />
        </form>

        <NewMenu />

        <ThemeToggle />

        <NotificationsMenu initial={notifications} />

        <UserMenu />
      </div>
    </header>
  );
}
