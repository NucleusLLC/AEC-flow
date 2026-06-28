"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  CornerDownLeft,
  Plus,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { navSections } from "@/lib/nav";
import { cn } from "@/lib/utils";

type Command = {
  id: string;
  label: string;
  group: string;
  href: string;
  icon: LucideIcon;
  keywords?: string;
};

const CREATE_ROUTES: Array<{ label: string; href: string }> = [
  { label: "New client", href: "/clients/new" },
  { label: "New proposal", href: "/proposals/new" },
  { label: "New order", href: "/orders/new" },
  { label: "New project", href: "/projects/new" },
  { label: "New meeting minutes", href: "/meetings/new" },
  { label: "Add team member", href: "/team/new" },
  { label: "Request leave", href: "/leave/new" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build the static command list from nav + create routes.
  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = navSections.flatMap((s) =>
      s.items
        .filter((i) => !i.disabled) // beta: don't surface grayed-out modules
        .map((i) => ({
          id: `nav:${i.href}`,
          label: i.label,
          group: "Navigate",
          href: i.href,
          icon: i.icon,
        })),
    );
    const create: Command[] = CREATE_ROUTES.map((c) => ({
      id: `new:${c.href}`,
      label: c.label,
      group: "Create",
      href: c.href,
      icon: Plus,
    }));
    return [...nav, ...create];
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? commands.filter((c) => c.label.toLowerCase().includes(q)) : commands),
    [commands, q],
  );

  // The full result list includes a trailing "search the app" action.
  const showSearch = q.length > 0;
  const resultCount = filtered.length + (showSearch ? 1 : 0);

  function close() {
    setOpen(false);
    setQuery("");
    setActive(0);
  }

  // Global hotkey: Cmd/Ctrl+K to toggle, Esc to close. State changes happen in
  // the event handler (not the effect body) to satisfy the React Compiler rules.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) close();
        else setOpen(true);
      } else if (e.key === "Escape" && open) {
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus the input when opened (DOM side-effect only — no setState here).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  function go(href: string) {
    close();
    router.push(href);
  }

  function runIndex(i: number) {
    if (showSearch && i === filtered.length) {
      go(`/search?q=${encodeURIComponent(query.trim())}`);
    } else if (filtered[i]) {
      go(filtered[i].href);
    }
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % Math.max(1, resultCount));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + resultCount) % Math.max(1, resultCount));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runIndex(active);
    }
  }

  // Group the filtered commands for display while keeping a flat index.
  let runningIndex = -1;
  const groups = ["Navigate", "Create"] as const;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} aria-hidden />

      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
        {/* Input */}
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="h-4 w-4 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKey}
            placeholder="Search or jump to…"
            className="h-12 w-full bg-transparent text-sm text-fg placeholder:text-faint focus:outline-none"
          />
          <kbd className="hidden rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] text-faint sm:block">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {resultCount === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted">No matches</div>
          ) : (
            <>
              {groups.map((group) => {
                const items = filtered.filter((c) => c.group === group);
                if (items.length === 0) return null;
                return (
                  <div key={group} className="mb-1">
                    <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-faint">
                      {group}
                    </div>
                    {items.map((c) => {
                      runningIndex += 1;
                      const idx = runningIndex;
                      const Icon = c.icon;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => runIndex(idx)}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-2 text-left text-sm",
                            active === idx ? "bg-surface-2 text-fg" : "text-muted",
                          )}
                        >
                          <Icon className="h-4 w-4 text-faint" />
                          <span className="flex-1 text-fg">{c.label}</span>
                          {active === idx ? <CornerDownLeft className="h-3.5 w-3.5 text-faint" /> : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {showSearch
                ? (() => {
                    runningIndex += 1;
                    const idx = runningIndex;
                    return (
                      <div>
                        <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-faint">
                          Search
                        </div>
                        <button
                          type="button"
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => runIndex(idx)}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-2 text-left text-sm",
                            active === idx ? "bg-surface-2" : "",
                          )}
                        >
                          <ArrowRight className="h-4 w-4 text-faint" />
                          <span className="flex-1 text-fg">
                            Search the app for &ldquo;{query.trim()}&rdquo;
                          </span>
                        </button>
                      </div>
                    );
                  })()
                : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
