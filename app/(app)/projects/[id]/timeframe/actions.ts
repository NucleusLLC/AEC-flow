"use server";

/**
 * Project PHASES — server actions.
 *
 * WRITE-THEN-SHOW: `savePhasesAction` returns the phase screen as it now stands
 * in the database, and the editor renders that rather than relying on
 * `router.refresh()` to repaint it (the pattern permitSnapshotAction set, after
 * refresh left the permit case file stale). Every failure comes back as a
 * translated sentence, never a thrown digest.
 *
 * The tenancy and ownership checks live in lib/data/project-phases.ts, where
 * every caller passes — an action is a public endpoint.
 */
import { revalidatePath } from "next/cache";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";
import { adjustPhase, getPhaseScreen, PhaseSaveError, savePhases, type PhaseScreen } from "@/lib/data/project-phases";
import type { PhaseDraft } from "@/lib/projects/phases";

export type PhaseActionResult = { ok: true; screen: PhaseScreen } | { ok: false; error: string };

async function explain(e: unknown): Promise<string> {
  const t = await getServerT();
  if (!(e instanceof PhaseSaveError)) return t("The phases could not be saved.");
  const p = e.params;
  switch (e.code) {
    case "NOT_FOUND":
      return t("Project not found.");
    case "FOREIGN_PHASE":
      return t("A phase in that list is not part of this project. Reload the page and try again.");
    case "HOURS_BOOKED":
      return fmt(t("{hours} h are booked to {name} — move or delete them first."), {
        hours: p.hours ?? 0,
        name: p.name ?? "",
      });
    case "BAD_HOURS":
      return fmt(t("Planned hours are a number from 0 to {max}."), { max: "99,999" });
    case "INVALID": {
      const why =
        p.issue === "NAME_REQUIRED"
          ? t("Every phase needs a name.")
          : p.issue === "NAME_TOO_LONG"
            ? t("A phase name is 120 characters at most.")
            : p.issue === "DUPLICATE_NAME"
              ? t("Two phases have the same name.")
              : p.issue === "END_BEFORE_START"
                ? t("The end date is before the start date.")
                : p.issue === "BAD_DATE"
                  ? t("That is not a valid date.")
                  : p.issue === "BAD_HOURS"
                    ? fmt(t("Planned hours are a number from 0 to {max}."), { max: "99,999" })
                  : p.issue === "TOO_MANY"
                    ? t("A project has 40 phases at most.")
                    : t("That phase cannot be saved.");
      return fmt(t("Phase {row}: {why}"), { row: p.row ?? 0, why });
    }
  }
}

function revalidate(projectId: string): void {
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/officedash");
  revalidatePath("/finance/time");
}

/** Re-read the phase screen (after the timesheet, or another tab, changed it). */
export async function phaseScreenAction(projectId: string): Promise<PhaseActionResult> {
  try {
    return { ok: true, screen: await getPhaseScreen(projectId) };
  } catch (e) {
    return { ok: false, error: await explain(e) };
  }
}

/** Save the whole phase list in its new order; returns the saved screen. */
export async function savePhasesAction(projectId: string, drafts: PhaseDraft[]): Promise<PhaseActionResult> {
  try {
    const screen = await savePhases(projectId, Array.isArray(drafts) ? drafts : []);
    revalidate(projectId);
    return { ok: true, screen };
  } catch (e) {
    return { ok: false, error: await explain(e) };
  }
}

/**
 * The quick − / + on one phase's percent or planned hours. The client sends the
 * new value, not the step, so a double click cannot count twice against a
 * stale screen. Returns the saved screen.
 */
export async function adjustPhaseAction(
  projectId: string,
  phaseId: string,
  change: { progressPct?: number | string | null; plannedHours?: number | string | null },
): Promise<PhaseActionResult> {
  try {
    const safe = change && typeof change === "object" ? change : {};
    const screen = await adjustPhase(projectId, phaseId, {
      ...("progressPct" in safe ? { progressPct: safe.progressPct } : {}),
      ...("plannedHours" in safe ? { plannedHours: safe.plannedHours } : {}),
    });
    revalidate(projectId);
    return { ok: true, screen };
  } catch (e) {
    return { ok: false, error: await explain(e) };
  }
}
