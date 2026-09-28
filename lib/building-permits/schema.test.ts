import { describe, expect, it } from "vitest";
import {
  parseApprovalInput,
  parseBuildingPermitInput,
  parseCorrespondenceInput,
  parseDocumentInput,
  parseMeetingInput,
  parseSubmissionInput,
} from "./schema";

/** The smallest payload the permit form can legally submit. */
function base(over: Record<string, unknown> = {}) {
  return {
    title: "Villa Verde",
    permitType: "NEW_BUILD",
    status: "DRAFT",
    ...over,
  };
}

function messages(result: ReturnType<typeof parseBuildingPermitInput>): string[] {
  return result.ok ? [] : result.issues.map((i) => i.message);
}

describe("buildingPermitInputSchema", () => {
  it("accepts the minimum a new file needs", () => {
    const r = parseBuildingPermitInput(base());
    expect(r.ok).toBe(true);
  });

  it("treats a blank reference as 'assign the next one'", () => {
    const r = parseBuildingPermitInput(base({ reference: "   " }));
    expect(r.ok && r.value.reference).toBe(undefined);
  });

  it("keeps a reference the user typed", () => {
    const r = parseBuildingPermitInput(base({ reference: " DOW/2026/17 " }));
    expect(r.ok && r.value.reference).toBe("DOW/2026/17");
  });

  it("turns an empty optional date into null rather than rejecting it", () => {
    const r = parseBuildingPermitInput(base({ submittedAt: "" }));
    expect(r.ok && r.value.submittedAt).toBe(null);
  });

  it("refuses a date that is not a date", () => {
    expect(parseBuildingPermitInput(base({ submittedAt: "03-09-2026" })).ok).toBe(false);
  });

  it("refuses an acknowledgement that predates the submission", () => {
    const r = parseBuildingPermitInput(
      base({ submittedAt: "2026-09-01", acknowledgedAt: "2026-08-30" }),
    );
    expect(r.ok).toBe(false);
    expect(messages(r)).toContain(
      "The authority cannot acknowledge a submission before it was submitted",
    );
  });

  it("refuses a decision that predates the submission", () => {
    const r = parseBuildingPermitInput(base({ submittedAt: "2026-09-01", decisionAt: "2026-08-01" }));
    expect(messages(r)).toContain("A decision cannot predate the submission");
  });

  it("refuses an expiry before the issue date", () => {
    const r = parseBuildingPermitInput(base({ issuedAt: "2026-09-01", expiresAt: "2026-08-01" }));
    expect(messages(r)).toContain("A permit cannot expire before it was issued");
  });

  it("will not let a status claim more than the dates do", () => {
    expect(messages(parseBuildingPermitInput(base({ status: "CONCEPT_APPROVED" })))).toContain(
      "Record the concept approval date before setting this status",
    );
    expect(messages(parseBuildingPermitInput(base({ status: "ISSUED" })))).toContain(
      "Record the date the permit was issued before setting this status",
    );
  });

  it("accepts those statuses once their date is there", () => {
    expect(
      parseBuildingPermitInput(base({ status: "ISSUED", issuedAt: "2026-09-01" })).ok,
    ).toBe(true);
  });

  it("refuses an enum value this app does not know", () => {
    expect(parseBuildingPermitInput(base({ status: "PENDING_MAGIC" })).ok).toBe(false);
    expect(parseBuildingPermitInput(base({ permitType: "SPACESHIP" })).ok).toBe(false);
  });

  it("refuses a negative fee", () => {
    expect(parseBuildingPermitInput(base({ feeAmount: -1 })).ok).toBe(false);
  });

  it("reads a number typed into a text field", () => {
    const r = parseBuildingPermitInput(base({ feeAmount: "250.50" }));
    expect(r.ok && r.value.feeAmount).toBe(250.5);
  });

  it("refuses an address that is not one", () => {
    expect(parseBuildingPermitInput(base({ authorityEmail: "dow at gov" })).ok).toBe(false);
    expect(parseBuildingPermitInput(base({ authorityEmail: "" })).ok).toBe(true);
  });

  it("will not accept a title of only whitespace", () => {
    expect(parseBuildingPermitInput(base({ title: "   " })).ok).toBe(false);
  });
});

describe("submissionInputSchema", () => {
  it("needs a date — a submission with no date is not a record of anything", () => {
    expect(parseSubmissionInput({ method: "COUNTER" }).ok).toBe(false);
    expect(parseSubmissionInput({ submittedAt: "2026-09-01", method: "COUNTER" }).ok).toBe(true);
  });
});

describe("meetingInputSchema", () => {
  it("needs a date and a subject", () => {
    expect(parseMeetingInput({ heldAt: "2026-09-01", subject: "" }).ok).toBe(false);
    expect(parseMeetingInput({ heldAt: "2026-09-01", subject: "Plan review" }).ok).toBe(true);
  });
});

describe("correspondenceInputSchema", () => {
  const letter = (over: Record<string, unknown> = {}) => ({
    direction: "INCOMING",
    subject: "Request for additional information",
    requiresResponse: false,
    ...over,
  });

  it("accepts a letter that needs no answer", () => {
    expect(parseCorrespondenceInput(letter()).ok).toBe(true);
  });

  it("refuses a deadline on a letter that needs no answer", () => {
    const r = parseCorrespondenceInput(letter({ responseDueAt: "2026-09-20" }));
    expect(r.ok).toBe(false);
  });

  it("accepts the deadline once the letter needs an answer", () => {
    expect(
      parseCorrespondenceInput(letter({ requiresResponse: true, responseDueAt: "2026-09-20" })).ok,
    ).toBe(true);
  });

  it("refuses a reply sent before the letter arrived", () => {
    const r = parseCorrespondenceInput(
      letter({ letterDate: "2026-09-10", respondedAt: "2026-09-01" }),
    );
    expect(r.ok).toBe(false);
  });
});

describe("approvalInputSchema", () => {
  it("lets a pending stage have no date", () => {
    expect(parseApprovalInput({ stage: "CONCEPT", status: "PENDING" }).ok).toBe(true);
  });

  it("refuses a decided stage with no date", () => {
    expect(parseApprovalInput({ stage: "CONCEPT", status: "APPROVED" }).ok).toBe(false);
    expect(
      parseApprovalInput({ stage: "CONCEPT", status: "APPROVED", decidedAt: "2026-09-01" }).ok,
    ).toBe(true);
  });
});

describe("documentInputSchema", () => {
  it("refuses a document that points at nothing", () => {
    const r = parseDocumentInput({ name: "Concept approval letter", category: "LETTER" });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.issues.map((i) => i.message)).toContain("Attach a file or give a link");
  });

  it("accepts a link", () => {
    expect(
      parseDocumentInput({
        name: "Concept approval letter",
        category: "LETTER",
        externalUrl: "https://example.test/letter.pdf",
      }).ok,
    ).toBe(true);
  });

  it("accepts a stored file", () => {
    expect(
      parseDocumentInput({
        name: "Site plan",
        category: "DRAWING",
        storageKey: "permits/abc/site-plan.pdf",
      }).ok,
    ).toBe(true);
  });
});
