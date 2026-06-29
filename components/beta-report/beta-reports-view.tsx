"use client";

import { useMemo, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Bug,
  Lightbulb,
  Image as ImageIcon,
  ExternalLink,
  Search,
  X,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  setBetaReportStatus,
  loadBetaReportScreenshot,
} from "@/app/(app)/beta-reports/actions";
import {
  BETA_REPORT_STATUSES,
  KIND_LABEL,
  STATUS_LABEL,
  type BetaReportKind,
  type BetaReportListItem,
  type BetaReportStatus,
} from "@/lib/data/beta-reports.types";

type KindFilter = "ALL" | BetaReportKind;
type StatusFilter = "ALL" | BetaReportStatus;

const STATUS_TONE: Record<BetaReportStatus, Parameters<typeof Badge>[0]["tone"]> = {
  NEW: "blue",
  IN_REVIEW: "amber",
  PLANNED: "violet",
  RESOLVED: "green",
  CLOSED: "slate",
};

export function BetaReportsView({ reports }: { reports: BetaReportListItem[] }) {
  const [kindFilter, setKindFilter] = useState<KindFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");
  const [lightbox, setLightbox] = useState<{ id: string; src: string | null } | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((r) => {
      if (kindFilter !== "ALL" && r.kind !== kindFilter) return false;
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        (r.reporterName ?? "").toLowerCase().includes(q) ||
        (r.reporterEmail ?? "").toLowerCase().includes(q)
      );
    });
  }, [reports, kindFilter, statusFilter, query]);

  function onStatusChange(id: string, status: BetaReportStatus) {
    startTransition(async () => {
      await setBetaReportStatus(id, status);
    });
  }

  async function openScreenshot(id: string) {
    setLightbox({ id, src: null });
    const src = await loadBetaReportScreenshot(id);
    setLightbox({ id, src });
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <SegGroup
          value={kindFilter}
          onChange={(v) => setKindFilter(v as KindFilter)}
          options={[
            { value: "ALL", label: "All" },
            { value: "BUG", label: "Bugs" },
            { value: "WISH", label: "Wishes" },
          ]}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        >
          <option value="ALL">All statuses</option>
          {BETA_REPORT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reports…"
            className="h-9 w-56 rounded-lg border border-border bg-surface pl-8 pr-3 text-sm text-fg outline-none placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-border bg-surface py-16 text-center">
          <p className="text-sm font-medium text-fg">No reports here yet</p>
          <p className="mt-1 text-xs text-muted">
            Beta testers can send Bug/Wish feedback from the “Feedback” button in any screen.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => (
            <li
              key={r.id}
              className="rounded-[var(--radius-card)] border border-border bg-surface p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                    r.kind === "BUG"
                      ? "bg-red-50 text-red-600 ring-red-200"
                      : "bg-violet-50 text-violet-600 ring-violet-200",
                  )}
                  title={KIND_LABEL[r.kind]}
                >
                  {r.kind === "BUG" ? (
                    <Bug className="h-4 w-4" />
                  ) : (
                    <Lightbulb className="h-4 w-4" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-fg">{r.title}</h3>
                    <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{r.description}</p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-faint">
                    <span>
                      {r.reporterName ?? "Anonymous"}
                      {r.reporterEmail ? ` · ${r.reporterEmail}` : ""}
                    </span>
                    <span aria-hidden>•</span>
                    <span title={new Date(r.createdAt).toLocaleString()}>
                      {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                    </span>
                    {r.pageUrl ? (
                      <>
                        <span aria-hidden>•</span>
                        <a
                          href={r.pageUrl}
                          className="inline-flex items-center gap-1 text-muted hover:text-brand"
                          title={r.pageUrl}
                        >
                          <ExternalLink className="h-3 w-3" />
                          {prettyPath(r.pageUrl)}
                        </a>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <select
                    value={r.status}
                    disabled={pending}
                    onChange={(e) => onStatusChange(r.id, e.target.value as BetaReportStatus)}
                    className="h-8 rounded-lg border border-border bg-surface px-2 text-xs text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
                  >
                    {BETA_REPORT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  {r.hasScreenshot ? (
                    <button
                      type="button"
                      onClick={() => openScreenshot(r.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      Screenshot
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Screenshot lightbox */}
      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-md bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setLightbox(null)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          {lightbox.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lightbox.src}
              alt="Report screenshot"
              className="max-h-[88vh] max-w-[92vw] rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          )}
        </div>
      ) : null}
    </div>
  );
}

function SegGroup({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === o.value
              ? "bg-brand text-white"
              : "text-muted hover:bg-surface-2 hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Show just the path (+search) of a same-origin URL; fall back to the raw string. */
function prettyPath(url: string): string {
  try {
    const u = new URL(url);
    return (u.pathname + u.search) || "/";
  } catch {
    return url;
  }
}
