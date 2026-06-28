"use client";

import { useState } from "react";
import { Plus, Trash2, FileText, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SaveControl } from "@/components/development/save-control";
import { Badge } from "@/components/ui/badge";
import { DEV_DOCUMENT_KIND_LABEL, type DevDocument, type DevDocumentKind } from "@/lib/data/development.types";
import { formatDate } from "@/lib/format";
import { uid } from "@/components/projects/dashboard/hooks";

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

export function DocumentsView({ projectId, documents }: { projectId: string; documents: DevDocument[] }) {
  const [docs, setDocs] = useState<DevDocument[]>(documents);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<DevDocumentKind>("OTHER");
  const [url, setUrl] = useState("");

  const add = () => {
    if (!name.trim()) return;
    setDocs((p) => [
      { id: uid("doc"), projectId, kind, name: name.trim(), url: url.trim() || null, uploadedAt: new Date().toISOString().slice(0, 10) },
      ...p,
    ]);
    setName(""); setUrl(""); setKind("OTHER");
  };
  const remove = (id: string) => setDocs((p) => p.filter((d) => d.id !== id));

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted">Document name</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="e.g. DOW approval letter.pdf" />
          </div>
          <div className="w-full sm:w-48">
            <label className="mb-1 block text-xs font-medium text-muted">Type</label>
            <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as DevDocumentKind)}>
              {(Object.keys(DEV_DOCUMENT_KIND_LABEL) as DevDocumentKind[]).map((k) => <option key={k} value={k}>{DEV_DOCUMENT_KIND_LABEL[k]}</option>)}
            </select>
          </div>
          <div className="w-full sm:w-56">
            <label className="mb-1 block text-xs font-medium text-muted">Link (optional)</label>
            <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </div>
          <button type="button" onClick={add} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-2"><Plus className="h-4 w-4" /> Add</button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-fg">Project documents</h3>
          <SaveControl url={`/api/development/${projectId}/documents`} build={() => ({ documents: docs })} label="Save documents" />
        </div>
        <ul className="divide-y divide-border">
          {docs.map((d) => (
            <li key={d.id} className="group flex items-center gap-3 px-4 py-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-faint"><FileText className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-fg">{d.name}</span>
                  <Badge tone="slate">{DEV_DOCUMENT_KIND_LABEL[d.kind]}</Badge>
                </div>
                <div className="text-[11px] text-faint">Uploaded {formatDate(d.uploadedAt)}</div>
              </div>
              {d.url ? (
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Open</a>
              ) : <span className="text-[11px] text-faint">No link</span>}
              <button type="button" onClick={() => remove(d.id)} className="text-faint opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100" aria-label="Remove document"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
          {docs.length === 0 ? <li className="px-4 py-12 text-center text-sm text-muted">No documents yet — add deeds, surveys, plans, approvals, contracts and receipts above.</li> : null}
        </ul>
      </Card>
      <p className="px-1 text-[11px] text-faint">Links open in a new tab. Use “Save documents” to persist. File upload to storage is a later enhancement.</p>
    </div>
  );
}
