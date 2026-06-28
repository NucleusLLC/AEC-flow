"use client";

import { useState } from "react";
import {
  Plus,
  RotateCcw,
  StickyNote,
  ListChecks,
  CalendarDays,
  BellRing,
  Clock,
  Globe,
  Activity,
  Gauge,
  Link2,
  Bookmark,
  Contact,
  Wallet,
} from "lucide-react";
import { useSharedState, uid } from "@/components/projects/dashboard/hooks";
import { renderWidget } from "@/components/projects/dashboard/widgets";
import {
  WIDGET_CATALOG,
  defaultWidgets,
  type WidgetInstance,
  type WidgetType,
  type ProjectSummary,
} from "@/lib/dashboard";

const ICONS: Record<WidgetType, React.ComponentType<{ className?: string }>> = {
  notes: StickyNote,
  tasks: ListChecks,
  agenda: CalendarDays,
  reminders: BellRing,
  clock: Clock,
  worldclock: Globe,
  progress: Activity,
  stats: Gauge,
  links: Link2,
  bookmarks: Bookmark,
  contacts: Contact,
  budget: Wallet,
};

export function ProjectDashboard({ project }: { project: ProjectSummary }) {
  const [widgets, setWidgets] = useSharedState<WidgetInstance[]>(
    `aec.proj.${project.id}.layout`,
    defaultWidgets(),
  );
  const [adding, setAdding] = useState(false);
  // Drag-and-drop reorder state. `grabId` arms a card for dragging (set when the
  // drag handle is pressed) so text/inputs in the card stay interactive; `dragId`
  // is the card in flight; `overId` is the current drop target (for the indicator).
  const [grabId, setGrabId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const move = (index: number, dir: -1 | 1) =>
    setWidgets((list) => {
      const next = [...list];
      const target = index + dir;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  /** Move `fromId` so it sits where `toId` currently is. */
  const reorder = (fromId: string, toId: string) =>
    setWidgets((list) => {
      if (fromId === toId) return list;
      const from = list.findIndex((w) => w.id === fromId);
      const to = list.findIndex((w) => w.id === toId);
      if (from < 0 || to < 0) return list;
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });

  const remove = (id: string) => setWidgets((list) => list.filter((w) => w.id !== id));
  const add = (type: WidgetType) => {
    setWidgets((list) => [...list, { id: uid(type), type }]);
    setAdding(false);
  };
  const setConfig = (id: string, config: Record<string, unknown>) =>
    setWidgets((list) => list.map((w) => (w.id === id ? { ...w, config } : w)));
  const rename = (id: string, title: string) =>
    setWidgets((list) => list.map((w) => (w.id === id ? { ...w, title: title || undefined } : w)));

  const endDrag = () => {
    setGrabId(null);
    setDragId(null);
    setOverId(null);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          Your board — add, rename, drag to reorder and configure widgets. Changes are saved on this device.
        </p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
            >
              <Plus className="h-4 w-4" />
              Add widget
            </button>
            {adding ? (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAdding(false)} aria-hidden />
                <div className="absolute right-0 z-50 mt-2 max-h-[70vh] w-72 overflow-auto rounded-xl border border-border bg-surface py-1 shadow-lg">
                  {WIDGET_CATALOG.map((w) => {
                    const Icon = ICONS[w.type];
                    return (
                      <button
                        key={w.type}
                        type="button"
                        onClick={() => add(w.type)}
                        className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-surface-2"
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-fg">{w.name}</span>
                          <span className="block text-xs text-muted">{w.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setWidgets(defaultWidgets())}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
            title="Reset to the default layout"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </div>

      {/* Masonry widget board */}
      {widgets.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted">No widgets. Use “Add widget” to build your board.</p>
        </div>
      ) : (
        <div className="columns-1 gap-4 md:columns-2 xl:columns-3">
          {widgets.map((instance, i) => (
            <div
              key={instance.id}
              draggable={grabId === instance.id}
              onDragStart={(e) => {
                setDragId(instance.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={endDrag}
              onDragOver={(e) => {
                if (dragId && dragId !== instance.id) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (overId !== instance.id) setOverId(instance.id);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId) reorder(dragId, instance.id);
                endDrag();
              }}
              className={[
                "break-inside-avoid transition-opacity",
                dragId === instance.id ? "opacity-40" : "",
                overId === instance.id && dragId !== instance.id ? "rounded-[var(--radius-card)] ring-2 ring-brand/60" : "",
              ].join(" ")}
            >
              {renderWidget({
                projectId: project.id,
                instance,
                project,
                controls: {
                  onMoveUp: i > 0 ? () => move(i, -1) : undefined,
                  onMoveDown: i < widgets.length - 1 ? () => move(i, 1) : undefined,
                  onRemove: () => remove(instance.id),
                  onRename: (title) => rename(instance.id, title),
                  onDragHandleDown: () => setGrabId(instance.id),
                },
                onConfigChange: (config) => setConfig(instance.id, config),
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
