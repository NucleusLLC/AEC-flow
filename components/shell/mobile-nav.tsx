"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { navSections } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:text-fg md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          {/* Drawer */}
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-sidebar text-sidebar-fg shadow-xl">
            <div className="flex h-16 items-center justify-between px-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-brand-fg font-bold">
                  Z
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-white">ZenArch</div>
                  <div className="text-[11px] text-sidebar-muted">AEC Suite</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-muted hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

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
                            onClick={() => setOpen(false)}
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
                                active ? "text-brand" : "text-sidebar-muted",
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
          </aside>
        </div>
      ) : null}
    </>
  );
}
