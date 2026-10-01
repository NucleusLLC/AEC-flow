/**
 * "Copy Section over" — the Job Order list a section can be PULLED from.
 *
 * CLIENT-SAFE: no Prisma. The server builds `SectionSource` rows in
 * `lib/data/estimate-section-sources.ts`; the dialog filters and sorts them here.
 *
 * ─── HOW THIS DIFFERS FROM THE TWO COPY CONTROLS ALREADY ON THE SHEET ─────────
 * `SectionCopy` is a one-slot localStorage clipboard (copy here, paste there, same
 * browser). `CopyTasksDialog` PUSHES ticked tasks out of the open estimate into
 * another project. This is the third direction: from the estimate you are
 * building, reach into any earlier Job Order and PULL its sections in. The copy
 * itself goes through `copyLines` — the same pure function the push uses — so
 * both directions agree on what travels (code, task, unit, labour norm) and what
 * resets (progress always; quantities and prices unless asked for).
 *
 * The copy is applied to the editor's state, not written on the server: the open
 * sheet autosaves its WHOLE category list, so a server-side append would be
 * overwritten by the next autosave of the tab that asked for it.
 */
import type { EstimateStatus } from "@/lib/data/estimates.types";

/** One estimate another estimate can copy sections from. Headers only. */
export type SectionSource = {
  id: string;
  /** The Job Order number, e.g. "2026A-019". Blank on estimates drafted without one. */
  projectNumber: string;
  projectName: string;
  client: string;
  version: string;
  /** yyyy-mm-dd, or "" when undated. */
  date: string;
  currency: string;
  status: EstimateStatus;
  locked: boolean;
  sectionCount: number;
  lineCount: number;
  /** The stored grand total, as the estimate list shows it. */
  amount: number;
};

/**
 * Every whitespace-separated word of the query must appear in the Job Order
 * number, the project name or the client — so "kamay 33" and "2026A kamay" both
 * find Kamay 33. Case-insensitive; an empty query returns everything.
 */
export function filterSources(rows: readonly SectionSource[], query: string): SectionSource[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...rows];
  return rows.filter((r) => {
    const hay = `${r.projectNumber} ${r.projectName} ${r.client}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/**
 * Newest Job Order first, and within one Job Order its newest version first.
 *
 * Numbers compare with `numeric` collation so 2026A-100 sorts after 2026A-019
 * rather than between 2026A-01x entries. Estimates without a number go last:
 * they are drafts nobody has filed under a job yet.
 */
export function sortSources(rows: readonly SectionSource[]): SectionSource[] {
  return [...rows].sort((a, b) => {
    const an = a.projectNumber.trim();
    const bn = b.projectNumber.trim();
    if (!an !== !bn) return an ? -1 : 1;
    const byNumber = bn.localeCompare(an, undefined, { numeric: true, sensitivity: "base" });
    if (byNumber !== 0) return byNumber;
    const byName = a.projectName.localeCompare(b.projectName, undefined, { sensitivity: "base" });
    if (byName !== 0) return byName;
    return b.date.localeCompare(a.date);
  });
}
