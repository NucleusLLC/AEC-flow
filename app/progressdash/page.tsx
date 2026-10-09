import type { Metadata } from "next";
import { APP_VERSION, appBuildId } from "@/lib/version";
import { PROGRESS } from "@/lib/progressdash/data";
import { officeToday, shortCommit } from "@/lib/progressdash/timeline";
import { ProgressBoard } from "@/components/progressdash/progress-board";

// The deployed commit and "today" are read per request, so the board is never prerendered.
// No database: everything else comes from lib/progressdash/data.ts.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "PROGRESS · AEC-flow" };

/**
 * /progressdash — AEC-FLOW · BUILD TIMELINE, the office TV board that shows how far
 * the build of AEC-flow itself has come. Outside the (app) group on purpose (no
 * sidebar, no top bar) and PUBLIC by the owner's decision, like /officedash: it
 * shows no practice data, and the TV must never see a login page (proxy.ts lets it through).
 *
 * The TV's run: /officedash (projects, permits) → here for 30 s → the Nucleus board
 * → LOC8 → Sigma → back to /officedash. `?dwell=N` changes the 30 s; `?dwell=0`
 * stays on this board.
 */
const DEFAULT_DWELL = 30;
/** Next board in the run. */
const HANDOVER_URL = "https://nucleus-apps.vercel.app/officedash";

export default async function ProgressDashPage({ searchParams }: { searchParams: Promise<{ dwell?: string }> }) {
  const q = await searchParams;
  const dwell = q.dwell !== undefined && /^\d{1,4}$/.test(q.dwell) ? Number(q.dwell) : DEFAULT_DWELL;
  const timeZone = process.env.OFFICE_TIME_ZONE || "America/Aruba";
  return (
    <ProgressBoard
      data={PROGRESS}
      today={officeToday(new Date(), timeZone)}
      timeZone={timeZone}
      version={APP_VERSION}
      commit={shortCommit(appBuildId())}
      dwell={dwell}
      next={HANDOVER_URL}
    />
  );
}
