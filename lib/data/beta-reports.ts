/**
 * BETA-Report data-access layer (Prisma-backed). SERVER-ONLY — imports
 * `@/lib/db`; client components use `./beta-reports.types`. Re-exports the
 * client-safe types so server call-sites keep importing from one place.
 */

import { prisma } from "@/lib/db";

export * from "./beta-reports.types";
import type {
  BetaReportInput,
  BetaReportListItem,
  BetaReportStatus,
  BetaReportSummary,
} from "./beta-reports.types";

type BetaReportRow = {
  id: string;
  kind: "BUG" | "WISH";
  title: string;
  description: string;
  status: BetaReportStatus;
  pageUrl: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  userAgent: string | null;
  createdAt: Date;
};

/** Columns for the list — everything except the (potentially large) screenshot. */
const LIST_SELECT = {
  id: true,
  kind: true,
  title: true,
  description: true,
  status: true,
  pageUrl: true,
  reporterName: true,
  reporterEmail: true,
  userAgent: true,
  createdAt: true,
} as const;

function toListItem(r: BetaReportRow & { _hasScreenshot: boolean }): BetaReportListItem {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    description: r.description,
    status: r.status,
    pageUrl: r.pageUrl,
    reporterName: r.reporterName,
    reporterEmail: r.reporterEmail,
    userAgent: r.userAgent,
    hasScreenshot: r._hasScreenshot,
    createdAt: r.createdAt.toISOString(),
  };
}

/** All reports, newest first. Screenshots are not loaded here (see LIST_SELECT);
 * `hasScreenshot` is derived from a cheap presence check. */
export async function getBetaReports(): Promise<BetaReportListItem[]> {
  try {
    const rows = await prisma.betaReport.findMany({
      select: { ...LIST_SELECT, screenshot: true },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) =>
      toListItem({
        ...r,
        _hasScreenshot: Boolean(r.screenshot && r.screenshot.length > 0),
      }),
    );
  } catch (e) {
    // Degrade gracefully (empty list) rather than 500-ing the admin page if the
    // DB is unreachable — mirrors the other data layers' resilience.
    console.error("[beta-reports] getBetaReports failed; returning empty list:", e);
    return [];
  }
}

export async function summarizeBetaReports(
  items: BetaReportListItem[],
): Promise<BetaReportSummary> {
  return {
    total: items.length,
    open: items.filter((r) => r.status !== "RESOLVED" && r.status !== "CLOSED").length,
    bugs: items.filter((r) => r.kind === "BUG").length,
    wishes: items.filter((r) => r.kind === "WISH").length,
  };
}

/** Fetch just one report's screenshot data-URL (for the admin lightbox). */
export async function getBetaReportScreenshot(id: string): Promise<string | null> {
  const row = await prisma.betaReport.findUnique({
    where: { id },
    select: { screenshot: true },
  });
  return row?.screenshot ?? null;
}

/** Persist a new report. Returns the new id. Empty strings are normalised to null. */
export async function createBetaReport(input: BetaReportInput): Promise<string> {
  const title = input.title.trim();
  const description = input.description.trim();
  if (!title) throw new Error("A short summary is required.");
  if (!description) throw new Error("Please describe the bug or wish.");

  const created = await prisma.betaReport.create({
    data: {
      kind: input.kind,
      title,
      description,
      pageUrl: input.pageUrl?.trim() || null,
      userAgent: input.userAgent?.trim() || null,
      screenshot: input.screenshot || null,
      reporterId: input.reporterId || null,
      reporterName: input.reporterName?.trim() || null,
      reporterEmail: input.reporterEmail?.trim() || null,
    },
    select: { id: true },
  });
  return created.id;
}

/** Move a report through its lifecycle (admin triage). */
export async function updateBetaReportStatus(
  id: string,
  status: BetaReportStatus,
): Promise<void> {
  await prisma.betaReport.update({ where: { id }, data: { status } });
}
