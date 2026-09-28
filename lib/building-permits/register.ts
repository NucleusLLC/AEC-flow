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

export type PermitSort = "reference" | "submitted" | "status" | "due";

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
      case "submitted":
        return p.submittedAt;
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
