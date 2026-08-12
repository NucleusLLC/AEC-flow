"use client";

import { useMemo, useState } from "react";
import { Search, Download, FileStack, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DrawingStatusBadge, FileTypeChip } from "@/components/drawings/badges";
import { DocumentPreview, type PreviewDoc } from "@/components/preview/document-preview";
import { EmailButton } from "@/components/email/email-button";
import {
  DISCIPLINE_LABEL,
  DRAWING_STATUS_LABEL,
  type Drawing,
  type Discipline,
  type DrawingStatus,
} from "@/lib/data/drawings.types";
import { drawingFileUrlAction } from "@/app/(app)/drawings/actions";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function formatSize(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

function toPreview(d: Drawing): PreviewDoc {
  return {
    name: `${d.code} — ${d.title}`,
    fileType: d.fileType,
    sizeLabel: formatSize(d.sizeKb),
    meta: [
      { label: "Project", value: d.projectNumber },
      { label: "Discipline", value: DISCIPLINE_LABEL[d.discipline] },
      { label: "Rev", value: d.revision },
      { label: "Status", value: DRAWING_STATUS_LABEL[d.status] },
    ],
  };
}

const STATUS_FILTERS: Array<{ key: "ALL" | DrawingStatus; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "FOR_REVIEW", label: "For review" },
  { key: "APPROVED", label: "Approved" },
  { key: "ISSUED", label: "Issued" },
  { key: "DRAFT", label: "Draft" },
  { key: "SUPERSEDED", label: "Superseded" },
];

export function DrawingsView({ drawings }: { drawings: Drawing[] }) {
  const projects = useMemo(
    () =>
      Array.from(new Map(drawings.map((d) => [d.projectId, d.projectNumber + " — " + d.projectName])).entries()),
    [drawings],
  );

  const [query, setQuery] = useState("");
  const [project, setProject] = useState<"ALL" | string>("ALL");
  const [discipline, setDiscipline] = useState<"ALL" | Discipline>("ALL");
  const [status, setStatus] = useState<"ALL" | DrawingStatus>("ALL");
  const [preview, setPreview] = useState<PreviewDoc | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  /**
   * Downloads go through a signed URL minted on demand: the bucket is private,
   * so there is no durable link to put in an `href`, and a link that outlived
   * the click would be a copy of the file handed out with no further checks.
   */
  async function download(id: string) {
    setDownloading(id);
    setDownloadError(null);
    try {
      const result = await drawingFileUrlAction(id);
      if (!result.ok) {
        setDownloadError(result.error);
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloading(null);
    }
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drawings.filter((d) => {
      if (project !== "ALL" && d.projectId !== project) return false;
      if (discipline !== "ALL" && d.discipline !== discipline) return false;
      if (status !== "ALL" && d.status !== status) return false;
      if (!q) return true;
      return [d.code, d.title, d.projectName, d.uploadedBy].join(" ").toLowerCase().includes(q);
    });
  }, [drawings, query, project, discipline, status]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatus(f.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors",
                status === f.key
                  ? "bg-brand text-brand-fg ring-brand"
                  : "bg-surface text-muted ring-border hover:text-fg",
              )}
            >
              {f.label}
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
              placeholder="Search drawings…"
              className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 sm:w-56"
            />
          </div>
          <select
            value={project}
            onChange={(e) => setProject(e.target.value)}
            className="h-9 max-w-[220px] rounded-lg border border-border bg-surface px-2.5 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          >
            <option value="ALL">All projects</option>
            {projects.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value as "ALL" | Discipline)}
            className="h-9 rounded-lg border border-border bg-surface px-2.5 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          >
            <option value="ALL">All disciplines</option>
            {(Object.keys(DISCIPLINE_LABEL) as Discipline[]).map((d) => (
              <option key={d} value={d}>
                {DISCIPLINE_LABEL[d]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-5 py-2.5 font-medium">Drawing</th>
                <th className="px-3 py-2.5 font-medium">Project</th>
                <th className="px-3 py-2.5 font-medium">Discipline</th>
                <th className="px-3 py-2.5 font-medium text-center">Rev</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">File</th>
                <th className="px-3 py-2.5 font-medium">Updated</th>
                <th className="px-5 py-2.5 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((d) => (
                <tr key={d.id} className="hover:bg-surface-2">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                        <FileStack className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-faint">{d.code}</span>
                          <span className="truncate font-medium text-fg">{d.title}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-mono text-[11px] text-muted">{d.projectNumber}</span>
                  </td>
                  <td className="px-3 py-3 text-muted">{DISCIPLINE_LABEL[d.discipline]}</td>
                  <td className="px-3 py-3 text-center">
                    <Badge tone="neutral">Rev {d.revision}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <DrawingStatusBadge status={d.status} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <FileTypeChip type={d.fileType} />
                      <span className="text-xs text-faint">{formatSize(d.sizeKb)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-muted">{formatDate(d.uploadedAt)}</div>
                    <div className="text-[11px] text-faint">{d.uploadedBy}</div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setPreview(toPreview(d))}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-fg transition-colors hover:bg-surface-2"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Preview
                      </button>
                      <EmailButton variant="icon" subject={`${d.code} ${d.title} — ${d.projectNumber}`} attachment={`${d.code} ${d.title}.${d.fileType.toLowerCase()}`} />
                      <button
                        type="button"
                        aria-label={`Download ${d.code}`}
                        title={d.hasFile ? "Download" : "No file stored for this sheet"}
                        disabled={!d.hasFile || downloading === d.id}
                        onClick={() => download(d.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-faint">
              <FileStack className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-fg">No drawings match your filters</p>
            <p className="text-xs text-muted">Try a different project, discipline, or search term.</p>
          </div>
        ) : null}
      </Card>

      {downloadError ? (
        <p role="alert" className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
          {downloadError}
        </p>
      ) : null}

      <p className="px-1 text-xs text-faint">
        Showing {rows.length} of {drawings.length} drawings
      </p>

      <DocumentPreview doc={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
