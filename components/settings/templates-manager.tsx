"use client";

import { useState, useTransition } from "react";
import {
  FileText, Plus, Copy, Pencil, Star, Eye, Trash2, Check, AlertTriangle, Loader2, X, Lock,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocumentPreview, type PreviewDoc } from "@/components/preview/document-preview";
import {
  createTemplateAction, updateTemplateAction, duplicateTemplateAction,
  deleteTemplateAction, setDefaultTemplateAction,
} from "@/app/(app)/settings/actions";
import { formatDate } from "@/lib/format";
import type { ProposalTemplate } from "@/lib/data/settings";

const inputCls =
  "mt-1 h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

type Editing = { mode: "new" } | { mode: "edit"; tpl: ProposalTemplate } | null;

export function TemplatesManager({
  templates: initial,
  canSave,
}: {
  templates: ProposalTemplate[];
  canSave: boolean;
}) {
  const [templates, setTemplates] = useState<ProposalTemplate[]>(initial);
  const [preview, setPreview] = useState<PreviewDoc | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sortList = (list: ProposalTemplate[]) =>
    [...list].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));

  const previewDoc = (tpl: ProposalTemplate): PreviewDoc => ({
    name: tpl.name,
    fileType: "PDF",
    pages: tpl.sections,
    meta: [
      { label: "Discipline", value: tpl.discipline },
      { label: "Sections", value: String(tpl.sections) },
      { label: "Default", value: tpl.isDefault ? "Yes" : "No" },
      { label: "Updated", value: formatDate(tpl.updatedAt) },
    ],
  });

  function duplicate(id: string) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const res = await duplicateTemplateAction(id);
      setBusyId(null);
      if (res.ok) setTemplates((l) => sortList([...l, res.data]));
      else setError(res.error);
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this template? This can't be undone.")) return;
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteTemplateAction(id);
      setBusyId(null);
      if (res.ok) setTemplates((l) => l.filter((t) => t.id !== id));
      else setError(res.error);
    });
  }

  function makeDefault(id: string) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const res = await setDefaultTemplateAction(id);
      setBusyId(null);
      if (res.ok) setTemplates((l) => sortList(l.map((t) => ({ ...t, isDefault: t.id === id }))));
      else setError(res.error);
    });
  }

  function onSaved(tpl: ProposalTemplate, mode: "new" | "edit") {
    setTemplates((l) => sortList(mode === "new" ? [...l, tpl] : l.map((t) => (t.id === tpl.id ? { ...t, ...tpl } : t))));
    setEditing(null);
  }

  return (
    <Card>
      <CardHeader
        title="Proposal Templates"
        subtitle={`${templates.length} ${templates.length === 1 ? "template" : "templates"}`}
        action={
          <button
            type="button"
            onClick={() => { setError(null); setEditing({ mode: "new" }); }}
            disabled={!canSave}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-2.5 text-xs font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" /> New template
          </button>
        }
      />

      {!canSave ? (
        <div className="mx-5 mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <Lock className="h-3.5 w-3.5 shrink-0" /> Sign in to manage templates.
        </div>
      ) : null}
      {error ? (
        <div className="mx-5 mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      ) : null}

      <div className="divide-y divide-border">
        {templates.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">No templates yet. Create your first one.</p>
        ) : null}
        {templates.map((tpl) => {
          const busy = pending && busyId === tpl.id;
          return (
            <div key={tpl.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-fg">{tpl.name}</span>
                  {tpl.isDefault ? <Badge tone="green"><Star className="h-3 w-3" /> default</Badge> : null}
                </div>
                <div className="text-xs text-muted">
                  {tpl.discipline} · {tpl.sections} sections · updated {formatDate(tpl.updatedAt)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!tpl.isDefault && canSave ? (
                  <button
                    type="button"
                    onClick={() => makeDefault(tpl.id)}
                    disabled={pending}
                    title="Set as default"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-muted transition-colors hover:text-fg disabled:opacity-60"
                  >
                    <Star className="h-3.5 w-3.5" /> Default
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setPreview(previewDoc(tpl))}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-muted transition-colors hover:text-fg"
                >
                  <Eye className="h-3.5 w-3.5" /> Preview
                </button>
                <button
                  type="button"
                  onClick={() => duplicate(tpl.id)}
                  disabled={!canSave || pending}
                  aria-label="Duplicate"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:text-fg disabled:opacity-60"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => { setError(null); setEditing({ mode: "edit", tpl }); }}
                  disabled={!canSave}
                  aria-label="Edit"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:text-fg disabled:opacity-60"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(tpl.id)}
                  disabled={!canSave || pending}
                  aria-label="Delete"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <DocumentPreview doc={preview} onClose={() => setPreview(null)} />
      {editing ? (
        <TemplateEditor
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      ) : null}
    </Card>
  );
}

function TemplateEditor({
  editing,
  onClose,
  onSaved,
}: {
  editing: { mode: "new" } | { mode: "edit"; tpl: ProposalTemplate };
  onClose: () => void;
  onSaved: (tpl: ProposalTemplate, mode: "new" | "edit") => void;
}) {
  const existing = editing.mode === "edit" ? editing.tpl : null;
  const [name, setName] = useState(existing?.name ?? "");
  const [discipline, setDiscipline] = useState(existing?.discipline ?? "Architecture");
  const [sections, setSections] = useState(existing?.sections ?? 6);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!name.trim()) { setError("A template name is required."); return; }
    setError(null);
    const input = { name, discipline, sections };
    startTransition(async () => {
      const res = existing
        ? await updateTemplateAction(existing.id, input)
        : await createTemplateAction(input);
      if (res.ok) onSaved(res.data, existing ? "edit" : "new");
      else setError(res.error);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="text-sm font-semibold text-fg">{existing ? "Edit template" : "New template"}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-fg">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <label className="block">
            <span className="text-xs font-medium text-muted">Template name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Architecture — Full Services" className={inputCls} />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-muted">Discipline</span>
              <input value={discipline} onChange={(e) => setDiscipline(e.target.value)} placeholder="Architecture" className={inputCls} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted">Sections</span>
              <input type="number" min={1} max={40} value={sections} onChange={(e) => setSections(Number(e.target.value) || 1)} className={inputCls} />
            </label>
          </div>
          {error ? (
            <p className="flex items-center gap-1.5 text-sm text-red-600"><AlertTriangle className="h-4 w-4" /> {error}</p>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={pending} className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-60">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {existing ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
