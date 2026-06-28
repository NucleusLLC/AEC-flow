"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronUp, ChevronDown, X, Settings2, GripVertical, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";

export function WidgetFrame({
  title,
  icon,
  onMoveUp,
  onMoveDown,
  onRemove,
  onRename,
  onDragHandleDown,
  settings,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
  /** Rename the widget. Pass an empty string to reset to the default title. */
  onRename?: (title: string) => void;
  /** Press the drag handle to enable dragging the card (see project-dashboard). */
  onDragHandleDown?: () => void;
  /** Optional config panel; a gear button toggles it when provided. */
  settings?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  // DOM-only effect: focus/select once the rename input mounts.
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEdit = () => {
    setDraft(title);
    setEditing(true);
  };
  const commit = () => {
    onRename?.(draft.trim());
    setEditing(false);
  };

  return (
    <Card className="group mb-4 break-inside-avoid">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {onDragHandleDown ? (
            <button
              type="button"
              onMouseDown={onDragHandleDown}
              onTouchStart={onDragHandleDown}
              className="-ml-1 cursor-grab rounded p-0.5 text-faint opacity-0 transition-opacity hover:text-fg group-hover:opacity-100 active:cursor-grabbing"
              aria-label="Drag to reorder"
              title="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          ) : null}
          <span className="text-faint">{icon}</span>
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") setEditing(false);
              }}
              placeholder={title}
              className="min-w-0 flex-1 rounded border border-brand bg-surface px-1.5 py-0.5 text-sm font-semibold text-fg focus:outline-none focus:ring-2 focus:ring-brand/15"
            />
          ) : (
            <h3
              className="truncate text-sm font-semibold text-fg"
              onDoubleClick={onRename ? startEdit : undefined}
              title={onRename ? "Double-click to rename" : undefined}
            >
              {title}
            </h3>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {onRename && !editing ? (
            <button type="button" onClick={startEdit} className="rounded p-1 text-faint hover:bg-surface-2 hover:text-fg" aria-label="Rename widget" title="Rename">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {settings ? (
            <button type="button" onClick={() => setShowSettings((v) => !v)} className="rounded p-1 text-faint hover:bg-surface-2 hover:text-fg" aria-label="Configure widget" title="Configure">
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {onMoveUp ? (
            <button type="button" onClick={onMoveUp} className="rounded p-1 text-faint hover:bg-surface-2 hover:text-fg" aria-label="Move up" title="Move up">
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {onMoveDown ? (
            <button type="button" onClick={onMoveDown} className="rounded p-1 text-faint hover:bg-surface-2 hover:text-fg" aria-label="Move down" title="Move down">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          ) : null}
          {onRemove ? (
            <button type="button" onClick={onRemove} className="rounded p-1 text-faint hover:bg-surface-2 hover:text-red-600" aria-label="Remove widget" title="Remove">
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {showSettings && settings ? (
        <div className="border-b border-border bg-surface-2/50 px-4 py-3">{settings}</div>
      ) : null}

      <div className="px-4 py-3">{children}</div>
    </Card>
  );
}
