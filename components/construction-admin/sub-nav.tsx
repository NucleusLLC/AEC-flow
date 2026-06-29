"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Dashboard", href: "/construction-admin" },
  { label: "Photos", href: "/construction-admin/photos" },
  { label: "Change Orders", href: "/construction-admin/change-orders" },
  { label: "RFIs", href: "/construction-admin/rfis" },
  { label: "Submittals", href: "/construction-admin/submittals" },
  { label: "Site Instructions", href: "/construction-admin/site-instructions" },
  { label: "Delay Notices", href: "/construction-admin/delay-notices" },
  { label: "Reports", href: "/construction-admin/reports" },
  { label: "Certifications", href: "/construction-admin/certifications" },
  { label: "Punch List", href: "/construction-admin/punch-list" },
  { label: "Export Center", href: "/construction-admin/export" },
];

export function CaSubNav() {
  const pathname = usePathname();
  return (
    <div className="-mx-1 flex flex-wrap items-center gap-1 border-b border-border pb-3">
      {TABS.map((t) => {
        const active = t.href === "/construction-admin" ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
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
