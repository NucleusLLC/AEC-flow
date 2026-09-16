/**
 * The register's filters, as they travel to the printed register.
 *
 * PURE. The screen builds this query string and the print route reads it back,
 * so what prints is what was on screen — including the grouping and the sort,
 * not just the filters. Anything unparseable falls back to the screen's own
 * default rather than throwing: a printed register is not worth a 500.
 */
import {
  PERMIT_STATUSES,
  PERMIT_STATUS_LABEL,
  PERMIT_TYPES,
  PERMIT_TYPE_LABEL,
  type BuildingPermitStatus,
  type BuildingPermitType,
} from "./types";
import type { BandBy, PermitSort } from "./register";

export type PermitPrintQuery = {
  status?: string;
  type?: string;
  authority?: string;
  q?: string;
  band?: string;
  sort?: string;
  dir?: string;
  orientation?: string;
};

export type PermitPrintRequest = {
  status: BuildingPermitStatus | "ALL" | "OPEN";
  permitType: BuildingPermitType | "ALL";
  authority?: string;
  q?: string;
  band: BandBy;
  sort: PermitSort;
  dir: "asc" | "desc";
  orientation: "portrait" | "landscape";
};

const BANDS: BandBy[] = ["status", "authority", "project", "none"];
const SORTS: PermitSort[] = ["reference", "permitNumber", "submitted", "ready", "status", "due"];

function one<T extends string>(value: string | undefined, allowed: T[], fallback: T): T {
  return allowed.includes((value ?? "") as T) ? ((value ?? "") as T) : fallback;
}

export function parsePermitPrintQuery(query: PermitPrintQuery = {}): PermitPrintRequest {
  const status = query.status;
  const permitType = query.type;
  return {
    status:
      status === "OPEN" || PERMIT_STATUSES.includes(status as BuildingPermitStatus)
        ? (status as BuildingPermitStatus | "OPEN")
        : "ALL",
    permitType: PERMIT_TYPES.includes(permitType as BuildingPermitType)
      ? (permitType as BuildingPermitType)
      : "ALL",
    authority: query.authority?.trim() || undefined,
    q: query.q?.trim() || undefined,
    band: one(query.band, BANDS, "status"),
    // The screen's default: newest submittal first.
    sort: one(query.sort, SORTS, "submitted"),
    dir: one(query.dir, ["asc", "desc"] as const, "desc"),
    // Seven columns do not fit a portrait text block, so the register prints
    // landscape unless the user asks otherwise.
    orientation: one(query.orientation, ["portrait", "landscape"] as const, "landscape"),
  };
}

/**
 * The filters in words, for the sheet's header — so a printed register found on
 * a desk says what it is a register OF. "Every permit" when nothing is filtered:
 * a header that says "All · All types · All authorities" says nothing.
 */
export function describePermitPrintScope(request: PermitPrintRequest): string {
  const parts: string[] = [];
  if (request.status === "OPEN") parts.push("Open files");
  else if (request.status !== "ALL") parts.push(PERMIT_STATUS_LABEL[request.status]);
  if (request.permitType !== "ALL") parts.push(PERMIT_TYPE_LABEL[request.permitType]);
  if (request.authority) parts.push(request.authority);
  if (request.q) parts.push(`matching “${request.q}”`);
  return parts.length ? parts.join(" · ") : "Every permit";
}
