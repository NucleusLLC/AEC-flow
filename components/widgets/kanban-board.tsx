"use client";

import { useEffect, useRef, useState } from "react";
import { KanbanSquare, Plus, X } from "lucide-react";

const KEY = "aecflow:kanban";

type ColId = "todo" | "doing" | "done";
type Card = { id: string; text: string; col: ColId };

const COLUMNS: { id: ColId; label: string; accent: string }[] = [
  { id: "todo", label: "To Do", accent: "border-t-slate-400" },
  { id: "doing", label: "In Progress", accent: "border-t-amber-400" },
  { id: "done", label: "Done", accent: "border-t-emerald-400" },
];

let counter = 0;
const newId = () => `c${++counter}-${Math.floor(performance.now())}`;

/** A simple personal Kanban board (To Do / In Progress / Done) with drag-and-drop. */
export function KanbanBoard() {
  const [cards, setCards] = useState<Card[]>([]);
  const [drafts, setDrafts] = useState<Record<ColId, string>>({ todo: "", doing: "", done: "" });
  const [dragId, setDragId] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const arr = JSON.parse(raw) as Card[];
        // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-safe hydrate after mount
        if (Array.isArray(arr)) setCards(arr);
      }
    } catch {
      /* ignore */
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(cards));
    } catch {
      /* ignore */
    }
  }, [cards]);

  const addCard = (col: ColId) => {
    const text = drafts[col].trim();
    if (!text) return;
    setCards((c) => [...c, { id: newId(), text, col }]);
    setDrafts((d) => ({ ...d, [col]: "" }));
  };
  const removeCard = (id: string) => setCards((c) => c.filter((x) => x.id !== id));
  const moveCard = (id: string, col: ColId) =>
    setCards((c) => c.map((x) => (x.id === id ? { ...x, col } : x)));

  return (
    // Card's exact class string plus the hook, rather than the shared <Card>:
    // this file already owns a local `type Card` for the board's data, and
    // aliasing the import to dodge that collision is more noise than one class.
    // The columns inside keep their own opaque plate — a coloured status edge
    // that the glass hairline would erase, and a second blur if it were glass.
    <div className="card-surface rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
        <KanbanSquare className="h-4 w-4 text-brand" /> Kanban Board
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {COLUMNS.map((col) => {
          const colCards = cards.filter((c) => c.col === col.id);
          return (
            <div
              key={col.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId) moveCard(dragId, col.id);
                setDragId(null);
              }}
              className={`flex min-h-[140px] flex-col rounded-lg border border-t-2 border-border bg-surface-2/40 p-2 ${col.accent}`}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-fg">{col.label}</span>
                <span className="rounded-full bg-surface px-1.5 text-[10px] text-muted ring-1 ring-border">{colCards.length}</span>
              </div>

              <div className="flex-1 space-y-1.5">
                {colCards.map((card) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={() => setDragId(card.id)}
                    onDragEnd={() => setDragId(null)}
                    className="group flex cursor-grab items-start justify-between gap-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-fg shadow-sm active:cursor-grabbing"
                  >
                    <span className="whitespace-pre-wrap break-words">{card.text}</span>
                    <button
                      type="button"
                      onClick={() => removeCard(card.id)}
                      className="shrink-0 rounded p-0.5 text-faint opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                      aria-label="Delete card"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex items-center gap-1">
                <input
                  value={drafts[col.id]}
                  onChange={(e) => setDrafts((d) => ({ ...d, [col.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") addCard(col.id); }}
                  placeholder="Add a card…"
                  className="h-7 w-full rounded-md border border-border bg-surface px-2 text-xs text-fg outline-none placeholder:text-faint focus:ring-1 focus:ring-brand/30"
                />
                <button
                  type="button"
                  onClick={() => addCard(col.id)}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand text-white hover:bg-brand/90"
                  aria-label="Add card"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-faint">Drag cards between columns. Saved in this browser.</p>
    </div>
  );
}
