/**
 * Firm-wide Terms & Conditions attached to fee proposals.
 *
 * Edited under Settings → Terms & Conditions, and appended as a dedicated page
 * to any proposal whose "Attach Terms & Conditions" option is enabled.
 *
 * Persistence: until Supabase is connected, the edited copy is kept in the
 * browser via localStorage so the Settings editor and the in-app proposal
 * previews stay in sync. The printable route falls back to these defaults.
 */

export type TermsClause = { heading: string; body: string };

export const PROPOSAL_TERMS_STORAGE_KEY = "zenarch:proposal-terms";

export const DEFAULT_PROPOSAL_TERMS: TermsClause[] = [
  {
    heading: "1. Scope of Services",
    body: "The services provided are limited to those expressly set out in this proposal. Any work not described herein is excluded and, if required, will be treated as an Additional Service.",
  },
  {
    heading: "2. Fees & Payment",
    body: "Fees are fixed for the scope stated and are exclusive of VAT and disbursements unless noted. Invoices are issued against the agreed payment milestones and are due within 30 days of the invoice date. Late payments may attract interest and a suspension of services.",
  },
  {
    heading: "3. Additional Services & Variations",
    body: "Changes to the brief, scope, programme, or statutory requirements after appointment will be agreed in writing and charged in addition to the stated fee, on a lump-sum or time-charge basis as appropriate.",
  },
  {
    heading: "4. Reimbursable Expenses",
    body: "Printing, authority submission fees, specialist sub-consultants, travel, and similar third-party costs are reimbursable at cost unless expressly included in the fee.",
  },
  {
    heading: "5. Programme & Delays",
    body: "Durations are indicative and assume timely instructions, information, and approvals from the Client and third parties. ZenArch is not liable for delays outside its reasonable control.",
  },
  {
    heading: "6. Client Responsibilities",
    body: "The Client shall provide accurate brief, site, and survey information, nominate a single point of contact authorised to issue instructions, and review and approve deliverables within reasonable timeframes.",
  },
  {
    heading: "7. Intellectual Property & Copyright",
    body: "ZenArch retains copyright and intellectual property in all designs and documents. A licence to use the deliverables for the project is granted upon settlement of all fees properly due.",
  },
  {
    heading: "8. Liability & Insurance",
    body: "ZenArch maintains professional indemnity insurance. The aggregate liability of ZenArch under this appointment is limited to the total fee payable, and ZenArch shall not be liable for any indirect or consequential loss.",
  },
  {
    heading: "9. Confidentiality",
    body: "Each party shall keep confidential the commercial information of the other and shall not disclose it to third parties except as required to deliver the project or by law.",
  },
  {
    heading: "10. Suspension & Termination",
    body: "Either party may suspend or terminate the appointment on written notice for material breach. On termination, the Client shall pay for services performed and committed costs up to the date of termination.",
  },
  {
    heading: "11. Governing Law & Disputes",
    body: "This appointment is governed by the laws of the United Arab Emirates. The parties shall seek to resolve disputes amicably before referring them to the competent courts of the relevant Emirate.",
  },
  {
    heading: "12. Validity",
    body: "This proposal, including these terms, remains open for acceptance until the stated validity date, after which it may be revised or withdrawn.",
  },
];

function isClauseArray(value: unknown): value is TermsClause[] {
  return (
    Array.isArray(value) &&
    value.every(
      (c) => c && typeof c === "object" && typeof (c as TermsClause).heading === "string" && typeof (c as TermsClause).body === "string",
    )
  );
}

/** Read the firm T&C from localStorage, falling back to the defaults. */
export function loadProposalTerms(): TermsClause[] {
  if (typeof window === "undefined") return DEFAULT_PROPOSAL_TERMS;
  try {
    const raw = window.localStorage.getItem(PROPOSAL_TERMS_STORAGE_KEY);
    if (!raw) return DEFAULT_PROPOSAL_TERMS;
    const parsed: unknown = JSON.parse(raw);
    return isClauseArray(parsed) && parsed.length ? parsed : DEFAULT_PROPOSAL_TERMS;
  } catch {
    return DEFAULT_PROPOSAL_TERMS;
  }
}

export function saveProposalTerms(terms: TermsClause[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROPOSAL_TERMS_STORAGE_KEY, JSON.stringify(terms));
  } catch {
    /* storage unavailable — non-fatal in the prototype */
  }
}
