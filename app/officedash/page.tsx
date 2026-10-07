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
export default async function OfficeDashPage() {
  const actor = await requireActor().catch(() => null);
  if (!actor) redirect("/login?callbackUrl=/officedash");
  const company = await getCurrentCompany();
  if (isLicenseExpired(company)) redirect("/expired");

  const [board, firm] = await Promise.all([getOfficeBoard(), getFirmIdentity()]);
  return <OfficeBoard board={board} firmName={firm.name} timeZone={process.env.OFFICE_TIME_ZONE || "America/Aruba"} />;
}
