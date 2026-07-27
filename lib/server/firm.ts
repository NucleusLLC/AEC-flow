/**
 * Server-side resolution of the firm identity that documents print.
 *
 * Resolution order, best available first:
 *
 *   1. Settings → Practice profile name (what the company explicitly configured)
 *   2. The Company record's own name (every tenant has one, from signup)
 *   3. "AEC-flow" — the neutral product wordmark
 *
 * Step 2 matters: most beta companies have never opened Settings → Practice, so
 * without it their documents fall through to a generic wordmark even though we
 * know who they are. It is also why the old hardcoded "ZenArch Consultants" was
 * so visible — it was the only name any unconfigured tenant ever saw.
 *
 * Server-only (reads config + session company). Client previews use the seeded
 * global in lib/firm-identity.ts instead.
 */
import { getPracticeSettings } from "@/lib/server/practice-config";
import { getCurrentCompany } from "@/lib/server/tenant";
import { practiceLocationLine, type FirmIdentity } from "@/lib/firm-identity";

export async function getFirmIdentity(): Promise<FirmIdentity> {
  const [practice, company] = await Promise.all([getPracticeSettings(), getCurrentCompany()]);
  return {
    name: practice.profile.name?.trim() || company?.name?.trim() || "AEC-flow",
    location: practiceLocationLine(practice.profile),
  };
}
