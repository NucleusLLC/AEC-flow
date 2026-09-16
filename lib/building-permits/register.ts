/**
 * Building Permit register — the pure logic behind the list.
 *
 * PURE. No Prisma, no React, no I/O. The screen register and the printed
 * register both call these functions, which is the point: a printed list that
 * disagrees with the list on screen is worse than no printed list at all.
 */
import {
  isClosedStatus,
  type BuildingPermitStatus,
  type BuildingPermitSummaryDTO,
  type PermitRegisterFilter,
} from "./types";

/** `YYYY-MM-DD` for a Date, in local terms — the register deals in calendar days. */
export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Next reference in the `BP-{year}-{NNN}` series, sequential within the
 * practice. Reads every reference ever used — including soft-deleted files — so
 * a reference is never reused; a permit reference that points at two different
 * applications is a reference nobody can quote to an authority.
 *
 * Pure, and deliberately tolerant of hand-typed references: it takes the highest
 * trailing number it can find and adds one, whatever prefix surrounds it.
 */
export function nextPermitReference(existing: string[], year: number): string {
  let max = 0;
  for (const ref of existing) {
    const m = /(\d+)\s*$/.exec(ref);
    if (m && Number(m[1]) > max) max = Number(m[1]);
  }
  return `BP-${year}-${String(max + 1).padStart(3, "0")}`;
}

/** True when an unanswered letter's due date has passed. `today` is `YYYY-MM-DD`. */
export function isResponseOverdue(
  permit: Pick<BuildingPermitSummaryDTO, "openResponseDueAt">,
  today: string,
): boolean {
  return Boolean(permit.openResponseDueAt) && permit.openResponseDueAt! < today;
}

/** True when the response is not yet late but falls within `days`. */
export function isResponseDueSoon(
  permit: Pick<BuildingPermitSummaryDTO, "openResponseDueAt">,
  today: string,
  days = 7,
): boolean {
  const due = permit.openResponseDueAt;
  if (!due || due < today) return false;
  const horizon = new Date(`${today}T00:00:00`);
  horizon.setDate(horizon.getDate() + days);
  return due <= ymd(horizon);
}

