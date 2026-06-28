"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardCheck,
  CalendarClock,
  ListChecks,
  FolderOpen,
  FileStack,
  Calculator,
  FileText,
  HardHat,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function ProjectTabBar({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  const tabs = [
    { label: "Dashboard", href: base, icon: LayoutDashboard, exact: true },
    { label: "Overview", href: `${base}/overview`, icon: ClipboardCheck },
    { label: "Timeframe", href: `${base}/timeframe`, icon: CalendarClock },
    { label: "Punch List", href: `${base}/punch-list`, icon: ListChecks },
    { label: "Documents", href: `${base}/documents`, icon: FolderOpen },
    { label: "Drawings", href: `${base}/drawings`, icon: FileStack },
    { label: "Estimates", href: `${base}/estimates`, icon: Calculator },
    { label: "Proposals", href: `${base}/proposals`, icon: FileText },
    { label: "Construction Admin", href: `${base}/construction-admin`, icon: HardHat },
  ];

  return (
    <div className="-mx-1 overflow-x-auto border-b border-border">
      <div className="flex min-w-max items-center gap-1 px-1 pb-2">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                active ? "bg-brand text-brand-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
