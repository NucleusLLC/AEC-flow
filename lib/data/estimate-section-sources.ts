/**
 * Server side of "Copy Section over": the Job Orders whose estimates a section
 * can be pulled from. See `lib/estimates/section-sources.ts` for the feature.
 *
 * SERVER-ONLY (Prisma). Additive: reads `cost_estimates` through the tenant-scoped
 * client and changes nothing in the protected Estimates data layer — the full
 * sheet of the chosen source is loaded with the existing `getEstimateById`.
 */
import type { EstimateStatus as DbEstimateStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sortSources, type SectionSource } from "@/lib/estimates/section-sources";
import type { EstimateStatus } from "./estimates.types";

const STATUS: Record<DbEstimateStatus, EstimateStatus> = {
  DRAFT: "draft",
  IN_REVIEW: "in_review",
  APPROVED: "approved",
};

/**
 * Every estimate in the caller's practice except the one being edited, newest Job
 * Order first. Headers and counts only — no line items are loaded until one is
 * picked. Estimates with no sections are left out: there is nothing to copy.
 */
export async function listSectionSources(excludeEstimateId: string): Promise<SectionSource[]> {
  const rows = await prisma.costEstimate.findMany({
    where: excludeEstimateId ? { id: { not: excludeEstimateId } } : undefined,
    select: {
      id: true,
      projectNumber: true,
      projectName: true,
      client: true,
      version: true,
      date: true,
      currency: true,
      status: true,
      locked: true,
      amount: true,
      categories: { select: { _count: { select: { items: true } } } },
    },
  });

  return sortSources(
    rows
      .filter((e) => e.categories.length > 0)
      .map((e) => ({
        id: e.id,
        projectNumber: e.projectNumber ?? "",
        projectName: e.projectName,
        client: e.client ?? "",
        version: e.version,
        date: e.date ? e.date.toISOString().slice(0, 10) : "",
        currency: e.currency,
        status: STATUS[e.status],
        locked: e.locked,
        sectionCount: e.categories.length,
        lineCount: e.categories.reduce((n, c) => n + c._count.items, 0),
        amount: e.amount,
      })),
  );
}
