import { describe, expect, it } from "vitest";
import {
  blockers,
  canGenerate,
  preflight,
  preflightSummary,
  recommendations,
  type PreflightInput,
} from "./preflight";
import { EMPTY_FACTS, type ContractFacts } from "./types";

/** A job with everything a contract requires, and nothing it merely likes. */
const ready = (over: Partial<ContractFacts> = {}): ContractFacts => ({
  ...EMPTY_FACTS,
  projectName: "Kamay 33 Residence",
  projectNumber: "2026A-019",
  employerName: "Jozef Lacle",
  contractorName: "Acme Construction NV",
  contractSum: 1_275_000,
  currency: "AWG",
  exchangeRate: 1.75,
  ...over,
});

const input = (facts: ContractFacts, over: Partial<PreflightInput> = {}): PreflightInput => ({
  facts,
  hasTemplate: true,
  templateName: "ZenArch construction contract 2026.pdf",
  hasAiKey: true,
  hasLogo: true,
  ...over,
});

const labels = (items: { label: string }[]) => items.map((i) => i.label);

describe("what blocks a contract", () => {
  it("passes a job that has the five required facts", () => {
    const groups = preflight(input(ready()));
    expect(blockers(groups)).toEqual([]);
    expect(canGenerate(groups)).toBe(true);
  });

  it("blocks with no AI key and no template", () => {
    const groups = preflight(input(ready(), { hasAiKey: false, hasTemplate: false }));
    expect(labels(blockers(groups))).toEqual(["AI key", "Contract to fill in"]);
    expect(canGenerate(groups)).toBe(false);
  });

  it("blocks with no parties, no project and no sum", () => {
    const groups = preflight(input(EMPTY_FACTS));
    expect(labels(blockers(groups))).toEqual([
      "Project",
      "Employer / client",
      "Contractor",
      "Contract sum",
    ]);
  });

  it("blocks a schedule that does not total 100%", () => {
    const groups = preflight(
      input(
        ready({
          phases: [
            { phase: "1", description: "Deposit", detail: "", percent: 40 },
            { phase: "2", description: "Completion", detail: "", percent: 40 },
          ],
        }),
      ),
    );
    expect(labels(blockers(groups))).toEqual(["Instalments total 100%"]);
  });

  it("accepts a schedule that does total 100%", () => {
    const groups = preflight(
      input(
        ready({
          phases: [
            { phase: "1", description: "Deposit", detail: "", percent: 30 },
            { phase: "2", description: "Roof", detail: "", percent: 40 },
            { phase: "3", description: "Completion", detail: "", percent: 30 },
          ],
        }),
      ),
    );
    expect(canGenerate(groups)).toBe(true);
  });

  it("requires an exchange rate ONLY once instalments exist", () => {
    const noPhases = preflight(input(ready({ exchangeRate: 0 })));
    expect(labels(blockers(noPhases))).toEqual([]);

    const withPhases = preflight(
      input(
        ready({
          exchangeRate: 0,
          phases: [{ phase: "1", description: "All", detail: "", percent: 100 }],
        }),
      ),
    );
    expect(labels(blockers(withPhases))).toEqual(["Exchange rate"]);
  });
});

describe("what merely prints as a blank line", () => {
  it("never blocks on the recommended things", () => {
    const groups = preflight(input(ready(), { hasLogo: false }));
    expect(canGenerate(groups)).toBe(true);
    expect(labels(recommendations(groups))).toContain("Letterhead logo");
    expect(labels(recommendations(groups))).toContain("Completion date");
  });

  it("counts a contact as present when either the email or the phone is", () => {
    const groups = preflight(input(ready({ employerEmail: "j@example.com" })));
    expect(labels(recommendations(groups))).not.toContain("Employer contact");
  });
});

describe("what the line actually says", () => {
  it("reports the value it read, not just a tick", () => {
    const groups = preflight(input(ready()));
    const sum = groups.flatMap((g) => g.items).find((i) => i.label === "Contract sum");
    expect(sum?.detail).toBe("AWG 1,275,000.00");
  });

  it("explains a missing schedule rather than failing it", () => {
    const groups = preflight(input(ready()));
    const phases = groups.flatMap((g) => g.items).find((i) => i.label === "Payment instalments");
    expect(phases?.required).toBe(false);
    expect(phases?.detail).toMatch(/keeps whatever schedule its template has/);
  });
});

describe("the summary line", () => {
  it("names what is still needed", () => {
    expect(preflightSummary(preflight(input(EMPTY_FACTS)))).toMatch(
      /still needed: project, employer \/ client, contractor, contract sum/,
    );
  });

  it("names what will print blank when nothing blocks", () => {
    expect(preflightSummary(preflight(input(ready())))).toMatch(/^Ready\./);
  });

  it("says so when there is nothing left at all", () => {
    const complete = ready({
      siteAddress: "Kamay 33, Noord",
      scopeSummary: "Construction of a two-storey residence",
      employerAddress: "Oranjestad",
      employerEmail: "j@example.com",
      contractorAddress: "Santa Cruz",
      contractorPhone: "588-1234",
      administratorName: "ZenArch",
      commencementDate: "2026-10-01",
      completionDate: "2027-04-01",
      contractPeriodDays: 182,
      liquidatedDamagesPerDay: 500,
      defectsLiabilityMonths: 12,
      retentionPercent: 10,
      phases: [{ phase: "1", description: "All", detail: "On completion", percent: 100 }],
    });
    expect(preflightSummary(preflight(input(complete)))).toBe(
      "Everything the contract needs is here.",
    );
  });
});
