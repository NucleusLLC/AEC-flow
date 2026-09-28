"use client";

/**
 * The Building Permit register — filtering, sorting and banding on screen.
 *
 * Every decision about WHAT a filter means, HOW a column sorts and WHERE a band
 * starts lives in lib/building-permits/register.ts. This file only renders the
 * result, because the printed register calls the same functions and a printed
 * list that disagrees with the screen is worse than no printed list at all.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Inbox, Mail, Paperclip, Search, Users } from "lucide-react";
import { PermitListActions } from "@/components/building-permits/list-actions";
import {
  PermitStatusBadge,
  PermitTypeBadge,
  ResponseDueBadge,
} from "@/components/building-permits/badges";
import {
  bandPermits,
  filterPermits,
  isResponseOverdue,
  sortPermits,
  type BandBy,
  type PermitSort,
} from "@/lib/building-permits/register";
import {
  PERMIT_STATUSES,
  PERMIT_STATUS_LABEL,
  PERMIT_TYPES,
  PERMIT_TYPE_LABEL,
  type BuildingPermitStatus,
  type BuildingPermitSummaryDTO,
  type BuildingPermitType,
} from "@/lib/building-permits/types";
import { formatDate } from "@/lib/format";

const CONTROL =
  "h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

/**
 * Column widths, as percentages of the 1100px minimum.
 *
 * Each band is its own <table> (that is what lets a band be an elevated block
 * rather than a run of rows), so nothing makes their columns line up
 * automatically. `table-fixed` plus this one shared <colgroup> does — without
 * it, two bands whose longest title differs would be two differently ruled
 * tables stacked on top of each other.
 */
const COL_WIDTHS = ["12%", "19%", "9%", "13%", "9%", "10%", "10%", "10%", "8%"];

function Cols() {
  return (
    <colgroup>
      {COL_WIDTHS.map((w, i) => (
        <col key={i} style={{ width: w }} />
      ))}
    </colgroup>
  );
}

