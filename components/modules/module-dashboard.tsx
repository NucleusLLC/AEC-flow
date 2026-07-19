import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { MODULE_MAP, type ModuleKey } from "@/lib/modules";

/**
 * Generic module landing page — module identity + quick links to the module's
 * active nav items. Used by Modules 1, 2 and 4. (Module 3 has a richer, purpose-
 * built dashboard with Estimates/Schedule summaries.)
 */
export function ModuleDashboard({
  moduleKey,
  children,
}: {
  moduleKey: ModuleKey;
  /** Optional stats section rendered between the header and the shortcut grid. */
  children?: React.ReactNode;
}) {
  const mod = MODULE_MAP[moduleKey];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-brand">
          Module {mod.number} · {mod.version}
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-fg">{mod.name}</h1>
        <p className="mt-1 text-sm text-muted">
          This module exposes existing AEC-flow systems — no data is duplicated. Use the sidebar or
          the shortcuts below.
        </p>
      </div>

      {children}

      {mod.nav
        .filter((section) => section.title !== "Overview")
        .map((section, i) => (
          <div key={i}>
            {section.title ? (
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
                {section.title}
              </h2>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {section.items.map((item) => {
                const Icon = item.icon;
                if (item.disabled) {
                  return (
                    <Card key={item.href} className="opacity-60">
                      <CardBody className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-muted">
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-fg">{item.label}</div>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                            Coming soon
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  );
                }
                return (
                  <Link key={item.href} href={item.href} className="group">
                    <Card className="transition-colors group-hover:border-brand/40">
                      <CardBody className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-fg">{item.label}</div>
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-muted group-hover:text-brand" />
                      </CardBody>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
