"use server";

import { revalidatePath } from "next/cache";
import {
  createBetaReport,
  updateBetaReportStatus,
  getBetaReportScreenshot,
} from "@/lib/data/beta-reports";
import { getCurrentUserId } from "@/lib/data/notifications";
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
 * The reporter id is resolved server-side (signed-in user, else null) so the
 * widget only has to pass the display name/email it already knows.
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

    const reporterId = input.reporterId ?? (await getCurrentUserId());
    const id = await createBetaReport({ ...input, reporterId });
    revalidatePath("/beta-reports");
    return { ok: true, id };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Failed to send your report.";
    return { ok: false, error };
  }
}

/** Admin triage: change a report's status. */
export async function setBetaReportStatus(
  id: string,
  status: BetaReportStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await updateBetaReportStatus(id, status);
    revalidatePath("/beta-reports");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update status." };
  }
}

/** Lazily load one report's screenshot for the admin lightbox. */
export async function loadBetaReportScreenshot(id: string): Promise<string | null> {
  return getBetaReportScreenshot(id);
}
