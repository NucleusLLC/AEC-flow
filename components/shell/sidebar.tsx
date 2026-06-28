"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navSections } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-fg md:flex print:!hidden">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-brand-fg font-bold">
          Z
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">ZenArch</div>
          <div className="text-[11px] text-sidebar-muted">AEC Management Suite</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {navSections.map((section, i) => (
          <div key={i}>
            {section.title ? (
              <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
                {section.title}
              </div>
            ) : null}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                if (item.disabled) {
                  return (
                    <li key={item.href}>
                      <div
                        aria-disabled
                        title="Coming soon — not part of the beta"
                        className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-muted/50"
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0 text-sidebar-muted/40" strokeWidth={2} />
                        <span className="flex-1">{item.label}</span>
                        <span className="rounded bg-sidebar-2/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sidebar-muted/70">
                          Soon
                        </span>
                      </div>
                    </li>
                  );
                }
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-sidebar-2 text-white"
                          : "text-sidebar-fg hover:bg-sidebar-2/60 hover:text-white",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0",
                          active ? "text-brand" : "text-sidebar-muted group-hover:text-sidebar-fg",
                        )}
                        strokeWidth={2}
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-2 text-xs font-semibold text-white">
            GL
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-medium text-white">Greg Lacle</div>
            <div className="truncate text-[11px] text-sidebar-muted">Director</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