/** Days a submitted file has been waiting on the authority. Null before submission. */
export function daysWithAuthority(
  permit: Pick<BuildingPermitSummaryDTO, "submittedAt" | "decisionAt" | "issuedAt">,
  today: string,
): number | null {
  if (!permit.submittedAt) return null;
  const end = permit.issuedAt ?? permit.decisionAt ?? today;
  const from = Date.parse(`${permit.submittedAt.slice(0, 10)}T00:00:00`);
  const to = Date.parse(`${end.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

const MILITARY_MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

/**
 * A `YYYY-MM-DD` date in military style: `15 SEP 2026`.
 *
 * Read straight off the string, never through a Date, so no timezone can move
 * the day — and day-month-year with a lettered month cannot be misread as the
 * US order by anyone at an authority counter. Anything unparseable renders as a
 * dash rather than "Invalid Date".
 */
export function militaryDate(value: string | null | undefined): string {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  const month = m ? MILITARY_MONTHS[Number(m[2]) - 1] : undefined;
  return m && month ? `${m[3]} ${month} ${m[1]}` : "—";
}

/**
 * The version of the application now with the authority. V1 is the first
 * submission and every resubmission adds one. A file whose submitted date was
 * typed on the form but whose trips to the counter were never logged is still
 * V1 — it was submitted once, whatever the log says.
 *
 * `submittedAt` is the date THIS version went in, which is the latest logged
 * submission, falling back to the file's first submitted date.
 */
export function permitVersion(
  permit: Pick<BuildingPermitSummaryDTO, "submissionCount" | "submittedAt" | "latestSubmissionAt">,
): { version: number; submittedAt: string | null } | null {
  const version = Math.max(permit.submissionCount, permit.submittedAt ? 1 : 0);
  if (version === 0) return null;
  return { version, submittedAt: permit.latestSubmissionAt ?? permit.submittedAt };
}

type YMD = [number, number, number];

function ymdParts(value: string): YMD | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function utcDay([y, m, d]: YMD): number {
  return Date.UTC(y, m - 1, d);
}

/** Add calendar months, clamping to the month's last day (31 JAN + 1 = 28 FEB). */
function addMonths([y, m, d]: YMD, n: number): YMD {
  const index = m - 1 + n;
  const year = y + Math.floor(index / 12);
  const month = (((index % 12) + 12) % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return [year, month, Math.min(d, last)];
}

/**
 * Calendar months between two `YYYY-MM-DD` dates, to one decimal.
 *
 * Whole calendar months first, then the remainder as a fraction of the month it
 * falls in — so 15 JAN to 15 JUL is exactly 6.0 whatever the month lengths, which
 * is the number a client asking "how long has it been?" expects. A dividing-by-30
 * shortcut drifts a day or two a month and says 5.9 there.
 */
export function monthsBetween(from: string, to: string): number | null {
  const a = ymdParts(from);
  const b = ymdParts(to);
  if (!a || !b) return null;
  if (utcDay(b) <= utcDay(a)) return 0;

  let whole = (b[0] - a[0]) * 12 + (b[1] - a[1]);
  if (utcDay(addMonths(a, whole)) > utcDay(b)) whole -= 1;
  const anchor = utcDay(addMonths(a, whole));
  const next = utcDay(addMonths(a, whole + 1));
  const fraction = (utcDay(b) - anchor) / (next - anchor);
  return Math.round((whole + fraction) * 10) / 10;
}

/**
 * Lapsed time on a permit, in months: from the submittal date to the permit
 * ready date, or to today while the file is still waiting — `running` says
 * which, so the register can show a clock that is still ticking differently
 * from one that stopped. Null before the file was submitted.
 */
export function lapsedMonths(
  permit: Pick<BuildingPermitSummaryDTO, "submittedAt" | "issuedAt">,
  today: string,
): { months: number; running: boolean } | null {
  if (!permit.submittedAt) return null;
  const running = !permit.issuedAt;
  const months = monthsBetween(permit.submittedAt, permit.issuedAt ?? today);
  return months === null ? null : { months, running };
}

function haystack(p: BuildingPermitSummaryDTO): string {
  return [
    p.reference,
    p.permitNumber,
    p.title,
    p.projectName,
    p.clientName,
    p.applicantName,
    p.siteAddress,
    p.parcelNumber,
    p.authority,
    p.responsibleName,
    ...p.letters.flatMap((l) => [l.letterRef, l.subject]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Apply the register's filters. Order-independent and total: no filter matches all. */
export function filterPermits(
  permits: BuildingPermitSummaryDTO[],
  filter: PermitRegisterFilter,
): BuildingPermitSummaryDTO[] {
  const q = filter.q?.trim().toLowerCase() ?? "";
  return permits.filter((p) => {
    if (filter.status && filter.status !== "ALL") {
      if (filter.status === "OPEN") {
        if (isClosedStatus(p.status)) return false;
      } else if (p.status !== filter.status) {
        return false;
      }
    }
    if (filter.permitType && filter.permitType !== "ALL" && p.permitType !== filter.permitType) {
      return false;
    }
    if (filter.projectId && p.projectId !== filter.projectId) return false;
    if (filter.authority && (p.authority ?? "") !== filter.authority) return false;
    if (q && !haystack(p).includes(q)) return false;
    return true;
  });
}

export type PermitSort = "reference" | "permitNumber" | "submitted" | "ready" | "status" | "due";

/**
 * Sort for display. Rows with nothing in the sorted column sink to the bottom
 * rather than sorting as the epoch — a register that puts every unsubmitted file
 * first because null reads as 1970 is a register people stop sorting.
 */
export function sortPermits(
  permits: BuildingPermitSummaryDTO[],
  sort: PermitSort,
  direction: "asc" | "desc" = "asc",
): BuildingPermitSummaryDTO[] {
  const dir = direction === "asc" ? 1 : -1;
  const key = (p: BuildingPermitSummaryDTO): string | null => {
    switch (sort) {
      case "permitNumber":
        return p.permitNumber;
      case "submitted":
        return p.submittedAt;
      case "ready":
        return p.issuedAt;
      case "status":
        return p.status;
      case "due":
        return p.openResponseDueAt ?? p.targetDecisionAt;
      default:
        return p.reference;
    }
  };
  return [...permits].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka === null && kb === null) return a.reference.localeCompare(b.reference);
    if (ka === null) return 1; // nulls last, in both directions
    if (kb === null) return -1;
    if (ka === kb) return a.reference.localeCompare(b.reference);
    return ka < kb ? -dir : dir;
  });
}

export type PermitBand = {
  key: string;
  label: string;
  permits: BuildingPermitSummaryDTO[];
};

export type BandBy = "status" | "authority" | "project" | "none";

/**
 * Group the register into bands. The bands are what carry the shadow on screen
 * and the rule on paper, so grouping lives here rather than in either renderer.
 */
export function bandPermits(
  permits: BuildingPermitSummaryDTO[],
  by: BandBy,
  labelFor: (status: BuildingPermitStatus) => string,
): PermitBand[] {
  if (by === "none") return [{ key: "all", label: "", permits }];

  const bands = new Map<string, PermitBand>();
  for (const p of permits) {
    let key: string;
    let label: string;
    if (by === "status") {
      key = p.status;
      label = labelFor(p.status);
    } else if (by === "authority") {
      key = p.authority ?? "";
      label = p.authority ?? "No authority recorded";
    } else {
      key = p.projectId ?? "";
      label = p.projectName ?? "No project";
    }
    const band = bands.get(key);
    if (band) band.permits.push(p);
    else bands.set(key, { key, label, permits: [p] });
  }
  return [...bands.values()];
}

export type RegisterTotals = {
  total: number;
  open: number;
  awaitingAuthority: number;
  conceptApproved: number;
  issued: number;
  overdueResponses: number;
};

export function registerTotals(
  permits: BuildingPermitSummaryDTO[],
  today: string,
): RegisterTotals {
  let open = 0;
  let awaitingAuthority = 0;
  let conceptApproved = 0;
  let issued = 0;
  let overdueResponses = 0;
  for (const p of permits) {
    if (!isClosedStatus(p.status)) open += 1;
    if (p.status === "SUBMITTED" || p.status === "IN_REVIEW" || p.status === "RESUBMITTED") {
      awaitingAuthority += 1;
    }
    if (p.conceptApprovalAt) conceptApproved += 1;
    if (p.status === "ISSUED" || p.issuedAt) issued += 1;
    if (isResponseOverdue(p, today)) overdueResponses += 1;
  }
  return {
    total: permits.length,
    open,
    awaitingAuthority,
    conceptApproved,
    issued,
    overdueResponses,
  };
}
