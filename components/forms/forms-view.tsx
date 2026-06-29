"use client";

import { useMemo, useState } from "react";
import { Search, Eye, Download, ClipboardCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocumentPreview, type PreviewDoc } from "@/components/preview/document-preview";
import { EmailButton } from "@/components/email/email-button";
import { FORM_CATEGORIES, type FormItem, type FormCategory } from "@/lib/data/forms";
import { formatDate } from "@/lib/format";

const CAT_TONE: Record<FormCategory, "blue" | "violet" | "amber" | "red"> = {
  "Site Administration": "blue",
  Quality: "violet",
  Commercial: "amber",
  Safety: "red",
};

function toPreview(f: FormItem): PreviewDoc {
  return {
    name: `${f.code} — ${f.name}`,
    fileType: f.fileType,
    pages: 1,
    meta: [
      { label: "Category", value: f.category },
      { label: "Revision", value: f.revision },
      { label: "Fields", value: String(f.fields) },
      { label: "Updated", value: formatDate(f.updatedAt) },
    ],
  };
}

export function FormsView({ forms }: { forms: FormItem[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"ALL" | FormCategory>("ALL");
  const [preview, setPreview] = useState<PreviewDoc | null>(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return forms.filter((f) => {
      if (cat !== "ALL" && f.category !== cat) return false;
      if (!term) return true;
      return f.name.toLowerCase().includes(term) || f.code.toLowerCase().includes(term) || f.description.toLowerCase().includes(term);
    });
  }, [forms, q, cat]);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-2/50 px-4 py-3">
        <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg">
          <ClipboardCheck className="h-4 w-4 text-brand" /> Forms
          <span className="text-xs font-normal text-faint">· {forms.length} templates</span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {(["ALL", ...FORM_CATEGORIES] as const).map((c) => (
            <button key={c} type="button" onClick={() => setCat(c)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${cat === c ? "bg-slate-800 text-white" : "border border-border bg-surface text-muted hover:text-fg"}`}>
              {c === "ALL" ? "All" : c}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search forms…" className="h-8 w-56 rounded-lg border border-border bg-surface pl-8 pr-3 text-xs text-fg outline-none focus:ring-1 focus:ring-brand/30" />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-slate-200">
              <th className="border-b border-slate-700 bg-slate-800 px-3 py-1.5 text-left text-slate-100">Code</th>
              <th className="border-b border-slate-700 bg-slate-800 px-3 py-1.5 text-left text-slate-100">Form</th>
              <th className="border-b border-slate-700 bg-slate-800 px-3 py-1.5 text-left text-slate-100">Category</th>
              <th className="border-b border-slate-700 bg-slate-800 px-3 py-1.5 text-center text-slate-100">Rev</th>
              <th className="border-b border-slate-700 bg-slate-800 px-3 py-1.5 text-center text-slate-100">Type</th>
              <th className="border-b border-slate-700 bg-slate-800 px-3 py-1.5 text-center text-slate-100">Updated</th>
              <th className="border-b border-slate-700 bg-slate-800 px-3 py-1.5 text-right text-slate-100">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => (
              <tr key={f.id} className="border-b border-border/70 odd:bg-surface even:bg-surface-2 hover:bg-brand/5">
                <td className="px-3 py-2 font-mono text-[11px] text-muted">{f.code}</td>
                <td className="px-3 py-2">
                  <div className="text-xs font-medium text-fg">{f.name}</div>
                  <div className="text-[11px] text-faint">{f.description}</div>
                </td>
                <td className="px-3 py-2"><Badge tone={CAT_TONE[f.category]}>{f.category}</Badge></td>
                <td className="px-3 py-2 text-center text-[11px] text-muted">{f.revision}</td>
                <td className="px-3 py-2 text-center text-[11px] font-medium text-muted">{f.fileType}</td>
                <td className="px-3 py-2 text-center text-[11px] tabular-nums text-muted">{formatDate(f.updatedAt)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <button type="button" onClick={() => setPreview(toPreview(f))} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-muted hover:text-fg">
                      <Eye className="h-3.5 w-3.5" /> Preview
                    </button>
                    <EmailButton variant="icon" subject={`${f.code} — ${f.name}`} attachment={`${f.code} ${f.name}.${f.fileType.toLowerCase()}`} />
                    <button type="button" aria-label="Download" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:text-fg">
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-muted">No forms match your search.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <DocumentPreview doc={preview} onClose={() => setPreview(null)} />
    </Card>
  );
}
