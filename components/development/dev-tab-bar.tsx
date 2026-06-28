"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Workspace tabs. The full spec set is listed; tabs not yet built are marked. */
const TABS: Array<{ label: string; segment: string; soon?: boolean }> = [
  { label: "Dashboard", segment: "" },
  { label: "Setup", segment: "setup" },
  { label: "Land", segment: "land" },
  { label: "Lots", segment: "lots" },
  { label: "Units", segment: "units" },
  { label: "Costs", segment: "costs" },
  { label: "Procurement", segment: "procurement" },
  { label: "Permits", segment: "permits" },
  { label: "Sales", segment: "sales" },
  { label: "Cash Flow", segment: "cash-flow" },
  { label: "Scenarios", segment: "scenarios" },
  { label: "Documents", segment: "documents" },
  { label: "Reports", segment: "reports" },
];

export function DevTabBar({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/development/${projectId}`;
  return (
    <div className="-mx-1 flex flex-wrap items-center gap-1 border-b border-border pb-3">
      {TABS.map((t) => {
        const href = t.segment ? `${base}/${t.segment}` : base;
        const active = t.segment ? pathname.startsWith(href) : pathname === base;
        if (t.soon) {
          return (
            <span
              key={t.label}
              title="Coming in the next build phase"
              className="cursor-not-allowed rounded-lg px-3 py-1.5 text-sm font-medium text-faint/70"
            >
              {t.label}
            </span>
          );
        }
        return (
          <Link
            key={t.label}
            href={href}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-brand text-brand-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
