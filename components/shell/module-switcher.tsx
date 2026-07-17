"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useModule } from "@/components/shell/module-provider";
import { useT } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";

/**
 * Module switcher — swaps the active module (and therefore the sidebar's nav
 * groups). Lives at the top of the sidebar, under the brand. Purely an outer
 * shell control; it never touches the protected systems.
 */
export function ModuleSwitcher() {
  const { module, modules, setModule } = useModule();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const Icon = module.icon;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative px-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="group flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-sidebar-2/50 px-2.5 py-2 text-left transition-colors hover:bg-sidebar-2"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand/15 text-brand">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
            {t("Module")} {module.number}
          </span>
          <span className="block truncate text-[13px] font-medium text-white">{t(module.tagline)}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-muted group-hover:text-white" />
      </button>

      {open ? (
        <div
          role="listbox"
          className="absolute left-3 right-3 z-30 mt-1 overflow-hidden rounded-lg border border-white/10 bg-sidebar shadow-xl"
        >
          {modules.map((m) => {
            const MIcon = m.icon;
            const active = m.key === module.key;
            return (
              <button
                key={m.key}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setOpen(false);
                  if (!active) setModule(m.key);
                }}
                className={cn(
                  "flex w-full items-start gap-2.5 px-2.5 py-2 text-left transition-colors",
                  active ? "bg-sidebar-2" : "hover:bg-sidebar-2/60",
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/5 text-sidebar-fg">
                  <MIcon className="h-4 w-4" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted">
                    {t("Module")} {m.number}
                  </span>
                  <span className="block truncate text-[13px] font-medium text-white">{t(m.tagline)}</span>
                </span>
                {active ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