export function PermitRegister({
  permits,
  authorities,
  today,
}: {
  permits: BuildingPermitSummaryDTO[];
  authorities: string[];
  today: string;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<BuildingPermitStatus | "ALL" | "OPEN">("ALL");
  const [permitType, setPermitType] = useState<BuildingPermitType | "ALL">("ALL");
  const [authority, setAuthority] = useState("");
  const [band, setBand] = useState<BandBy>("status");
  const [sort, setSort] = useState<PermitSort>("reference");
  const [dir, setDir] = useState<"asc" | "desc">("asc");

  const bands = useMemo(
    () =>
      bandPermits(
        sortPermits(
          filterPermits(permits, {
            status,
            permitType,
            authority: authority || undefined,
            q,
          }),
          sort,
          dir,
        ),
        band,
        (s) => PERMIT_STATUS_LABEL[s],
      ),
    [permits, status, permitType, authority, q, sort, dir, band],
  );

  const shown = bands.reduce((n, b) => n + b.permits.length, 0);
  const overdueShown = useMemo(
    () =>
      bands.reduce(
        (n, b) => n + b.permits.filter((p) => isResponseOverdue(p, today)).length,
        0,
      ),
    [bands, today],
  );

  /**
   * The active filters as a query string, handed to the toolbar so what prints
   * or gets emailed is what is on screen. Keys match the print route's contract
   * exactly; a filter sitting at its neutral value is left out rather than
   * spelled "ALL", so the string stays readable in a URL bar.
   */
  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (status !== "ALL") p.set("status", status);
    if (permitType !== "ALL") p.set("type", permitType);
    if (authority) p.set("authority", authority);
    if (q.trim()) p.set("q", q.trim());
    p.set("band", band);
    p.set("sort", sort);
    p.set("dir", dir);
    return p.toString();
  }, [status, permitType, authority, q, band, sort, dir]);

  const toggleSort = (column: PermitSort) => {
    if (column === sort) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(column);
      setDir("asc");
    }
  };

  const clearFilters = () => {
    setQ("");
    setStatus("ALL");
    setPermitType("ALL");
    setAuthority("");
  };

  const sortProps = { sort, dir, onSort: toggleSort };

  return (
    <div className="space-y-4">
      {/* Controls are NOT a glass surface — see the "WHAT IS GLASS AND WHAT IS
       * NOT" note in app/globals.css: a toolbar of controls stays opaque. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search reference, permit number, address, parcel…"
            aria-label="Search permits"
            className={`${CONTROL} w-full pl-8 pr-3 placeholder:text-faint`}
          />
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as BuildingPermitStatus | "ALL" | "OPEN")}
          aria-label="Filter by status"
          className={CONTROL}
        >
          <option value="ALL">All</option>
          <option value="OPEN">Open</option>
          {PERMIT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PERMIT_STATUS_LABEL[s]}
            </option>
          ))}
        </select>

        <select
          value={permitType}
          onChange={(e) => setPermitType(e.target.value as BuildingPermitType | "ALL")}
          aria-label="Filter by permit type"
          className={CONTROL}
        >
          <option value="ALL">All types</option>
          {PERMIT_TYPES.map((t) => (
            <option key={t} value={t}>
              {PERMIT_TYPE_LABEL[t]}
            </option>
          ))}
        </select>

        <select
          value={authority}
          onChange={(e) => setAuthority(e.target.value)}
          aria-label="Filter by authority"
          className={CONTROL}
        >
          <option value="">All authorities</option>
          {authorities.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <select
          value={band}
          onChange={(e) => setBand(e.target.value as BandBy)}
          aria-label="Group by"
          className={CONTROL}
        >
          <option value="status">Group by status</option>
          <option value="authority">Group by authority</option>
          <option value="project">Group by project</option>
          <option value="none">No grouping</option>
        </select>

        <span className="text-xs text-muted tabular-nums">
          {shown} of {permits.length} permits
          {overdueShown > 0 ? (
            <span className="ml-1.5 font-medium text-red-600">· {overdueShown} overdue</span>
          ) : null}
        </span>

        <div className="ml-auto">
          <PermitListActions query={query} />
        </div>
      </div>

      {shown === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Inbox className="h-8 w-8 text-faint" />
          <p className="mt-3 text-sm font-medium text-fg">No permit matches these filters.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            Clear filters
          </button>
        </div>
      ) : (
        /* One scroller around the header strip AND every band, so they slide
         * together and the page body itself never scrolls sideways. */
        <div className="overflow-x-auto pb-1">
          <div className="min-w-[1100px] space-y-4">
            <table className="w-full min-w-[1100px] table-fixed text-sm">
              <Cols />
              <thead>
                <tr className="text-left align-bottom text-[11px] uppercase tracking-wide text-faint">
                  <th className="px-4 pb-1.5 font-medium">
                    <SortHeader column="reference" label="Reference" {...sortProps} />
                  </th>
                  <th className="px-3 pb-1.5 font-medium">Title</th>
                  <th className="px-3 pb-1.5 font-medium">Type</th>
                  <th className="px-3 pb-1.5 font-medium">
                    <SortHeader column="status" label="Status" {...sortProps} />
                  </th>
                  <th className="px-3 pb-1.5 font-medium">
                    <SortHeader column="submitted" label="Submitted" {...sortProps} />
                  </th>
                  <th className="px-3 pb-1.5 font-medium">Concept approval</th>
                  <th className="px-3 pb-1.5 font-medium">Decision / issued</th>
                  <th className="px-3 pb-1.5 font-medium">
                    <SortHeader column="due" label="Reply due" {...sortProps} />
                  </th>
                  <th className="px-4 pb-1.5 text-right font-medium">Activity</th>
                </tr>
              </thead>
            </table>

            {bands.map((b) => (
              /* Each band is its own elevated sheet. `card-surface` is the app's
               * glass opt-in and belongs here — a band is page content, it is a
               * top-level panel (nothing glass wraps it), and it is the only way
               * a bordered table shell joins the dashboard's glass treatment. */
              <section
                key={b.key}
                className="card-surface overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
              >
                {band !== "none" ? (
                  /* Styled like a pinned header, but not `position: sticky`: the
                   * horizontal scroller above is the nearest scrollport, so a
                   * real sticky header would pin to that box instead of the page
                   * and drift out of the band it belongs to. */
                  <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-4 py-2 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
                    {/* When banding by status the badge IS the label — printing
                     * both would say the same word twice on every band. */}
                    {band === "status" ? (
                      <PermitStatusBadge status={b.key as BuildingPermitStatus} />
                    ) : (
                      <span className="truncate text-sm font-semibold text-fg">{b.label}</span>
                    )}
                    <span className="text-xs text-muted tabular-nums">
                      {b.permits.length} {b.permits.length === 1 ? "permit" : "permits"}
                    </span>
                  </div>
                ) : null}

                <table className="w-full min-w-[1100px] table-fixed text-sm">
                  <Cols />
                  <tbody>
                    {b.permits.map((p) => {
                      const overdue = isResponseOverdue(p, today);
                      return (
                        <tr
                          key={p.id}
                          className="border-b border-border/60 transition-colors last:border-0 even:bg-surface-2/40 hover:bg-surface-2"
                        >
                          {/* The red accent rides on the first cell, not the row:
                           * a box-shadow on a <tr> is unreliable under the
                           * collapsed borders Tailwind's preflight sets. It reads
                           * `--color-red-600` rather than theme(): Tailwind v4
                           * only emits the palette variables it sees used, and
                           * the `text-red-600` above keeps this one alive. */}
                          <td
                            className={`px-4 py-2.5 align-top ${
                              overdue ? "shadow-[inset_2px_0_0_0_var(--color-red-600)]" : ""
                            }`}
                          >
                            <Link
                              href={`/design/building-permits/${p.id}`}
                              className="font-mono text-xs font-medium text-brand hover:underline"
                            >
                              {p.reference}
                            </Link>
                            {p.permitNumber ? (
                              <div className="truncate text-faint text-[11px]">{p.permitNumber}</div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <div className="truncate font-medium text-fg" title={p.title}>
                              {p.title}
                            </div>
                            {p.projectName ? (
                              <div className="truncate text-faint text-[11px]">{p.projectName}</div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <PermitTypeBadge type={p.permitType} />
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <PermitStatusBadge status={p.status} />
                          </td>
                          <td className="px-3 py-2.5 align-top text-muted">
                            {formatDate(p.submittedAt)}
                          </td>
                          <td className="px-3 py-2.5 align-top text-muted">
                            {formatDate(p.conceptApprovalAt)}
                          </td>
                          <td className="px-3 py-2.5 align-top text-muted">
                            {formatDate(p.issuedAt ?? p.decisionAt)}
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            {p.openResponseDueAt ? (
                              <ResponseDueBadge dueAt={p.openResponseDueAt} today={today} />
                            ) : p.targetDecisionAt ? (
                              <span className="text-faint text-[11px]">
                                Target {formatDate(p.targetDecisionAt)}
                              </span>
                            ) : (
                              <span className="text-faint">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 align-top">
                            <div className="flex items-center justify-end gap-2.5">
                              <Count
                                icon={Mail}
                                n={p.correspondenceCount}
                                label={`${p.correspondenceCount} letters`}
                              />
                              <Count
                                icon={Users}
                                n={p.meetingCount}
                                label={`${p.meetingCount} meetings`}
                              />
                              <Count
                                icon={Paperclip}
                                n={p.documentCount}
                                label={`${p.documentCount} documents`}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SortHeader({
  column,
  label,
  sort,
  dir,
  onSort,
}: {
  column: PermitSort;
  label: string;
  sort: PermitSort;
  dir: "asc" | "desc";
  onSort: (column: PermitSort) => void;
}) {
  const active = sort === column;
  const Chevron = dir === "asc" ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={`inline-flex items-center gap-0.5 uppercase tracking-wide transition-colors hover:text-fg ${
        active ? "text-fg" : ""
      }`}
      aria-label={`Sort by ${label}`}
    >
      {label}
      {active ? <Chevron className="h-3 w-3" /> : null}
    </button>
  );
}

/** A count that goes quiet at zero, so the eye only lands on files with substance. */
function Count({
  icon: Icon,
  n,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  n: number;
  label: string;
}) {
  return (
    <span
      title={label}
      className={`inline-flex items-center gap-0.5 text-[11px] tabular-nums ${
        n > 0 ? "text-muted" : "text-faint/60"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {n}
    </span>
  );
}
