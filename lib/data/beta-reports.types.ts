/**
 * BETA-Report — client-safe types, enums-as-unions and label maps. Lives apart
 * from `./beta-reports` so `"use client"` components (the widget, the admin
 * view) can import them without pulling the Postgres driver into the browser
 * bundle. See [[aec-prisma-client-boundary]].
 */

export type BetaReportKind = "BUG" | "WISH";
export type BetaReportStatus = "NEW" | "IN_REVIEW" | "PLANNED" | "RESOLVED" | "CLOSED";

export const BETA_REPORT_KINDS: readonly BetaReportKind[] = ["BUG", "WISH"] as const;

export const BETA_REPORT_STATUSES: readonly BetaReportStatus[] = [
  "NEW",
  "IN_REVIEW",
  "PLANNED",
  "RESOLVED",
  "CLOSED",
] as const;

export const KIND_LABEL: Record<BetaReportKind, string> = {
  BUG: "Bug",
  WISH: "Wish",
};

export const STATUS_LABEL: Record<BetaReportStatus, string> = {
  NEW: "New",
  IN_REVIEW: "In review",
  PLANNED: "Planned",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

/** Max accepted screenshot payload (data-URL string length) — keeps the server
 * action body under its configured limit. ~2.6MB of base64 ≈ ~1.9MB of bytes. */
export const MAX_SCREENSHOT_CHARS = 2_600_000;

/** What the widget submits. */
export type BetaReportInput = {
  kind: BetaReportKind;
  title: string;
  description: string;
  pageUrl?: string | null;
  userAgent?: string | null;
  screenshot?: string | null;
  reporterId?: string | null;
  reporterName?: string | null;
  reporterEmail?: string | null;
};

/** Row shape for the admin list — screenshot is omitted to keep payloads light;
 * `hasScreenshot` flags it and the full image is fetched on demand. */
export type BetaReportListItem = {
  id: string;
  kind: BetaReportKind;
  title: string;
  description: string;
  status: BetaReportStatus;
  pageUrl: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  userAgent: string | null;
  hasScreenshot: boolean;
  createdAt: string;
};

export type BetaReportSummary = {
  total: number;
  open: number;
  bugs: number;
  wishes: number;
};
