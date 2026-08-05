"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Eye, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { DISPLAY_ITEMS, type DisplayKey, type DisplayPrefs } from "@/lib/schedule/display-prefs";

/**
 * Display Control — which schedule readouts are painted.
 *
 * PROTECTED SYSTEM (schedule) — display/chrome change, approved 2026-08-04.
 *
 * Chrome deliberately copied from the Categories editor two buttons along in
 * the same toolbar (schedule-gantt.tsx): identical trigger classes, the same
 * `fixed inset-0` click-catcher + `absolute right-0 mt-2 w-72 rounded-xl …
 * shadow-lg` panel, the same uppercase section caption and the same full-width
 * action button at the foot. Two popovers sitting side by side that dismiss or
 * measure differently would read as a bug, so this file adds no styling
 * vocabulary of its own.
 *
 * `right-0` is also what keeps the toolbar honest on a narrow viewport: the
 * panel grows leftward from the trigger, so it can never push the document
 * sideways the way a `left-0` panel would.
 *
 * Nothing here is aware of what the readouts mean — it toggles booleans. The
 * figures behind them are computed unconditionally either way.
 */
export function DisplayControl({
  prefs,
  hidden,
  onToggle,
  onShowAll,
}: {
  prefs: DisplayPrefs;
  /** How many readouts are currently hidden — 0 means the default board. */
  hidden: number;
  onToggle: (key: DisplayKey) => void;
  onShowAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Opening a menu should land the caret in it — otherwise a keyboard user has
  // to tab past the trigger to reach the first item they just asked for.
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>("[role='menuitemcheckbox']")?.focus();
  }, [open]);

  function items(): HTMLButtonElement[] {
    return Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role='menuitemcheckbox']") ?? []);
  }

  // Arrow/Home/End roving, because `role="menu"` promises it. Escape closes and
  // hands focus back to the trigger so the toolbar keeps its place.
  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      close(true);
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    const list = items();
    if (list.length === 0) return;
    e.preventDefault();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? list.length - 1
          : e.key === "ArrowDown"
            ? (at + 1) % list.length
            : (at - 1 + list.length) % list.length;
    list[next]?.focus();
  }

  return (
    <div className="relative" onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        title="Choose which schedule readouts are shown"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Display Control
        {hidden > 0 ? (
          <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-faint">
            {hidden} hidden
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => close(false)} aria-hidden />
          <div
            ref={menuRef}
            role="menu"
            aria-label="Display control"
            className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-border bg-surface p-2 shadow-lg"
          >
            <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
              Show on the board
            </div>
            <div className="max-h-64 space-y-0.5 overflow-y-auto">
              {DISPLAY_ITEMS.map((item) => {
                const on = prefs[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={on}
                    onClick={() => onToggle(item.key)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                        on ? "border-brand bg-brand text-brand-fg" : "border-border bg-surface",
                      )}
                    >
                      {on ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                    </span>
                    <span className={cn("min-w-0 flex-1 text-sm", on ? "text-fg" : "text-muted")}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={onShowAll}
              disabled={hidden === 0}
              className="mt-1 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-brand hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-default disabled:text-faint disabled:hover:bg-transparent"
            >
              <Eye className="h-3.5 w-3.5" /> Show all
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
