"use client";

/**
 * The Building Permit register — filtering, sorting and banding on screen.
 *
 * Every decision about WHAT a filter means, HOW a column sorts, WHERE a band
 * starts, what version a file is on and how many months have lapsed lives in
 * lib/building-permits/register.ts. This file only renders the result, so a
 * printed register built on the same functions cannot disagree with the screen.
 *
 * Dates are military style (15 SEP 2026) throughout — see `militaryDate`.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  FileText,
  Inbox,
  Search,
} from "lucide-react";
import { PermitStatusBadge, ResponseDueBadge } from "@/components/building-permits/badges";
import { PermitListActions } from "@/components/building-permits/list-actions";
import {
  bandPermits,
  filterPermits,
  isResponseOverdue,
  lapsedMonths,
  militaryDate,
  permitVersion,
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
  type PermitLetterSummary,
} from "@/lib/building-permits/types";

const CONTROL =
  "h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

/** Letters shown in a register cell before "+N more" sends you to the file. */
const LETTERS_IN_CELL = 3;

/**
 * Column widths, as percentages of the 1100px minimum.
 *
 * Each band is its own <table> (that is what lets a band be an elevated block
 * rather than a run of rows), so nothing makes their columns line up
 * automatically. `table-fixed` plus this one shared <colgroup> does — without
 * it, two bands whose longest title differs would be two differently ruled
 * tables stacked on top of each other.
 *
 * Building permit # · Permit · Version # · Submittal date · Correspondence ·
 * Lapsed time · Permit ready date
 */
const COL_WIDTHS = ["13%", "17%", "8%", "12%", "26%", "10%", "14%"];

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
  const [sort, setSort] = useState<PermitSort>("submitted");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

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

  /**
   * The active filters as a query string, handed to the print links so what
   * prints is what is on screen. Keys match `parsePermitPrintQuery` exactly; a
   * filter sitting at its neutral value is left out rather than spelled "ALL",
   * so the string stays readable in a URL bar.
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
            placeholder="Search permit number, reference, address, letter ref…"
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
                <tr className="whitespace-nowrap text-left align-bottom text-[11px] uppercase tracking-wide text-faint">
                  <th className="px-4 pb-1.5 font-medium">
                    <SortHeader column="permitNumber" label="Building permit #" {...sortProps} />
                  </th>
                  <th className="px-3 pb-1.5 font-medium">Permit</th>
                  <th className="px-3 pb-1.5 font-medium">Version #</th>
                  <th className="px-3 pb-1.5 font-medium">
                    <SortHeader column="submitted" label="Submittal date" {...sortProps} />
                  </th>
                  <th className="px-3 pb-1.5 font-medium">Correspondence</th>
                  <th className="px-3 pb-1.5 text-right font-medium">Lapsed (months)</th>
                  <th className="px-4 pb-1.5 font-medium">
                    <SortHeader column="ready" label="Permit ready date" {...sortProps} />
                  </th>
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
                    {b.permits.map((p) => (
                      <PermitRow key={p.id} permit={p} today={today} showStatus={band !== "status"} />
                    ))}
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

function PermitRow({
  permit: p,
  today,
  showStatus,
}: {
  permit: BuildingPermitSummaryDTO;
  today: string;
  showStatus: boolean;
}) {
  const overdue = isResponseOverdue(p, today);
  const version = permitVersion(p);
  const lapsed = lapsedMonths(p, today);
  const href = `/design/building-permits/${p.id}`;

  return (
    <tr className="border-b border-border/60 transition-colors last:border-0 even:bg-surface-2/40 hover:bg-surface-2">
      {/* The red accent rides on the first cell, not the row: a box-shadow on a
       * <tr> is unreliable under the collapsed borders Tailwind's preflight
       * sets. It reads `--color-red-600` rather than theme(): Tailwind v4 only
       * emits the palette variables it sees used, and the `text-red-600` in the
       * toolbar keeps this one alive. */}
      <td
        className={`px-4 py-2.5 align-top ${
          overdue ? "shadow-[inset_2px_0_0_0_var(--color-red-600)]" : ""
        }`}
      >
        <Link href={href} className="group block">
          {p.permitNumber ? (
            <span className="block truncate font-mono text-sm font-semibold text-brand group-hover:underline">
              {p.permitNumber}
            </span>
          ) : (
            <span
              className="block text-xs italic text-faint group-hover:underline"
              title="The authority has not issued a building permit number yet"
            >
              Not yet issued
            </span>
          )}
          <span className="block truncate font-mono text-[11px] text-faint">{p.reference}</span>
        </Link>
      </td>

      <td className="px-3 py-2.5 align-top">
        <div className="truncate font-medium text-fg" title={p.title}>
          {p.title}
        </div>
        {p.projectName || p.siteAddress ? (
          <div className="truncate text-[11px] text-faint">{p.projectName ?? p.siteAddress}</div>
        ) : null}
        {showStatus ? (
          <div className="mt-1">
            <PermitStatusBadge status={p.status} />
          </div>
        ) : null}
      </td>

      <td className="px-3 py-2.5 align-top">
        {version ? (
          <>
            <span className="inline-flex h-6 min-w-8 items-center justify-center rounded-md border border-border bg-surface-2 px-1.5 font-mono text-xs font-semibold tabular-nums text-fg">
              V{version.version}
            </span>
            {version.version > 1 && version.submittedAt ? (
              <div className="mt-1 whitespace-nowrap font-mono text-[11px] leading-tight text-faint">
                {militaryDate(version.submittedAt)}
              </div>
            ) : null}
          </>
        ) : (
          <span className="text-faint">—</span>
        )}
      </td>

      <td className="px-3 py-2.5 align-top font-mono text-xs tabular-nums text-fg">
        {p.submittedAt ? militaryDate(p.submittedAt) : <span className="font-sans text-faint">—</span>}
      </td>

      <td className="px-3 py-2.5 align-top">
        <Correspondence permit={p} today={today} href={href} />
      </td>

      <td className="px-3 py-2.5 text-right align-top">
        {lapsed ? (
          <>
            <span
              className={`font-mono text-sm font-semibold tabular-nums ${
                lapsed.running ? "text-fg" : "text-muted"
              }`}
            >
              {lapsed.months.toFixed(1)}
            </span>
            <div className="text-[11px] text-faint">{lapsed.running ? "running" : "final"}</div>
          </>
        ) : (
          <span className="text-faint">—</span>
        )}
      </td>

      <td className="px-4 py-2.5 align-top font-mono text-xs tabular-nums">
        {p.issuedAt ? (
          <span className="font-semibold text-green-700 dark:text-green-400">
            {militaryDate(p.issuedAt)}
          </span>
        ) : p.targetDecisionAt ? (
          <span className="whitespace-nowrap text-faint" title="Target date — the permit is not ready yet">
            Target {militaryDate(p.targetDecisionAt)}
          </span>
        ) : (
          <span className="font-sans text-faint">—</span>
        )}
      </td>
    </tr>
  );
}

