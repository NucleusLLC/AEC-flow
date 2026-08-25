"use client";

import { useMemo, useState } from "react";
import {
  Search,
  Eye,
  Download,
  FileText,
  Presentation,
  Sheet,
  PencilRuler,
  FileSignature,
  BarChart3,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocumentPreview, type PreviewDoc } from "@/components/preview/document-preview";
import { EmailButton } from "@/components/email/email-button";
import {
  DOC_KIND_LABEL,
  formatFileSize,
  type DocumentItem,
  type DocKind,
  type FileType,
} from "@/lib/data/documents";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const KIND_META: Record<DocKind, { icon: typeof FileText; color: string; bg: string }> = {
  DRAWING: { icon: PencilRuler, color: "#1d4ed8", bg: "#1d4ed814" },
  PRESENTATION: { icon: Presentation, color: "#c2683f", bg: "#c2683f14" },
  REPORT: { icon: BarChart3, color: "#7c3aed", bg: "#7c3aed14" },
  DOCUMENT: { icon: FileText, color: "#475569", bg: "#47556914" },
  CONTRACT: { icon: FileSignature, color: "#16a34a", bg: "#16a34a14" },
  SPREADSHEET: { icon: Sheet, color: "#0891b2", bg: "#0891b214" },
};

const FILE_COLOR: Record<FileType, string> = {
  PDF: "#b91c1c",
  DWG: "#1d4ed8",
  RVT: "#7c3aed",
  PPTX: "#c2683f",
  DOCX: "#1e40af",
  XLSX: "#15803d",
};

const KIND_FILTERS: Array<"ALL" | DocKind> = [
  "ALL",
  "DRAWING",
  "PRESENTATION",
  "REPORT",
  "DOCUMENT",
  "CONTRACT",
  "SPREADSHEET",
];

function toPreview(d: DocumentItem): PreviewDoc {
  return {
    name: d.name,
    fileType: d.fileType,
    sizeLabel: formatFileSize(d.sizeKb),
    meta: [
      { label: "Project", value: d.projectName ?? "Practice" },
      { label: "Owner", value: d.owner },
      { label: "Updated", value: formatDate(d.updatedAt) },
      { label: "Version", value: d.version },
    ],
  };
}

export function DocumentsView({ documents }: { documents: DocumentItem[] }) {
  const projects = useMemo(
    () =>
      Array.from(
        new Map(
          documents.filter((d) => d.projectId).map((d) => [d.projectId!, d.projectName!]),
        ).entries(),
      ),
    [documents],
  );

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"ALL" | DocKind>("ALL");
  const [project, setProject] = useState<"ALL" | string>("ALL");
  const [preview, setPreview] = useState<PreviewDoc | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((d) => {
      if (kind !== "ALL" && d.kind !== kind) return false;
      if (project !== "ALL" && d.projectId !== project) return false;
      if (!q) return true;
      return [d.name, d.projectName, d.owner].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [documents, query, kind, project]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {KIND_FILTERS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors",
                kind === k
                  ? "bg-brand text-brand-fg ring-brand"
                  : "bg-surface text-muted ring-border hover:text-fg",
              )}
            >
              {k === "ALL" ? "All" : DOC_KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
              placeholder="Search documents…"
              className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 sm:w-64"
            />
          </div>
          <select
            value={project}
            onChange={(e) => setProject(e.target.value)}
            className="h-9 max-w-[240px] rounded-lg border border-border bg-surface px-2.5 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          >
            <option value="ALL">All projects</option>
            {projects.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      {rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-faint">
            <FileText className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-fg">No documents match your filters</p>
          <p className="text-xs text-muted">Try a different kind, project, or search term.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((d) => {
            const meta = KIND_META[d.kind];
            const Icon = meta.icon;
            return (
              <Card key={d.id} className="group flex flex-col p-4 transition-colors hover:border-brand/40">
                <button
                  type="button"
                  onClick={() => setPreview(toPreview(d))}
                  className="flex items-start gap-3 text-left"
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: meta.bg, color: meta.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-medium text-fg group-hover:text-brand">
                      {d.name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted">
                      {d.projectName ?? "Practice"}
                    </span>
                  </span>
                </button>

                <div className="mt-3 flex items-center gap-2 text-xs text-faint">
                  <Badge tone="neutral">{DOC_KIND_LABEL[d.kind]}</Badge>
                  <span
                    className="rounded px-1.5 py-0.5 font-mono text-[10px] font-bold text-white"
                    style={{ background: FILE_COLOR[d.fileType] }}
                  >
                    {d.fileType}
                  </span>
                  <span className="ml-auto">{formatFileSize(d.sizeKb)}</span>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <span className="truncate text-[11px] text-faint">
                    {d.owner} · {formatDate(d.updatedAt)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPreview(toPreview(d))}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-fg transition-colors hover:bg-surface-2"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </button>
                    <EmailButton variant="icon" subject={d.name} attachment={`${d.name}.${d.fileType.toLowerCase()}`} relatedType="document" relatedId={d.id} />
                    <button
                      type="button"
                      aria-label="Download"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:text-fg"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="px-1 text-xs text-faint">
        Showing {rows.length} of {documents.length} documents
      </p>

      <DocumentPreview doc={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
