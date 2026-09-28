"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n/language-provider";

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
  const t = useT();
  const pathname = usePathname();
  const base = `/development/${projectId}`;
  return (
    <div className="-mx-1 flex flex-wrap items-center gap-1 border-b border-border pb-3">
      {TABS.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        const active = tab.segment ? pathname.startsWith(href) : pathname === base;
        if (tab.soon) {
          return (
            <span
              key={tab.label}
              title={t("Coming in the next build phase")}
              className="cursor-not-allowed rounded-lg px-3 py-1.5 text-sm font-medium text-faint/70"
            >
              {t(tab.label)}
            </span>
          );
        }
        return (
          <Link
            key={tab.label}
            href={href}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-brand text-brand-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            {t(tab.label)}
          </Link>
        );
      })}
    </div>
  );
}