/** The letters on the file, each one click from its PDF. */
function Correspondence({
  permit: p,
  today,
  href,
}: {
  permit: BuildingPermitSummaryDTO;
  today: string;
  href: string;
}) {
  if (p.letters.length === 0) {
    return p.openResponseDueAt ? (
      <ResponseDueBadge dueAt={p.openResponseDueAt} today={today} />
    ) : (
      <span className="text-faint">—</span>
    );
  }
  const more = p.letters.length - LETTERS_IN_CELL;
  return (
    <div className="space-y-1">
      {p.openResponseDueAt ? (
        <ResponseDueBadge dueAt={p.openResponseDueAt} today={today} />
      ) : null}
      <ul className="space-y-0.5">
        {p.letters.slice(0, LETTERS_IN_CELL).map((l) => (
          <LetterLine key={l.id} letter={l} />
        ))}
      </ul>
      {more > 0 ? (
        <Link href={`${href}#correspondence`} className="text-[11px] font-medium text-brand hover:underline">
          +{more} more
        </Link>
      ) : null}
    </div>
  );
}

function LetterLine({ letter: l }: { letter: PermitLetterSummary }) {
  const Direction = l.direction === "INCOMING" ? ArrowDownLeft : ArrowUpRight;
  const label = [militaryDate(l.letterDate), l.letterRef ?? l.subject].filter((s) => s !== "—").join(" · ");
  return (
    <li className="flex min-w-0 items-center gap-1.5 text-xs">
      <Direction
        className={`h-3.5 w-3.5 shrink-0 ${l.direction === "INCOMING" ? "text-violet-600" : "text-faint"}`}
        aria-label={l.direction === "INCOMING" ? "Received" : "Sent"}
      />
      {l.pdf ? (
        <a
          href={`/design/building-permits/file/${l.pdf.documentId}`}
          target="_blank"
          rel="noopener noreferrer"
          title={`${l.subject} — open PDF${l.pdf.filename ? ` (${l.pdf.filename})` : ""}`}
          className="inline-flex min-w-0 items-center gap-1 text-fg hover:text-brand hover:underline"
        >
          <FileText className="h-3.5 w-3.5 shrink-0 text-red-600" />
          <span className="truncate font-mono">{label || l.subject}</span>
          <span className="shrink-0 rounded bg-red-600/10 px-1 text-[10px] font-semibold text-red-700 dark:text-red-400">
            PDF
          </span>
        </a>
      ) : (
        <span className="truncate font-mono text-muted" title={`${l.subject} — no PDF attached`}>
          {label || l.subject}
        </span>
      )}
    </li>
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
