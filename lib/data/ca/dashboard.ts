/** Construction Admin dashboard roll-up (derived from the other repositories). */
import { listChangeOrders } from "@/lib/data/ca/change-orders";
import { listRfis } from "@/lib/data/ca/rfis";
import { listCertifications } from "@/lib/data/ca/certifications";
import { listPunchItems } from "@/lib/data/ca/punch-list";
import { listSubmittals } from "@/lib/data/ca/submittals";
import type { CaDashboard } from "@/lib/ca/types";

const PENDING_CO = ["DRAFT", "SUBMITTED", "UNDER_REVIEW"] as const;
// A submittal is "open" until the reviewer has issued a final disposition.
const OPEN_SUBMITTAL = ["REQUIRED", "SUBMITTED", "REVIEWED", "REVISE_AND_RESUBMIT"] as const;

export async function getCaDashboard(projectId?: string): Promise<CaDashboard> {
  const [changeOrders, rfis, certs, punchItems, submittals] = await Promise.all([
    listChangeOrders(projectId),
    listRfis(projectId),
    listCertifications(projectId),
    listPunchItems(projectId),
    listSubmittals(projectId),
  ]);

  // Original contract value: one figure per project (de-duplicated), summed.
  const originalByProject = new Map<string, number>();
  for (const co of changeOrders) {
    if (!originalByProject.has(co.projectId)) {
      originalByProject.set(co.projectId, co.originalContractValue);
    }
  }
  const originalContractValue = [...originalByProject.values()].reduce((n, v) => n + v, 0);

  const approvedChangeOrders = changeOrders
    .filter((c) => c.status === "APPROVED")
    .reduce((n, c) => n + c.totalCost, 0);
  const pendingChangeOrders = changeOrders
    .filter((c) => (PENDING_CO as readonly string[]).includes(c.status))
    .reduce((n, c) => n + c.totalCost, 0);

  const scheduleStatusDays = changeOrders
    .filter((c) => c.status === "APPROVED")
    .reduce((n, c) => n + c.scheduleImpactDays, 0);

  // Percent complete: latest certification per project, averaged.
  const latestCertByProject = new Map<string, number>();
  for (const c of certs) {
    if (!latestCertByProject.has(c.projectId)) {
      latestCertByProject.set(c.projectId, c.currentPercentComplete);
    }
  }
  const pctValues = [...latestCertByProject.values()];
  const percentComplete = pctValues.length
    ? Math.round(pctValues.reduce((n, v) => n + v, 0) / pctValues.length)
    : 0;

  const openRfis = rfis.filter((r) => r.status === "OPEN").length;
  const openSubmittals = submittals.filter((s) =>
    (OPEN_SUBMITTAL as readonly string[]).includes(s.status),
  ).length;
  const openPunchItems = punchItems.filter(
    (p) => p.status === "OPEN" || p.status === "IN_PROGRESS",
  ).length;
  const pendingBankDraws = certs.filter((c) => c.status === "DRAFT" || c.status === "ISSUED").length;

  // Simple risk heuristic until a dedicated risk register exists (Phase 2).
  const riskScore =
    openRfis +
    changeOrders.filter((c) => (PENDING_CO as readonly string[]).includes(c.status)).length +
    (scheduleStatusDays > 0 ? 2 : 0) +
    (punchItems.some((p) => p.status !== "VERIFIED" && p.priority === "CRITICAL") ? 2 : 0);
  const riskLevel: CaDashboard["riskLevel"] = riskScore >= 6 ? "HIGH" : riskScore >= 3 ? "MEDIUM" : "LOW";

  const currency = changeOrders[0]?.currency ?? certs[0]?.currency ?? "USD";

  return {
    originalContractValue,
    approvedChangeOrders,
    pendingChangeOrders,
    revisedContractValue: originalContractValue + approvedChangeOrders,
    percentComplete,
    scheduleStatusDays,
    openRfis,
    openSubmittals,
    openPunchItems,
    pendingBankDraws,
    riskLevel,
    currency,
  };
}
