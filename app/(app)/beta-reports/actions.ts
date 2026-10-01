"use server";

import { revalidatePath } from "next/cache";
import {
  createBetaReport,
  updateBetaReportStatus,
  getBetaReportScreenshot,
} from "@/lib/data/beta-reports";
import { requireActor } from "@/lib/server/actor";
import { isCurrentUserFounder } from "@/lib/server/founder";
import {
  MAX_SCREENSHOT_CHARS,
  type BetaReportInput,
  type BetaReportStatus,
} from "@/lib/data/beta-reports.types";

export type SubmitBetaReportResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Persist a beta-tester's Bug/Wish report. Never throws to the client — returns
 * a tagged result so the widget can show a success or inline error state.
 * The reporter is always the signed-in user, read from the database: the
 * widget's name/email/id fields are ignored, so nobody can file a report in
 * someone else's name (reports are shared across every company, and the
 * founder reads them as coming from that person).
 */
export async function submitBetaReport(
  input: BetaReportInput,
): Promise<SubmitBetaReportResult> {
  try {
    if (!input.title?.trim()) return { ok: false, error: "A short summary is required." };
    if (!input.description?.trim()) {
      return { ok: false, error: "Please describe the bug or wish." };
    }
    if (input.kind !== "BUG" && input.kind !== "WISH") {
      return { ok: false, error: "Pick whether this is a bug or a wish." };
    }
    if (input.screenshot && input.screenshot.length > MAX_SCREENSHOT_CHARS) {
      return {
        ok: false,
        error: "Screenshot is too large to send. Try removing it and submitting the text.",
      };
    }

    const actor = await requireActor();
    const id = await createBetaReport({
      ...input,
      reporterId: actor.id,
      reporterName: actor.name,
      reporterEmail: actor.email,
    });
    revalidatePath("/beta-reports");
    return { ok: true, id };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Failed to send your report.";
    return { ok: false, error };
  }
}

/**
 * Founder triage: change a report's status. Reports are not company-scoped
 * (they come from every practice), so only the founder may touch them.
 */
export async function setBetaReportStatus(
  id: string,
  status: BetaReportStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isCurrentUserFounder())) return { ok: false, error: "Only the AEC-flow founder can triage reports." };
  try {
    await updateBetaReportStatus(id, status);
    revalidatePath("/beta-reports");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update status." };
  }
}

/** Lazily load one report's screenshot for the founder's lightbox. A screenshot shows another practice's screen. */
export async function loadBetaReportScreenshot(id: string): Promise<string | null> {
  if (!(await isCurrentUserFounder())) return null;
  return getBetaReportScreenshot(id);
}
