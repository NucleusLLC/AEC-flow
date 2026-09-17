import { describe, it, expect } from "vitest";
import {
  proposalEmailSubject,
  proposalEmailBody,
  proposalEmailNotice,
  proposalRecipient,
  taxLineLabel,
  type ProposalEmailInput,
} from "@/lib/proposals/proposal-email";

const input: ProposalEmailInput = {
  number: "SP-2026-011",
  title: "Architectural services, residence",
  revision: 1,
  clientName: "Rojer family",
  projectName: "Villa Sabana",
  issuedAt: "16 Sept 2026",
  validUntil: "16 Oct 2026",
  lines: [
    { label: "Base fee", amount: "AWG 10,000.00" },
    { label: "Reimbursables", amount: "AWG 500.00" },
  ],
  total: "AWG 10,500.00",
  milestones: [
    { name: "Concept design", percent: 30, amount: "AWG 3,150.00" },
    { name: "Permit set", percent: 40, amount: "AWG 4,200.00" },
    { name: "Construction documents", percent: 30, amount: "AWG 3,150.00" },
  ],
  senderName: "ZenArch",
};

describe("proposalEmailSubject", () => {
  it("leads with the number, because that is what both sides quote later", () => {
    expect(proposalEmailSubject(input)).toBe("Service Proposal SP-2026-011 — Villa Sabana");
  });

  it("falls back to the title when there is no project yet", () => {
    expect(proposalEmailSubject({ ...input, projectName: null })).toBe(
      "Service Proposal SP-2026-011 — Architectural services, residence",
    );
    expect(proposalEmailSubject({ ...input, projectName: "   " })).toContain("Architectural");
  });

  it("names a revision only once there has been one", () => {
    expect(proposalEmailSubject({ ...input, revision: 1 })).not.toContain("rev");
    expect(proposalEmailSubject({ ...input, revision: 3 })).toContain("(rev 3)");
  });
});

describe("proposalEmailBody", () => {
  it("carries the figures a client needs to decide", () => {
    const body = proposalEmailBody(input);
    expect(body).toContain("SERVICE PROPOSAL SP-2026-011 — Architectural services, residence");
    expect(body).toContain("Rojer family");
    expect(body).toContain("Villa Sabana");
    expect(body).toContain("16 Oct 2026");
    expect(body).toContain("AWG 10,000.00");
    expect(body).toContain("AWG 10,500.00");
    expect(body).toContain("1. Concept design — 30% — AWG 3,150.00");
    expect(body).toContain("3. Construction documents — 30% — AWG 3,150.00");
  });

  it("never claims the document is attached", () => {
    // The app cannot attach anything, and the sender may not attach it by hand.
    const body = proposalEmailBody(input).toLowerCase();
    expect(body).not.toContain("attach");
    expect(body).not.toContain("enclosed");
  });

  it("still states a total when there is no breakdown to show", () => {
    const body = proposalEmailBody({ ...input, lines: [] });
    expect(body).toContain("AWG 10,500.00");
    expect(body).not.toContain("FEE\n");
  });

  it("leaves out a field the proposal does not have", () => {
    const body = proposalEmailBody({
      ...input,
      clientName: null,
      projectName: null,
      issuedAt: null,
      validUntil: null,
      milestones: [],
    });
    expect(body).not.toContain("Client:");
    expect(body).not.toContain("Valid until:");
    expect(body).not.toContain("PAYMENT SCHEDULE");
  });

  it("aligns the amounts into a column", () => {
    const lines = proposalEmailBody(input).split("\n");
    const at = (needle: string) => {
      const line = lines.find((l) => l.includes(needle));
      expect(line, `no line containing ${needle}`).toBeDefined();
      return (line as string).indexOf("AWG");
    };
    expect(at("Base fee")).toBe(at("Reimbursables"));
    expect(at("Base fee")).toBe(at("Total "));
  });

  it("signs off with the practice", () => {
    expect(proposalEmailBody(input).trimEnd().endsWith("ZenArch")).toBe(true);
  });
});

describe("the guard against mailing a draft to the client", () => {
  it("does not prefill the client on a proposal that is not approved for issue", () => {
    expect(
      proposalRecipient({ contactEmail: "client@example.com", approvedForIssue: false }),
    ).toBe("");
  });

  it("prefills once it is approved", () => {
    expect(
      proposalRecipient({ contactEmail: "client@example.com", approvedForIssue: true }),
    ).toBe("client@example.com");
  });

  it("prefills nothing rather than something when there is no address", () => {
    expect(proposalRecipient({ contactEmail: null, approvedForIssue: true })).toBe("");
    expect(proposalRecipient({ contactEmail: "  ", approvedForIssue: true })).toBe("");
  });

  it("says why the address is missing, naming the status", () => {
    const notice = proposalEmailNotice({
      statusLabel: "Draft",
      approvedForIssue: false,
      hasContactEmail: true,
    });
    expect(notice).toContain("Draft");
    expect(notice).toContain("not been approved for issue");
  });

  it("says so when an issuable proposal simply has no contact", () => {
    const notice = proposalEmailNotice({
      statusLabel: "Sent",
      approvedForIssue: true,
      hasContactEmail: false,
    });
    expect(notice).toContain("no contact email");
  });

  it("stays quiet when there is nothing wrong", () => {
    expect(
      proposalEmailNotice({ statusLabel: "Sent", approvedForIssue: true, hasContactEmail: true }),
    ).toBeNull();
  });
});

describe("taxLineLabel", () => {
  it("says a tax is included when the total already contains it", () => {
    // SP-2026-011: 7% BBO inclusive. Unqualified, this printed as
    // "Subtotal 10,000.00 / Tax 654.21 / Total 10,000.00" — which reads to a
    // client as a practice that cannot add up.
    expect(
      taxLineLabel({ subtotal: 10000, discountTotal: 0, taxTotal: 654.21, grandTotal: 10000 }),
    ).toBe("Tax (included in the price)");
  });

  it("leaves it plain when the tax is added on top", () => {
    expect(
      taxLineLabel({ subtotal: 10000, discountTotal: 0, taxTotal: 700, grandTotal: 10700 }),
    ).toBe("Tax");
  });

  it("reads the discount as part of the net, not as tax", () => {
    expect(
      taxLineLabel({ subtotal: 10000, discountTotal: 1000, taxTotal: 589.79, grandTotal: 9000 }),
    ).toBe("Tax (included in the price)");
    expect(
      taxLineLabel({ subtotal: 10000, discountTotal: 1000, taxTotal: 630, grandTotal: 9630 }),
    ).toBe("Tax");
  });

  it("prints no tax line when there is no tax", () => {
    expect(
      taxLineLabel({ subtotal: 10000, discountTotal: 0, taxTotal: 0, grandTotal: 10000 }),
    ).toBeNull();
  });

  it("tolerates rounding rather than mislabelling on a half cent", () => {
    expect(
      taxLineLabel({ subtotal: 10000, discountTotal: 0, taxTotal: 654.21, grandTotal: 10000.001 }),
    ).toBe("Tax (included in the price)");
  });
});
