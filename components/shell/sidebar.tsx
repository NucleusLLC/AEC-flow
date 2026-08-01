"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { MessageSquarePlus, Settings, ShieldCheck } from "lucide-react";
import { openBetaReport } from "@/components/beta-report/open-beta-report";
import { useModule } from "@/components/shell/module-provider";
import { ModuleSwitcher } from "@/components/shell/module-switcher";
import { useT } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";
import { VERSION_COLOR } from "@/lib/version";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  DIRECTOR: "Director",
  MANAGER: "Manager",
  STAFF: "Staff",
  VIEWER: "Viewer",
};

function initials(name?: string | null): string {
  if (!name) return "?";
  return (
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function Sidebar({ version, collapsed = false, isFounder = false }: { version?: string; collapsed?: boolean; isFounder?: boolean }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { module } = useModule();
  const t = useT();
  const user = session?.user;
  const displayName = user?.name ?? "Account";
  const roleLabel = user?.role ? ROLE_LABEL[user.role] ?? user.role : "Beta tester";

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-fg transition-[width] duration-200 ease-in-out md:flex print:!hidden",
        collapsed ? "w-0" : "w-64",
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-[13px] font-bold text-brand-fg">
          AF
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">AEC-flow</div>
          <div className="text-[11px] text-sidebar-muted">AEC Management Suite</div>
        </div>
      </div>

      {/* Module switcher — swaps the nav groups below to the active module. */}
      <div className="pb-2">
        <ModuleSwitcher />
      </div>

      {/* Nav — reflects the active module. */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {module.nav.map((section, i) => (
          <div key={i}>
            {section.title ? (
              <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
                {t(section.title)}
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
                        <span className="flex-1">{t(item.label)}</span>
                        <span className="rounded bg-sidebar-2/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sidebar-muted/70">
                          {t("Soon")}
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
                      {t(item.label)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Settings — pinned below the nav so it is reachable from EVERY module,
       * not just the one whose curated nav happened to include it. */}
      <div className="border-t border-white/10 px-3 py-2">
        {(() => {
          const active = pathname === "/settings" || pathname.startsWith("/settings/");
          return (
            <Link
              href="/settings"
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-2 text-white"
                  : "text-sidebar-fg hover:bg-sidebar-2/60 hover:text-white",
              )}
            >
              <Settings
                className={cn(
                  "h-[18px] w-[18px] shrink-0",
                  active ? "text-brand" : "text-sidebar-muted group-hover:text-sidebar-fg",
                )}
                strokeWidth={2}
              />
              {t("Settings")}
            </Link>
          );
        })()}
      </div>

      {/* Beta feedback — opens the Bug/Wish panel (mounted in the (app) layout).
       * Lives here rather than floating over the page, where it used to overlap
       * content and the save/action buttons in the bottom-right corner. */}
      <div className="border-t border-white/10 px-3 py-2">
        <button
          type="button"
          onClick={openBetaReport}
          className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-fg transition-colors hover:bg-sidebar-2/60 hover:text-white"
        >
          <MessageSquarePlus
            className="h-[18px] w-[18px] shrink-0 text-sidebar-muted group-hover:text-sidebar-fg"
            strokeWidth={2}
          />
          {t("New Bug/Wish")}
        </button>
      </div>

      {/* Founder super-admin — cross-company management (founder only) */}
      {isFounder ? (
        <div className="border-t border-white/10 px-3 py-2">
          <Link
            href="/admin"
            className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-amber-300/90 hover:bg-white/5 hover:text-amber-200"
          >
            <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={2} />
            {t("Admin")}
          </Link>
        </div>
      ) : null}

      {/* Module identity panel (spec §24) — the active module + its Beta version.
       * This is the MODULE version domain, distinct from Estimate/Schedule record
       * versions and from the deployed app build below. */}
      <div className="border-t border-white/10 px-3 py-2.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
          {t("Module")} {module.number}
        </div>
        <div className="mt-0.5 text-[12px] font-semibold leading-snug text-white">
          {t(module.name)}
        </div>
        <div className="mt-1 font-mono text-[10px] tracking-tight text-brand/80">
          {module.version}
        </div>
      </div>

      {/* User — the actual signed-in account */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-2 text-xs font-semibold text-white">
            {initials(user?.name)}
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-medium text-white">{displayName}</div>
            <div className="truncate text-[11px] text-sidebar-muted">{roleLabel}</div>
          </div>
        </div>
        {version ? (
          /* Bright Turquoise, from the same constant the proposal version tag
           * uses: the deployed build is the version people check first, so it is
           * the one that has to stand out against the dark sidebar. */
          <div
            className="px-2 pt-1 font-mono text-[10px] font-semibold tracking-tight"
            style={{ color: VERSION_COLOR }}
            title="Deployed version · build"
          >
            {version}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
