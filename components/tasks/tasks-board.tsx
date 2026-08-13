"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2, CalendarClock, User, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n/language-provider";
import { saveTask, moveTask, removeTask } from "@/app/(app)/tasks/actions";
import {
  TASK_STATUS_LABEL,
  TASK_PRIORITIES,
  type TaskItem,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/data/tasks.types";

const COLUMNS: { id: TaskStatus; accent: string }[] = [
  { id: "TODO", accent: "border-t-slate-400" },
  { id: "IN_PROGRESS", accent: "border-t-amber-400" },
  { id: "DONE", accent: "border-t-emerald-400" },
];

const PRIORITY_TONE: Record<TaskPriority, Parameters<typeof Badge>[0]["tone"]> = {
  LOW: "slate", MEDIUM: "blue", HIGH: "amber", CRITICAL: "red",
};

function isOverdue(due: string | null): boolean {
  if (!due) return false;
  return new Date(due) < new Date(new Date().toDateString());
}

export function TasksBoard({ tasks }: { tasks: TaskItem[] }) {
  const router = useRouter();
  const tr = useT();
  const [pending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<TaskStatus, string>>({ TODO: "", IN_PROGRESS: "", DONE: "" });
  const [dragId, setDragId] = useState<string | null>(null);
  const [editing, setEditing] = useState<TaskItem | null>(null);

  const refresh = () => startTransition(() => router.refresh());

  const quickAdd = (status: TaskStatus) => {
    const title = drafts[status].trim();
    if (!title) return;
    setDrafts((d) => ({ ...d, [status]: "" }));
    startTransition(async () => {
      await saveTask("new", { title, status });
      router.refresh();
    });
  };

  const drop = (status: TaskStatus) => {
    const id = dragId;
    setDragId(null);
    if (!id) return;
    startTransition(async () => {
      await moveTask(id, status);
      router.refresh();
    });
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <div
              key={col.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => drop(col.id)}
              // Deliberately NOT `card-surface`: the glass treatment sets
              // `border-color` on all four sides from an unlayered rule, which
              // would erase `col.accent` — the coloured top edge is the status
              // code, not decoration. A 30% tint is a wash over the photo, not
              // an opaque slab, so leaving it out costs little.
              className={cn("flex min-h-[200px] flex-col rounded-[var(--radius-card)] border border-t-2 border-border bg-surface-2/30 p-3", col.accent)}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-sm font-semibold text-fg">{tr(TASK_STATUS_LABEL[col.id])}</span>
                <span className="rounded-full bg-surface px-1.5 text-[10px] text-muted ring-1 ring-border">{colTasks.length}</span>
              </div>

              <div className="flex-1 space-y-2">
                {colTasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    draggable
                    onDragStart={() => setDragId(t.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => setEditing(t)}
                    className="block w-full cursor-grab rounded-lg border border-border bg-surface p-2.5 text-left shadow-sm transition-colors hover:border-brand/40 active:cursor-grabbing"
                  >
                    <div className="text-sm font-medium text-fg">{t.title}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority.toLowerCase()}</Badge>
                      {t.dueDate ? (
                        <span className={cn("inline-flex items-center gap-1 text-[11px]", isOverdue(t.dueDate) && t.status !== "DONE" ? "text-red-600" : "text-muted")}>
                          <CalendarClock className="h-3 w-3" /> {t.dueDate}
                        </span>
                      ) : null}
                      {t.assignee ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                          <User className="h-3 w-3" /> {t.assignee}
                        </span>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-2 flex items-center gap-1">
                <input
                  value={drafts[col.id]}
                  onChange={(e) => setDrafts((d) => ({ ...d, [col.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") quickAdd(col.id); }}
                  placeholder={tr("Add a task…")}
                  className="h-8 w-full rounded-md border border-border bg-surface px-2 text-sm text-fg outline-none placeholder:text-faint focus:ring-1 focus:ring-brand/30"
                />
                <button type="button" onClick={() => quickAdd(col.id)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand text-white hover:bg-brand/90" aria-label="Add task">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {pending ? (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-fg/80 px-3 py-1 text-xs text-white">
          <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> {tr("Saving…")}
        </div>
      ) : null}

      {editing ? (
        <TaskEditor task={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); refresh(); }} />
      ) : null}
    </>
  );
}

function TaskEditor({ task, onClose, onDone }: { task: TaskItem; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [assignee, setAssignee] = useState(task.assignee ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tr = useT();

  const save = async () => {
    setBusy(true); setError(null);
    const res = await saveTask("edit", { id: task.id, title, notes, priority, status, dueDate: dueDate || null, assignee });
    if (res.ok) onDone(); else { setError(res.error); setBusy(false); }
  };
  const del = async () => {
    setBusy(true);
    await removeTask(task.id);
    onDone();
  };

  const field = "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none focus:ring-2 focus:ring-brand/20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-fg">{tr("Edit task")}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-faint hover:bg-surface-2 hover:text-fg"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr("Title")} className={field} />
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder={tr("Notes (optional)")} className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg outline-none focus:ring-2 focus:ring-brand/20" />
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1 block text-xs text-muted">{tr("Status")}</span>
              <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className={field}>
                {(["TODO", "IN_PROGRESS", "DONE"] as TaskStatus[]).map((s) => <option key={s} value={s}>{tr(TASK_STATUS_LABEL[s])}</option>)}
              </select>
            </label>
            <label className="block"><span className="mb-1 block text-xs text-muted">{tr("Priority")}</span>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className={field}>
                {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p.toLowerCase()}</option>)}
              </select>
            </label>
            <label className="block"><span className="mb-1 block text-xs text-muted">{tr("Due date")}</span>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={field} />
            </label>
            <label className="block"><span className="mb-1 block text-xs text-muted">{tr("Assignee")}</span>
              <input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Name" className={field} />
            </label>
          </div>
          {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <button type="button" onClick={del} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
            <Trash2 className="h-4 w-4" /> {tr("Delete")}
          </button>
          <button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {tr("Save")}
          </button>
        </div>
      </div>
    </div>
  );
}
