"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, ClipboardPaste, X, ChevronRight, ChevronDown } from "lucide-react";
import type { EstimateCategory } from "@/lib/data/estimates";

const CLIP_KEY = "aecflow:estimate-section-clipboard";

let idc = 0;
const nid = (p: string) => `${p}-${Math.floor(performance.now())}-${idc++}`;

/** Deep-copy categories with fresh ids so a paste never collides with existing rows. */
function reid(cats: EstimateCategory[]): EstimateCategory[] {
  return cats.map((c) => ({
    ...c,
    id: nid("sec"),
    items: c.items.map((it) => ({ ...it, id: nid("item") })),
  }));
}

function readClip(): EstimateCategory[] {
  try {
    const raw = localStorage.getItem(CLIP_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as EstimateCategory[]) : [];
  } catch {
    return [];
  }
}

/**
 * Copy sections (and chosen line items) from this estimate to a clipboard that
 * survives across estimates/projects (localStorage), and paste them into another.
 * Self-contained: reads the current categories and appends via `onPaste` — never
 * touches the estimate sheet's own table.
 */
export function SectionCopy({
  categories,
  onPaste,
}: {
  categories: EstimateCategory[];
  onPaste: (cats: EstimateCategory[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [checkedSecs, setCheckedSecs] = useState<Record<string, boolean>>({});
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [clip, setClip] = useState<EstimateCategory[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read clipboard after mount / on open
    setClip(readClip());
  }, [open]);

  const clipItemCount = useMemo(() => clip.reduce((n, c) => n + c.items.length, 0), [clip]);

  const toggleSec = (c: EstimateCategory) => {
    const next = !checkedSecs[c.id];
    setCheckedSecs((s) => ({ ...s, [c.id]: next }));
    // Checking a section (de)selects all its items.
    setCheckedItems((s) => {
      const copy = { ...s };
      c.items.forEach((it) => (copy[it.id] = next));
      return copy;
    });
  };
  const toggleItem = (secId: string, itemId: string) => {
    setCheckedItems((s) => ({ ...s, [itemId]: !s[itemId] }));
    setCheckedSecs((s) => ({ ...s, [secId]: true }));
  };

  const selectedCategories = (): EstimateCategory[] => {
    const out: EstimateCategory[] = [];
    for (const c of categories) {
      if (!checkedSecs[c.id]) continue;
      const items = c.items.filter((it) => checkedItems[it.id]);
      out.push({ ...c, items });
    }
    return out;
  };

  const selectedCount = categories.filter((c) => checkedSecs[c.id]).length;

  const doCopy = () => {
    const cats = selectedCategories();
    if (!cats.length) return;
    try {
      localStorage.setItem(CLIP_KEY, JSON.stringify(cats));
    } catch {
      /* ignore */
    }
    setClip(cats);
    setOpen(false);
    setCheckedSecs({});
    setCheckedItems({});
  };

  const doPaste = () => {
    const cats = readClip();
    if (cats.length) onPaste(reid(cats));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        title="Copy sections to reuse in another estimate"
      >
        <Copy className="h-4 w-4" /> Copy sections
      </button>
      {clip.length > 0 ? (
        <button
          type="button"
          onClick={doPaste}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/5 px-3 text-sm font-medium text-brand transition-colors hover:bg-brand/10"
          title={`Paste ${clip.length} section(s) · ${clipItemCount} line(s) copied earlier`}
        >
          <ClipboardPaste className="h-4 w-4" /> Paste sections ({clip.length})
        </button>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div>
                <h3 className="text-sm font-semibold text-fg">Copy sections</h3>
                <p className="text-xs text-muted">Check the headers and lines to copy, then paste into any estimate.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-faint hover:bg-surface-2 hover:text-fg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {categories.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted">This estimate has no sections yet.</p>
              ) : (
                <ul className="space-y-1">
                  {categories.map((c) => {
                    const isOpen = expanded[c.id];
                    return (
                      <li key={c.id} className="rounded-lg border border-border">
                        <div className="flex items-center gap-2 px-2 py-2">
                          <input
                            type="checkbox"
                            checked={!!checkedSecs[c.id]}
                            onChange={() => toggleSec(c)}
                            className="h-4 w-4 rounded border-border text-brand focus:ring-brand/30"
                          />
                          <button
                            type="button"
                            onClick={() => setExpanded((s) => ({ ...s, [c.id]: !s[c.id] }))}
                            className="flex flex-1 items-center gap-1 text-left text-sm font-medium text-fg"
                          >
                            {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-faint" /> : <ChevronRight className="h-3.5 w-3.5 text-faint" />}
                            {c.code ? <span className="font-mono text-[11px] text-muted">{c.code}</span> : null}
                            {c.name || "Untitled section"}
                            <span className="text-[11px] text-faint">· {c.items.length} line{c.items.length === 1 ? "" : "s"}</span>
                          </button>
                        </div>
                        {isOpen ? (
                          <ul className="border-t border-border px-2 py-1">
                            {c.items.map((it) => (
                              <li key={it.id} className="flex items-center gap-2 py-1 pl-6 text-sm">
                                <input
                                  type="checkbox"
                                  checked={!!checkedItems[it.id]}
                                  onChange={() => toggleItem(c.id, it.id)}
                                  className="h-4 w-4 rounded border-border text-brand focus:ring-brand/30"
                                />
                                {it.code ? <span className="font-mono text-[11px] text-muted">{it.code}</span> : null}
                                <span className="truncate text-fg">{it.task || "(unnamed line)"}</span>
                              </li>
                            ))}
                            {c.items.length === 0 ? <li className="py-1 pl-6 text-xs text-faint">No lines.</li> : null}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <span className="text-xs text-muted">{selectedCount} section(s) selected</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-fg hover:bg-surface-2">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={doCopy}
                  disabled={selectedCount === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-50"
                >
                  <Copy className="h-4 w-4" /> Copy {selectedCount || ""}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
