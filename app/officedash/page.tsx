import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActor } from "@/lib/server/actor";
import { getCurrentCompany, isLicenseExpired } from "@/lib/server/tenant";
import { getFirmIdentity } from "@/lib/server/firm";
import { getOfficeBoard } from "@/lib/data/officedash";
import { OfficeBoard } from "@/components/officedash/office-board";

// Live per-request data for the signed-in practice — never prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "SITREP · AEC-flow" };

/**
 * /officedash — the office TV board. Outside the (app) group on purpose: no
 * sidebar, no top bar, just the board filling the screen. Signing in once on
 * the TV is enough; the session cookie keeps it signed in.
 */
/**
 * The TV's run: projects for 20 s, building permits for 10 s, then the Sigma
 * board, which flips back here after its own 20 s.
 */
const DEFAULT_DWELL = 20;
const DEFAULT_PERMIT_DWELL = 10;
const seconds = (raw: string | undefined, fallback: number) => (raw !== undefined && /^\d{1,4}$/.test(raw) ? Number(raw) : fallback);

export default async function OfficeDashPage({
  searchParams,
}: {
  searchParams: Promise<{ dwell?: string; permits?: string; screen?: string }>;
}) {
  const actor = await requireActor().catch(() => null);
  if (!actor) redirect("/login?callbackUrl=/officedash");
  const company = await getCurrentCompany();
  if (isLicenseExpired(company)) redirect("/expired");

  // For testing: `?dwell=N&permits=M` change the two times; `?dwell=0` stops the run and
  // stays on one screen (`&screen=permits` for the permits sheet).
  const q = await searchParams;
  const dwell = seconds(q.dwell, DEFAULT_DWELL);
  const permitDwell = seconds(q.permits, DEFAULT_PERMIT_DWELL);
  const pin = q.screen === "permits" ? "permits" : "projects";

  const [board, firm] = await Promise.all([getOfficeBoard(), getFirmIdentity()]);
  return (
    <OfficeBoard
      board={board}
      firmName={firm.name}
      timeZone={process.env.OFFICE_TIME_ZONE || "America/Aruba"}
      dwell={dwell}
      permitDwell={permitDwell}
      pin={pin}
    />
  );
}
