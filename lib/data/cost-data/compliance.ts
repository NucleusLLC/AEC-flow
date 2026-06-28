/**
 * Licensing & compliance guardrails for third-party cost data.
 *
 * Rules enforced here (UI + future API must both call these):
 *  - Licensed source content is only visible to companies with an active licence.
 *  - Every import records who imported it and the original source.
 *  - Usage is logged; licensed data is deletable when a licence expires.
 *  - Licensed third-party data must NOT be used to train AI models unless permitted.
 *  - Reports must carry a provider-ownership disclaimer.
 */

import type { CostSource } from "./types";

export type LicenseGrant = {
  companyId: string;
  sourceId: string;
  grantedTo: string; // user who holds/registered the licence
  importedBy?: string;
  startsAt: string;
  expiresAt?: string | null;
  aiTrainingPermitted: boolean;
};

/** Is a licensed source currently usable by this company? */
export function canAccessSource(source: CostSource, grants: LicenseGrant[], companyId: string, today: string): boolean {
  if (!source.licenseRequired) return true; // public/owned data
  const g = grants.find((x) => x.sourceId === source.id && x.companyId === companyId);
  if (!g) return false;
  if (g.expiresAt && g.expiresAt < today) return false; // expired
  return true;
}

/** May this licensed source feed AI training? Default deny. */
export function aiTrainingAllowed(source: CostSource, grants: LicenseGrant[], companyId: string): boolean {
  if (!source.licenseRequired) return true;
  const g = grants.find((x) => x.sourceId === source.id && x.companyId === companyId);
  return Boolean(g?.aiTrainingPermitted);
}

export type UsageEvent = {
  at: string;
  companyId: string;
  userId: string;
  action: "import" | "view" | "use_in_estimate" | "export" | "delete";
  sourceId: string;
  detail?: string;
};

/** Append-only usage log (stub — persists to DB later). */
export function logUsage(events: UsageEvent[], e: UsageEvent): UsageEvent[] {
  return [...events, e];
}

/** Standard report disclaimer for a set of sources used in an estimate. */
export function disclaimerFor(sources: CostSource[]): string {
  const licensed = sources.filter((s) => s.licenseRequired);
  const lines = [
    "Cost figures are estimates prepared for the stated purpose and date; actual costs may vary.",
  ];
  if (licensed.length) {
    const names = licensed.map((s) => s.name).join(", ");
    lines.push(
      `Third-party licensed data (${names}) remains the property of its provider and is used under the licence held by the client. It may not be redistributed.`,
    );
  }
  return lines.join(" ");
}
