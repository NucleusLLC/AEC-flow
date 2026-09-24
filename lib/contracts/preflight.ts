/**
 * The pre-flight checklist. PURE — it reads the facts as they stand and says
 * what is missing, before a single token is spent.
 *
 * WHY A CHECKLIST AND NOT VALIDATION ON SUBMIT. Generating a contract costs
 * real money and thirty to sixty seconds, and the failure it protects against
 * is not an error — it is a contract that comes back looking finished with the
 * completion date blank. So the check runs first, shows what it looked at, and
 * separates two different kinds of missing:
 *
 *   ✗ REQUIRED — without it there is no contract worth making. Generate stays
 *     locked until every one is cleared.
 *   ! RECOMMENDED — the contract can be made; the document will carry a
 *     `__________` where the fact should be, and the reviewer will see it in
 *     the check list that comes back.
 *
 * It reports what it READ, not just a verdict: "Contract sum — AWG 1,275,000.00"
 * is a line a user can disagree with. "Contract sum ✓" is not.
 */
import { DEFAULT_EXCHANGE_RATE, type ContractFacts } from "./types";
import { percentsTotalHundred, roundPercent, totalPercent } from "./schedule";

export type CheckItem = {
  label: string;
  ok: boolean;
  /** True when a failure blocks generation. */
  required: boolean;
  /** What was actually read, shown beside the line. */
  detail: string;
};

export type CheckGroup = {
  label: string;
  items: CheckItem[];
};

export type PreflightInput = {
  facts: ContractFacts;
  /** Is a template PDF selected? Without one there is nothing to fill in. */
  hasTemplate: boolean;
  templateName: string;
  /** Is an Anthropic key configured on the server? */
  hasAiKey: boolean;
  /** Does the practice have a logo for the letterhead? */
  hasLogo: boolean;
};

const money = (n: number, currency: string) =>
  `${currency} ${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function req(label: string, ok: boolean, detail = ""): CheckItem {
  return { label, ok, required: true, detail };
}

function rec(label: string, ok: boolean, detail = ""): CheckItem {
  return { label, ok, required: false, detail };
}

export function preflight(input: PreflightInput): CheckGroup[] {
  const f = input.facts;
  const filled = (s: string) => Boolean(String(s ?? "").trim());
  const phases = (f.phases ?? []).filter((p) => roundPercent(p.percent) > 0);
  const hasPhases = phases.length > 0;

  return [
    {
      label: "Setup",
      items: [
        req("AI key", input.hasAiKey, input.hasAiKey ? "configured on the server" : "not set — Settings › AI"),
        req(
          "Contract to fill in",
          input.hasTemplate,
          input.templateName || "upload the practice's contract as a PDF",
        ),
        rec(
          "Letterhead logo",
          input.hasLogo,
          input.hasLogo ? "set" : "none — the contract prints without one",
        ),
      ],
    },
    {
      label: "The job",
      items: [
        req("Project", filled(f.projectName), [f.projectNumber, f.projectName].filter(Boolean).join(" · ")),
        rec("Site address", filled(f.siteAddress), f.siteAddress),
        rec("Scope, in a sentence", filled(f.scopeSummary), f.scopeSummary.slice(0, 80)),
      ],
    },
    {
      label: "Parties",
      items: [
        req("Employer / client", filled(f.employerName), f.employerName),
        rec("Employer address", filled(f.employerAddress), f.employerAddress),
        rec(
          "Employer contact",
          filled(f.employerEmail) || filled(f.employerPhone),
          [f.employerContact, f.employerEmail, f.employerPhone].filter(Boolean).join(" · "),
        ),
        req("Contractor", filled(f.contractorName), f.contractorName),
        rec("Contractor address", filled(f.contractorAddress), f.contractorAddress),
        rec(
          "Contractor contact",
          filled(f.contractorEmail) || filled(f.contractorPhone),
          [f.contractorContact, f.contractorEmail, f.contractorPhone].filter(Boolean).join(" · "),
        ),
        rec("Contract administrator", filled(f.administratorName), f.administratorName),
      ],
    },
    {
      label: "Price & payment",
      items: [
        req(
          "Contract sum",
          f.contractSum > 0,
          f.contractSum > 0 ? money(f.contractSum, f.currency || "AWG") : "",
        ),
        hasPhases
          ? req(
              "Instalments total 100%",
              percentsTotalHundred(phases),
              `${phases.length} instalment${phases.length === 1 ? "" : "s"} · ${totalPercent(phases)}%`,
            )
          : rec(
              "Payment instalments",
              false,
              "none entered — the contract keeps whatever schedule its template has",
            ),
        hasPhases
          ? req(
              "Exchange rate",
              f.exchangeRate > 0,
              f.exchangeRate > 0 ? `1 US$ = ${f.currency || "AWG"} ${f.exchangeRate.toFixed(2)}` : "",
            )
          : rec(
              "Exchange rate",
              f.exchangeRate > 0,
              `1 US$ = ${f.currency || "AWG"} ${(f.exchangeRate || DEFAULT_EXCHANGE_RATE).toFixed(2)}`,
            ),
        rec(
          "Retention",
          f.retentionPercent !== null && f.retentionPercent > 0,
          f.retentionPercent ? `${f.retentionPercent}% held` : "none — the template's own term stands",
        ),
      ],
    },
    {
      label: "Time",
      items: [
        rec("Commencement date", filled(f.commencementDate), f.commencementDate),
        rec("Completion date", filled(f.completionDate), f.completionDate),
        rec(
          "Contract period",
          Boolean(f.contractPeriodDays && f.contractPeriodDays > 0),
          f.contractPeriodDays ? `${f.contractPeriodDays} calendar days` : "",
        ),
        rec(
          "Liquidated damages",
          Boolean(f.liquidatedDamagesPerDay && f.liquidatedDamagesPerDay > 0),
          f.liquidatedDamagesPerDay
            ? `${money(f.liquidatedDamagesPerDay, f.currency || "AWG")} per day`
            : "none — the template's own term stands",
        ),
        rec(
          "Defects liability",
          Boolean(f.defectsLiabilityMonths && f.defectsLiabilityMonths > 0),
          f.defectsLiabilityMonths ? `${f.defectsLiabilityMonths} months` : "",
        ),
      ],
    },
  ];
}

/** Nothing required is missing — the gate on the Generate button. */
export function canGenerate(groups: CheckGroup[]): boolean {
  return groups.every((g) => g.items.every((i) => i.ok || !i.required));
}

export function blockers(groups: CheckGroup[]): CheckItem[] {
  return groups.flatMap((g) => g.items.filter((i) => i.required && !i.ok));
}

export function recommendations(groups: CheckGroup[]): CheckItem[] {
  return groups.flatMap((g) => g.items.filter((i) => !i.required && !i.ok));
}

/** One line for the button: what is left to do, or what will be left blank. */
export function preflightSummary(groups: CheckGroup[]): string {
  const stop = blockers(groups);
  if (stop.length > 0) {
    return `${stop.length} thing${stop.length === 1 ? "" : "s"} still needed: ${stop
      .map((i) => i.label.toLowerCase())
      .join(", ")}.`;
  }
  const soft = recommendations(groups);
  if (soft.length === 0) return "Everything the contract needs is here.";
  return `Ready. ${soft.length} field${soft.length === 1 ? "" : "s"} will print as a blank line: ${soft
    .map((i) => i.label.toLowerCase())
    .join(", ")}.`;
}
