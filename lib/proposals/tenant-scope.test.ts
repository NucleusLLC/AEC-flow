import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The single highest-severity risk in this module is a company-owned model that is NOT in
 * TENANT_MODELS — it would read and write across every tenant's data. This test fails the
 * build if any service-proposal table (or TaxRate) is missing from the scoping set.
 *
 * It reads the source of lib/db.ts and prisma/schema.prisma rather than importing the Prisma
 * client, so it needs no database connection and runs in the pure-unit suite.
 */

const root = resolve(__dirname, "..", "..");
const db = readFileSync(resolve(root, "lib", "db.ts"), "utf8");
const schema = readFileSync(resolve(root, "prisma", "schema.prisma"), "utf8");

/** Extract the string literals inside the TENANT_MODELS set. */
function tenantModels(): Set<string> {
  const block = /const TENANT_MODELS = new Set<string>\(\[([\s\S]*?)\]\)/.exec(db);
  if (!block) throw new Error("Could not locate TENANT_MODELS in lib/db.ts");
  return new Set([...block[1].matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1]));
}

/** Every model in the schema, plus whether it declares a companyId field. */
function schemaModels(): { name: string; hasCompanyId: boolean }[] {
  const models: { name: string; hasCompanyId: boolean }[] = [];
  const re = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(schema)) !== null) {
    models.push({ name: m[1], hasCompanyId: /\n\s*companyId\s+String/.test(m[2]) });
  }
  return models;
}

describe("tenant scoping integrity", () => {
  const models = tenantModels();

  it("registers every service-proposal model", () => {
    const required = [
      "ServiceProposal",
      "ServiceProposalDiscipline",
      "ServiceProposalPhase",
      "ServiceProposalFeeComponent",
      "ServiceProposalDevelopmentCostItem",
      "ServiceProposalPaymentMilestone",
      "ServiceProposalReimbursable",
      "ServiceProposalDiscount",
      "ServiceProposalTax",
      "ServiceProposalStatusHistory",
      "ServiceProposalVersion",
      "TaxRate",
    ];
    for (const name of required) {
      expect(models.has(name), `${name} is missing from TENANT_MODELS — cross-tenant leak`).toBe(true);
    }
  });

  it("scopes EVERY model that declares companyId, except the documented exclusions", () => {
    // Four pre-existing models carry companyId but are DELIBERATELY excluded from the central
    // extension (this all predates the Service Proposal module). The extension scopes by the
    // SESSION's company, so anything that must work BEFORE a session exists cannot use it and
    // is scoped by hand instead:
    //   - AppConfig  — keyed manually per-company (a singleton-per-company config row).
    //   - User       — excluded so auth/session resolution works; team queries add
    //                  `where: { companyId }` explicitly (see the SECURITY note in lib/data).
    //   - Invitation — accept happens pre-session, by token; scoped via the token lookup.
    //   - BetaCode   — redeemed at signup, pre-session; scoped via the code lookup.
    // Any OTHER companyId-bearing model not in TENANT_MODELS is a cross-tenant leak.
    const KNOWN_MANUAL_SCOPE = new Set(["AppConfig", "User", "Invitation", "BetaCode"]);
    const unscoped = schemaModels()
      .filter((m) => m.hasCompanyId && !models.has(m.name) && !KNOWN_MANUAL_SCOPE.has(m.name))
      .map((m) => m.name);
    expect(unscoped, `models with companyId not in TENANT_MODELS: ${unscoped.join(", ")}`).toEqual([]);
  });
});
